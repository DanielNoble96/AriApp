"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDiaryEntry } from "@/actions/diary";
import { uploadDiaryPhotos, MAX_DIARY_PHOTOS } from "@/lib/upload-diary-photos";
import { BORDER_CLASS, SHADOW_SM_CLASS, CARD_CLASS, INPUT_CLASS, BUTTON_CLASS } from "@/lib/ui";

function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function DiaryForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEntryDate(localToday());
  }, []);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function reset() {
    setEntryDate(localToday());
    setWeight("");
    setNote("");
    setFiles([]);
    setError(null);
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.some((f) => !f.type.startsWith("image/"))) {
      setError("Files must be images.");
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_DIARY_PHOTOS));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const weightValue = weight === "" ? null : Number(weight);
    if (weightValue != null && (Number.isNaN(weightValue) || weightValue <= 0)) {
      setError("Enter a valid weight.");
      return;
    }
    if (!entryDate) {
      setError("Pick a date.");
      return;
    }

    startTransition(async () => {
      let photoFailed = false;
      try {
        const { id } = await createDiaryEntry({
          entryDate,
          weightLbs: weightValue,
          note: note.trim() || null,
        });
        if (files.length > 0) {
          try {
            await uploadDiaryPhotos(id, files);
          } catch {
            photoFailed = true;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that entry.");
        return;
      }
      if (photoFailed) {
        alert("Entry saved, but a photo couldn't be uploaded. You can add it from the entry.");
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
        className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} rounded-lg bg-brutal-white px-3 py-3 text-sm font-bold`}
      >
        + New Entry
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} flex flex-col gap-3 bg-brutal-white p-4`}>
      <label className="flex items-center justify-between gap-3 text-sm font-bold">
        <span className="opacity-70">Date</span>
        <input
          type="date"
          className={`${INPUT_CLASS} w-auto`}
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-sm font-bold">
        <span className="opacity-70">Weight (lb)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="0.0"
          className={`${INPUT_CLASS} w-28`}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold opacity-70">
          Photos ({files.length}/{MAX_DIARY_PHOTOS})
        </span>
        {previews.length > 0 && (
          <div className="flex gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={src} alt="" className="h-20 w-20 rounded-lg border-[3px] border-brutal-black object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-brutal-black bg-brutal-white text-sm font-bold leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length < MAX_DIARY_PHOTOS && (
          <label
            className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} flex cursor-pointer items-center justify-center rounded-lg bg-brutal-white p-3 text-sm font-bold`}
          >
            📷 Add photos
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          </label>
        )}
      </div>

      <textarea
        rows={3}
        maxLength={600}
        placeholder="How are you feeling? A few sentences if you like..."
        className={INPUT_CLASS}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={`flex-1 py-2 text-sm ${BUTTON_CLASS}`}>
          {isPending ? "Saving..." : "Save Entry"}
        </button>
        <button
          type="button"
          disabled={isPending}
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
