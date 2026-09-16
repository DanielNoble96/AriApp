"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccessoryDay } from "@/actions/accessory-days";
import { BORDER_CLASS, SHADOW_SM_CLASS } from "@/lib/ui";

export function AccessoryDayRow({ id, label, summary }: { id: string; label: string; summary: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Remove this accessory day? This also removes it from your feed.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccessoryDay(id);
      } catch {
        setError("Couldn't remove that -- try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div
        className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} flex items-center justify-between gap-2 rounded-lg bg-brutal-white p-3 opacity-60`}
      >
        <span className="font-bold">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium opacity-70">{summary}</span>
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
