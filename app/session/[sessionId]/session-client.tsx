"use client";

import { useState, useTransition } from "react";
import { completeSet } from "@/actions/sets";
import { resetSession } from "@/actions/sessions";
import { calcPlateBreakdown, formatPlateBreakdown } from "@/lib/plates";
import { BUTTON_CLASS } from "@/lib/ui";

interface SetRow {
  id: string;
  liftId: string;
  liftName: string;
  liftRole: "main" | "assistance" | "accessory";
  equipmentType: "barbell" | "dumbbell" | "machine" | null;
  setType: "warmup" | "main" | "assistance" | "accessory";
  orderIndex: number;
  isAmrap: boolean;
  targetWeight: string | null;
  targetReps: number | null;
  actualWeight: string | null;
  actualReps: number | null;
  completedAt: Date | null;
}

const SET_TYPE_LABEL: Record<SetRow["setType"], string> = {
  warmup: "Warm-Up",
  main: "Work Sets",
  assistance: "Assistance",
  accessory: "Accessory",
};

/** Drops trailing ".00" from numeric-column strings for display (e.g. "185.00" -> "185"). */
function fmt(value: string | null): string {
  if (value == null) return "";
  return String(Number(value));
}

export function SessionClient({
  sessionId,
  initialSets,
}: {
  sessionId: string;
  initialSets: SetRow[];
}) {
  const [rows, setRows] = useState(initialSets);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { weight: string; reps: string }>>({});
  const [errorId, setErrorId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasProgress = rows.some((r) => r.completedAt != null);

  function handleReset() {
    if (!confirm("Reset this session? This clears every logged set back to blank.")) {
      return;
    }
    setResetError(null);
    startTransition(async () => {
      try {
        await resetSession(sessionId);
      } catch {
        setResetError("Couldn't reset the session -- try again.");
        return;
      }
      setRows((prev) =>
        prev.map((r) => ({ ...r, actualWeight: null, actualReps: null, completedAt: null }))
      );
      setDrafts({});
      setEditingId(null);
    });
  }

  function draftFor(row: SetRow) {
    const existing = drafts[row.id];
    if (existing) return existing;
    return {
      weight: row.completedAt ? fmt(row.actualWeight) : fmt(row.targetWeight),
      reps: row.completedAt
        ? row.actualReps != null
          ? String(row.actualReps)
          : ""
        : row.targetReps != null
          ? String(row.targetReps)
          : "",
    };
  }

  function updateDraft(row: SetRow, field: "weight" | "reps", value: string) {
    setDrafts((prev) => ({ ...prev, [row.id]: { ...draftFor(row), [field]: value } }));
  }

  function handleDone(row: SetRow) {
    setErrorId(null);
    const draft = draftFor(row);
    const reps = Number(draft.reps);
    if (!draft.reps || Number.isNaN(reps)) {
      setErrorId(row.id);
      return;
    }
    const weight = draft.weight === "" ? null : Number(draft.weight);
    if (draft.weight !== "" && Number.isNaN(weight)) {
      setErrorId(row.id);
      return;
    }

    startTransition(async () => {
      try {
        await completeSet(row.id, weight, reps);
      } catch {
        setErrorId(row.id);
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                actualWeight: weight != null ? String(weight) : null,
                actualReps: reps,
                completedAt: new Date(),
              }
            : r
        )
      );
      setEditingId(null);
    });
  }

  let lastGroupKey = "";

  return (
    <div className="flex flex-col gap-3">
      {hasProgress && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={isPending}
            onClick={handleReset}
            className="text-sm font-semibold text-red-600 disabled:opacity-50"
          >
            Reset Session
          </button>
          {resetError && <p className="text-xs text-red-600">{resetError}</p>}
        </div>
      )}
      {rows.map((row) => {
        const groupKey = `${row.liftId}:${row.setType}`;
        const showHeader = groupKey !== lastGroupKey;
        lastGroupKey = groupKey;

        const isDone = row.completedAt != null;
        const isEditing = editingId === row.id || !isDone;
        const draft = draftFor(row);

        return (
          <div key={row.id}>
            {showHeader && (
              <h2 className="mb-2 mt-3 text-sm font-semibold opacity-70">
                {row.liftName} — {SET_TYPE_LABEL[row.setType]}
              </h2>
            )}
            <div
              className={`flex items-center justify-between gap-2 rounded border p-2 ${isDone ? "opacity-60" : ""}`}
            >
              <div className="text-sm">
                {row.targetWeight != null ? (
                  <>
                    <span>
                      {fmt(row.targetWeight)} lb{row.equipmentType === "dumbbell" ? " (each)" : ""} ×{" "}
                      {row.targetReps}
                      {row.isAmrap ? "+" : ""}
                    </span>
                    {row.equipmentType === "barbell" &&
                      (() => {
                        const breakdown = calcPlateBreakdown(Number(row.targetWeight));
                        return (
                          <div className="text-xs opacity-60">
                            {breakdown.belowBarWeight
                              ? "Below an empty bar (45 lb) -- use just the bar"
                              : `${formatPlateBreakdown(breakdown.perSide)} / side`}
                          </div>
                        );
                      })()}
                  </>
                ) : (
                  <span className="opacity-60">Freeform — log your own weight &amp; reps</span>
                )}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="lb"
                    className="w-16 rounded border px-1 py-1 text-right text-sm"
                    value={draft.weight}
                    onChange={(e) => updateDraft(row, "weight", e.target.value)}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="reps"
                    className="w-14 rounded border px-1 py-1 text-right text-sm"
                    value={draft.reps}
                    onChange={(e) => updateDraft(row, "reps", e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDone(row)}
                    className={`px-3 py-1 text-sm ${BUTTON_CLASS}`}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(row.id)}
                  className="flex items-center gap-2 text-sm"
                >
                  <span>
                    ✓ {row.actualWeight != null ? `${fmt(row.actualWeight)} lb × ` : ""}
                    {row.actualReps}
                  </span>
                  <span className="opacity-50">Edit</span>
                </button>
              )}
            </div>
            {errorId === row.id && <p className="mt-1 text-xs text-red-600">Enter a valid rep count.</p>}
          </div>
        );
      })}
    </div>
  );
}
