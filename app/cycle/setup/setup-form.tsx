"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCycle } from "@/actions/cycles";
import type { MainWaveConfig, WaveWeek } from "@/lib/weight-calc";
import { BUTTON_CLASS } from "@/lib/ui";

interface LiftInfo {
  id: string;
  name: string;
  role: "main" | "assistance" | "accessory";
  dayNumber: number;
  dayName: string;
  currentTrainingMax: string | null;
}

interface SetupFormProps {
  lifts: LiftInfo[];
  defaultMainWave: MainWaveConfig;
  defaultWarmupScheme: WaveWeek;
  defaultAssistancePercentage: number;
}

const WEEK_KEYS = ["week1", "week2", "week3"] as const;

export function SetupForm({
  lifts,
  defaultMainWave,
  defaultWarmupScheme,
  defaultAssistancePercentage,
}: SetupFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const trackedLifts = lifts.filter((l) => l.role === "main" || l.role === "assistance");
  const assistanceLifts = lifts.filter((l) => l.role === "assistance");

  const [trainingMaxes, setTrainingMaxes] = useState<Record<string, string>>(() =>
    Object.fromEntries(trackedLifts.map((l) => [l.id, l.currentTrainingMax ?? ""]))
  );
  const [assistancePercentages, setAssistancePercentages] = useState<Record<string, string>>(() =>
    Object.fromEntries(assistanceLifts.map((l) => [l.id, String(defaultAssistancePercentage)]))
  );
  const [mainWave, setMainWave] = useState<MainWaveConfig>(defaultMainWave);
  const [warmupScheme, setWarmupScheme] = useState<WaveWeek>(defaultWarmupScheme);

  const liftsByDay = new Map<number, LiftInfo[]>();
  for (const lift of lifts) {
    const arr = liftsByDay.get(lift.dayNumber) ?? [];
    arr.push(lift);
    liftsByDay.set(lift.dayNumber, arr);
  }
  const dayNumbers = [...liftsByDay.keys()].sort((a, b) => a - b);

  function updateWaveSet(
    week: (typeof WEEK_KEYS)[number],
    index: number,
    field: "percentage" | "reps",
    value: number
  ) {
    setMainWave((prev) => {
      const nextWeek = [...prev[week]];
      nextWeek[index] = { ...nextWeek[index], [field]: value };
      return { ...prev, [week]: nextWeek };
    });
  }

  function updateWarmupSet(index: number, field: "percentage" | "reps", value: number) {
    setWarmupScheme((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedTMs: Record<string, number> = {};
    for (const lift of trackedLifts) {
      const raw = trainingMaxes[lift.id];
      const num = Number(raw);
      if (!raw || Number.isNaN(num) || num <= 0) {
        setError(`Enter a training max for ${lift.name}.`);
        return;
      }
      parsedTMs[lift.id] = num;
    }

    const parsedPercentages: Record<string, number> = {};
    for (const lift of assistanceLifts) {
      const raw = assistancePercentages[lift.id];
      const num = Number(raw);
      if (!raw || Number.isNaN(num) || num <= 0) {
        setError(`Enter an assistance percentage for ${lift.name}.`);
        return;
      }
      parsedPercentages[lift.id] = num;
    }

    startTransition(async () => {
      try {
        await createCycle({
          trainingMaxes: parsedTMs,
          assistancePercentages: parsedPercentages,
          mainWaveConfig: mainWave,
          warmupScheme,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        return;
      }
      router.push("/");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 pb-24">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Training Maxes</h2>
        {dayNumbers.map((dayNumber) => {
          const dayLifts = liftsByDay.get(dayNumber)!.filter((l) => l.role !== "accessory");
          if (dayLifts.length === 0) return null;
          return (
            <div key={dayNumber} className="mb-4">
              <h3 className="mb-2 text-sm font-medium opacity-70">{dayLifts[0].dayName}</h3>
              <div className="flex flex-col gap-2">
                {dayLifts.map((lift) => (
                  <label key={lift.id} className="flex items-center justify-between gap-3">
                    <span>{lift.name}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-24 rounded border px-2 py-1 text-right"
                      value={trainingMaxes[lift.id] ?? ""}
                      onChange={(e) =>
                        setTrainingMaxes((prev) => ({ ...prev, [lift.id]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Main Lift Wave</h2>
        {WEEK_KEYS.map((week, weekIndex) => (
          <div key={week} className="mb-4">
            <h3 className="mb-2 text-sm font-medium opacity-70">Week {weekIndex + 1}</h3>
            <div className="flex flex-col gap-2">
              {mainWave[week].map((set, setIndex) => (
                <div key={setIndex} className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-16 rounded border px-2 py-1 text-right"
                    value={set.percentage}
                    onChange={(e) =>
                      updateWaveSet(week, setIndex, "percentage", Number(e.target.value))
                    }
                  />
                  <span className="opacity-60">% x</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-14 rounded border px-2 py-1 text-right"
                    value={set.reps}
                    onChange={(e) => updateWaveSet(week, setIndex, "reps", Number(e.target.value))}
                  />
                  {set.amrap && <span className="text-xs opacity-60">AMRAP</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Warm-Up Sets</h2>
        <div className="flex flex-col gap-2">
          {warmupScheme.map((set, setIndex) => (
            <div key={setIndex} className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="w-16 rounded border px-2 py-1 text-right"
                value={set.percentage}
                onChange={(e) => updateWarmupSet(setIndex, "percentage", Number(e.target.value))}
              />
              <span className="opacity-60">% x</span>
              <input
                type="number"
                inputMode="numeric"
                className="w-14 rounded border px-2 py-1 text-right"
                value={set.reps}
                onChange={(e) => updateWarmupSet(setIndex, "reps", Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Assistance % of TM</h2>
        <div className="flex flex-col gap-2">
          {assistanceLifts.map((lift) => (
            <label key={lift.id} className="flex items-center justify-between gap-3">
              <span>{lift.name}</span>
              <input
                type="number"
                inputMode="decimal"
                className="w-20 rounded border px-2 py-1 text-right"
                value={assistancePercentages[lift.id] ?? ""}
                onChange={(e) =>
                  setAssistancePercentages((prev) => ({ ...prev, [lift.id]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className={`fixed inset-x-0 bottom-0 mx-auto w-full max-w-md py-4 text-center ${BUTTON_CLASS}`}
      >
        {isPending ? "Starting..." : "Start Cycle"}
      </button>
    </form>
  );
}
