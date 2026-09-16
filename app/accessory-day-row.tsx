"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccessoryDay, updateAccessoryDay } from "@/actions/accessory-days";
import { ACCESSORY_ACTIVITY_OPTIONS, ACCESSORY_ACTIVITY_LABELS, type AccessoryActivityType } from "@/lib/constants";
import { BORDER_CLASS, SHADOW_SM_CLASS, CARD_CLASS, COMPACT_INPUT_CLASS, BUTTON_CLASS } from "@/lib/ui";

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface AccessoryDayEntryData {
  id: string;
  activityType: AccessoryActivityType;
  durationMinutes: number | null;
  distanceMiles: string | null;
}

export function AccessoryDayRow({ entry }: { entry: AccessoryDayEntryData }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [activityType, setActivityType] = useState<AccessoryActivityType>(entry.activityType);
  const [hours, setHours] = useState(
    entry.durationMinutes ? String(Math.floor(entry.durationMinutes / 60)) : ""
  );
  const [minutes, setMinutes] = useState(
    entry.durationMinutes ? String(entry.durationMinutes % 60) : ""
  );
  const [distance, setDistance] = useState(
    entry.distanceMiles != null ? String(Number(entry.distanceMiles)) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const summary =
    [
      entry.durationMinutes != null ? formatDuration(entry.durationMinutes) : null,
      entry.distanceMiles != null ? `${Number(entry.distanceMiles)} mi` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Logged";

  function handleDelete() {
    if (!confirm("Remove this accessory day? This also removes it from your feed.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccessoryDay(entry.id);
      } catch {
        setError("Couldn't remove that -- try again.");
        return;
      }
      router.refresh();
    });
  }

  function handleSave(e: React.FormEvent) {
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
        await updateAccessoryDay(entry.id, {
          activityType,
          durationMinutes: durationMinutes > 0 ? durationMinutes : null,
          distanceMiles: distanceValue,
        });
      } catch {
        setError("Couldn't save changes -- try again.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className={`${CARD_CLASS} flex flex-col gap-3 bg-brutal-white p-3`}>
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

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className={`flex-1 py-2 text-sm ${BUTTON_CLASS}`}>
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 text-sm font-bold opacity-60 hover:opacity-100"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div
        className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} flex items-center justify-between gap-2 rounded-lg bg-brutal-white p-3 opacity-60`}
      >
        <span className="font-bold">{ACCESSORY_ACTIVITY_LABELS[entry.activityType]}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium opacity-70">{summary}</span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            Edit
          </button>
          <button
            type="button"
            aria-label="Remove accessory day"
            disabled={isPending}
            onClick={handleDelete}
            className="shrink-0 text-lg font-bold leading-none opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
