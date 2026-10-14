"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDiaryEntry, deleteDiaryEntry, removeDiaryPhoto } from "@/actions/diary";
import { uploadDiaryPhotos, MAX_DIARY_PHOTOS } from "@/lib/upload-diary-photos";
import { BORDER_CLASS, SHADOW_SM_CLASS, CARD_CLASS, INPUT_CLASS, BUTTON_CLASS } from "@/lib/ui";

export interface DiaryEntryData {
  id: string;
  entryDate: string;
  cycleNumber: number | null;
  weekNumber: number | null;
  weightLbs: string | null;
  note: string | null;
  photos: { id: string; photoUrl: string }[];
}

function formatEntryDate(entryDate: string): string {
  const [y, m, d] = entryDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DiaryEntryCard({ entry }: { entry: DiaryEntryData }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [weight, setWeight] = useState(entry.weightLbs != null ? String(Number(entry.weightLbs)) : "");
  const [note, setNote] = useState(entry.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const remaining = MAX_DIARY_PHOTOS - entry.photos.length;

  function run(fn: () => Promise<void>, fallback: string, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallback);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const weightValue = weight === "" ? null : Number(weight);
    if (weightValue != null && (Number.isNaN(weightValue) || weightValue <= 0)) {
      setError("Enter a valid weight.");
      return;
    }
    run(
      () => updateDiaryEntry(entry.id, { weightLbs: weightValue, note: note.trim() || null }),
      "Couldn't save changes.",
      () => setIsEditing(false)
    );
  }

  function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    e.target.value = "";
    if (files.length === 0) return;
    if (files.some((f) => !f.type.startsWith("image/"))) {
      setError("Files must be images.");
      return;
    }
    run(() => uploadDiaryPhotos(entry.id, files), "Couldn't upload photo.");
  }

  return (
    <div className={`${CARD_CLASS} bg-brutal-white p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{formatEntryDate(entry.entryDate)}</p>
          {entry.cycleNumber != null && entry.weekNumber != null && (
            <p className="text-xs font-bold opacity-70">
              Cycle {entry.cycleNumber} · Week {entry.weekNumber}
            </p>
          )}
          {entry.weightLbs != null && !isEditing && (
            <p className="text-sm font-bold opacity-70">{Number(entry.weightLbs)} lb</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold opacity-70 hover:opacity-100"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            aria-label="Delete entry"
            disabled={isPending}
            onClick={() => {
              if (confirm("Delete this diary entry and its photos?")) {
                run(() => deleteDiaryEntry(entry.id), "Couldn't delete that entry.");
              }
            }}
            className="text-lg font-bold leading-none opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      </div>

      {entry.photos.length > 0 && (
        <div className="relative mt-3 flex h-80 snap-x snap-mandatory overflow-x-auto rounded-lg border-[3px] border-brutal-black">
          {entry.photos.map((photo, i) => (
            <div key={photo.id} className="relative h-80 w-full shrink-0 snap-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- served via app/api/photos */}
              <img src={photo.photoUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                disabled={isPending}
                onClick={() => {
                  if (confirm("Remove this photo?")) {
                    run(() => removeDiaryPhoto(photo.id), "Couldn't remove photo.");
                  }
                }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-brutal-black bg-brutal-white text-base font-bold leading-none"
              >
                ×
              </button>
              {entry.photos.length > 1 && (
                <span className="absolute bottom-2 right-2 rounded-full border-2 border-brutal-black bg-brutal-white px-2 py-0.5 text-xs font-bold">
                  {i + 1}/{entry.photos.length}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <label
          className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brutal-white p-3 text-sm font-bold ${
            isPending ? "opacity-50" : ""
          }`}
        >
          📷 Add a photo{entry.photos.length > 0 ? ` (${entry.photos.length}/${MAX_DIARY_PHOTOS})` : ""}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={isPending}
            onChange={handleAddPhotos}
          />
        </label>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 text-sm font-bold">
            <span className="opacity-70">Weight (lb)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className={`${INPUT_CLASS} w-28`}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <textarea
            rows={3}
            maxLength={600}
            className={INPUT_CLASS}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
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
      ) : (
        entry.note && <p className="mt-3 whitespace-pre-wrap text-sm font-medium">{entry.note}</p>
      )}

      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
