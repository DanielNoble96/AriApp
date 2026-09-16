"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logAccessoryDay } from "@/actions/accessory-days";
import { ACCESSORY_ACTIVITY_OPTIONS, ACCESSORY_ACTIVITY_LABELS, type AccessoryActivityType } from "@/lib/constants";
import { BORDER_CLASS, SHADOW_SM_CLASS, CARD_CLASS, INPUT_CLASS, COMPACT_INPUT_CLASS, BUTTON_CLASS } from "@/lib/ui";

export function AccessoryDayForm({ cycleId, weekNumber }: { cycleId: string; weekNumber: number }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activityType, setActivityType] = useState<AccessoryActivityType>(ACCESSORY_ACTIVITY_OPTIONS[0]);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setActivityType(ACCESSORY_ACTIVITY_OPTIONS[0]);
    setHours("");
    setMinutes("");
    setDistance("");
    setCaption("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const h = hours === "" ? 0 : Number(hours);
    const m = minutes === "" ? 0 : Number(minutes);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      setError("Enter a valid duration.");
      return;
    }
    const durationMinutes = h * 60 + m;
    const distanceValue = distance === "" ? null : Number(distance);
    if (distanceValue != null && Number.isNaN(distanceValue)) {
      setError("Enter a valid distance.");
      return;
    }

    startTransition(async () => {
      try {
        await logAccessoryDay({
          cycleId,
          weekNumber,
          activityType,
          durationMinutes: durationMinutes > 0 ? durationMinutes : null,
          distanceMiles: distanceValue,
          caption: caption.trim() || null,
        });
      } catch {
        setError("Couldn't log that activity -- try again.");
        return;
      }
      reset();
      setIsOpen(false);
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} rounded-lg bg-brutal-white px-3 py-2 text-sm font-bold`}
      >
        + Add Accessory Day
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} flex flex-col gap-3 bg-brutal-white p-3`}>
      <div className="flex flex-wrap gap-2">
        {ACCESSORY_ACTIVITY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setActivityType(option)}
            className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} rounded-lg px-3 py-1 text-xs font-bold ${
              activityType === option ? "bg-brutal-yellow" : "bg-brutal-white"
            }`}
          >
            {ACCESSORY_ACTIVITY_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="opacity-70">Duration</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          className={`${COMPACT_INPUT_CLASS} w-14`}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        <span className="opacity-70">hr</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          className={`${COMPACT_INPUT_CLASS} w-14`}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <span className="opacity-70">min</span>
      </div>

      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="opacity-70">Distance</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          className={`${COMPACT_INPUT_CLASS} w-20`}
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        />
        <span className="opacity-70">mi</span>
      </div>

      <input
        type="text"
        placeholder="Add a caption..."
        className={INPUT_CLASS}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={`flex-1 py-2 text-sm ${BUTTON_CLASS}`}>
          {isPending ? "Logging..." : "Log Activity"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setIsOpen(false);
          }}
          className="px-3 text-sm font-bold opacity-60 hover:opacity-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
