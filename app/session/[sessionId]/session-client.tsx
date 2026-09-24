"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeSet, addExtraSet, removeSet } from "@/actions/sets";
import { resetSession, completeSession, beginSession, pauseSession, resumeSession } from "@/actions/sessions";
import { swapGroupLift } from "@/actions/lift-swap";
import { addCustomAccessory } from "@/actions/custom-accessories";
import { getSwapPool, type SwapSlot } from "@/lib/lift-swaps";
import { calcPlateBreakdown, formatPlateBreakdown } from "@/lib/plates";
import { calcRepsNeededForPr } from "@/lib/prs";
import { InolWidget } from "./inol-widget";
import {
  BUTTON_CLASS,
  SUCCESS_BUTTON_CLASS,
  PINK_BUTTON_CLASS,
  DANGER_BUTTON_CLASS,
  CARD_CLASS,
  INPUT_CLASS,
  PILL_CLASS,
  COMPACT_INPUT_CLASS,
} from "@/lib/ui";

const ACCESSORY_SUGGESTIONS = [
  "DB Curls",
  "DB Shrug",
  "Lat Pulldown",
  "Lateral Dumbbell Row",
  "Single Arm Tricep Extension",
];

interface SetRow {
  id: string;
  liftId: string;
  liftName: string;
  liftRole: "main" | "assistance" | "accessory";
  equipmentType: "barbell" | "dumbbell" | "machine" | null;
  setType: "warmup" | "main" | "assistance" | "accessory";
  orderIndex: number;
  isAmrap: boolean;
  isExtra: boolean;
  targetWeight: string | null;
  targetReps: number | null;
  intensityPercentage: string | null;
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

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Ticks once a second while `active`, otherwise holds still. Elapsed/rest
 * values are computed from this plus fixed anchor timestamps (not
 * accumulated counters), so they're correct immediately even after
 * backgrounding/closing/reopening the tab.
 */
function useTickingNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);
  return now;
}

function playRestAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // Vibration not available -- ignore.
    }
  }
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    oscillator.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio blocked (e.g. autoplay policy) or unavailable -- ignore.
  }
}

export function SessionClient({
  sessionId,
  dayNumber,
  initialSets,
  priorBestE1rmByLiftId,
  initialStatus,
  initialStartedAt,
  initialPausedAt,
  initialPausedSeconds,
  restTargetWarmupSeconds,
  restTargetWorkSeconds,
}: {
  sessionId: string;
  dayNumber: number;
  initialSets: SetRow[];
  priorBestE1rmByLiftId: Record<string, number>;
  initialStatus: "pending" | "in_progress" | "completed";
  initialStartedAt: Date | null;
  initialPausedAt: Date | null;
  initialPausedSeconds: number;
  restTargetWarmupSeconds: number;
  restTargetWorkSeconds: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialSets);
  const [status, setStatus] = useState(initialStatus);
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const [pausedAt, setPausedAt] = useState(initialPausedAt);
  const [pausedSeconds, setPausedSeconds] = useState(initialPausedSeconds);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { weight: string; reps: string }>>({});
  const [errorId, setErrorId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [addSetError, setAddSetError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [customAccessoryDraft, setCustomAccessoryDraft] = useState("");
  const [addAccessoryError, setAddAccessoryError] = useState<string | null>(null);
  const [alertedAnchorMs, setAlertedAnchorMs] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasProgress = rows.some((r) => r.completedAt != null);
  const isPaused = pausedAt != null;
  const isRunning = status === "in_progress" && !isPaused;

  const now = useTickingNow(isRunning);
  // Freezes both timers at the exact moment pause began; otherwise ticks live.
  const clockMs = isPaused && pausedAt ? pausedAt.getTime() : now;

  const startedAtMs = startedAt ? startedAt.getTime() : null;
  const elapsedSeconds =
    startedAtMs == null ? null : Math.max(0, Math.floor((clockMs - startedAtMs) / 1000) - pausedSeconds);

  const lastCompletedMs = rows.reduce<number | null>((max, r) => {
    if (!r.completedAt) return max;
    const t = r.completedAt.getTime();
    return max == null || t > max ? t : max;
  }, null);
  const restAnchorMs = lastCompletedMs ?? startedAtMs;
  const restSeconds =
    restAnchorMs == null ? null : Math.max(0, Math.floor((clockMs - restAnchorMs) / 1000));

  const nextPending = rows.find((r) => r.completedAt == null);
  // Warm-ups get their own (shorter) target; work, assistance, and accessory
  // sets all share the work target.
  const restTargetSeconds =
    nextPending == null
      ? null
      : nextPending.setType === "warmup"
        ? restTargetWarmupSeconds
        : restTargetWorkSeconds;

  const isRestAlert = restTargetSeconds != null && restSeconds != null && restSeconds >= restTargetSeconds;

  useEffect(() => {
    if (restTargetSeconds == null || restSeconds == null || restAnchorMs == null) return;
    if (restSeconds >= restTargetSeconds && alertedAnchorMs !== restAnchorMs) {
      setAlertedAnchorMs(restAnchorMs);
      playRestAlert();
    }
  }, [restSeconds, restTargetSeconds, restAnchorMs, alertedAnchorMs]);

  function handleReset() {
    if (
      !confirm(
        "Reset this session? This clears every logged set back to blank and removes it from your feed if you already posted it."
      )
    ) {
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
      setStatus("pending");
      setStartedAt(null);
      setPausedAt(null);
      setPausedSeconds(0);
      setAlertedAnchorMs(null);
    });
  }

  function handleBegin() {
    setTimerError(null);
    startTransition(async () => {
      try {
        await beginSession(sessionId);
      } catch {
        setTimerError("Couldn't start the session -- try again.");
        return;
      }
      setStatus("in_progress");
      setStartedAt(new Date());
    });
  }

  // Starts the timer automatically the moment this session's page loads,
  // rather than requiring an explicit "Begin Workout" tap first -- opening
  // a day from the home page is the start of the workout. beginSession
  // itself no-ops if the session isn't still "pending" (e.g. a reload of
  // an already-started session), so this is safe to fire unconditionally.
  useEffect(() => {
    if (initialStatus === "pending") {
      handleBegin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePauseToggle() {
    setTimerError(null);
    const wasPaused = isPaused;
    startTransition(async () => {
      let result;
      try {
        result = wasPaused ? await resumeSession(sessionId) : await pauseSession(sessionId);
      } catch {
        setTimerError("Couldn't update the pause state -- try again.");
        return;
      }
      // Sync to whatever the server actually saved rather than guessing --
      // keeps the button correct even if it was already out of sync (a
      // stale cached page, another tab/device, etc.).
      setPausedAt(result.pausedAt);
      setPausedSeconds(result.pausedSeconds);
    });
  }

  function handleComplete() {
    const incompleteCount = rows.filter((r) => r.completedAt == null).length;
    if (incompleteCount > 0) {
      const noun = incompleteCount === 1 ? "set" : "sets";
      if (!confirm(`${incompleteCount} ${noun} still unfinished. Complete the session anyway?`)) {
        return;
      }
    }
    setCompleteError(null);
    startTransition(async () => {
      try {
        await completeSession(sessionId);
      } catch {
        setCompleteError("Couldn't complete the session -- try again.");
        return;
      }
      router.push(`/session/${sessionId}/results`);
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
      setAlertedAnchorMs(null);
    });
  }

  function handleAddSet(lastRowOfGroup: SetRow, setType: "main" | "accessory") {
    setAddSetError(null);
    startTransition(async () => {
      let newSet;
      try {
        newSet = await addExtraSet(sessionId, lastRowOfGroup.liftId, setType);
      } catch {
        setAddSetError("Couldn't add a set -- try again.");
        return;
      }
      setRows((prev) => {
        const insertAt = prev.findIndex((r) => r.id === lastRowOfGroup.id) + 1;
        const newRow: SetRow = {
          ...lastRowOfGroup,
          id: newSet.id,
          orderIndex: newSet.orderIndex,
          isAmrap: newSet.isAmrap,
          isExtra: true,
          targetWeight: newSet.targetWeight,
          targetReps: newSet.targetReps,
          intensityPercentage: newSet.intensityPercentage,
          actualWeight: null,
          actualReps: null,
          completedAt: null,
        };
        const next = [...prev];
        next.splice(insertAt, 0, newRow);
        return next;
      });
    });
  }

  function handleSwapLift(slot: SwapSlot, direction: "prev" | "next") {
    setSwapError(null);
    startTransition(async () => {
      let result;
      try {
        result = await swapGroupLift(sessionId, slot, direction);
      } catch (err) {
        setSwapError(err instanceof Error ? err.message : "Couldn't switch lifts -- try again.");
        return;
      }
      setRows((prev) => {
        const byId = new Map(result.updatedSets.map((u) => [u.id, u]));
        return prev.map((r) => {
          const u = byId.get(r.id);
          return u ? { ...r, ...u } : r;
        });
      });
    });
  }

  function handleAddCustomAccessory(name: string) {
    setAddAccessoryError(null);
    startTransition(async () => {
      let newRow;
      try {
        newRow = await addCustomAccessory(sessionId, name);
      } catch (err) {
        setAddAccessoryError(err instanceof Error ? err.message : "Couldn't add that accessory -- try again.");
        return;
      }
      setRows((prev) => [
        ...prev,
        {
          ...newRow,
          liftRole: newRow.liftRole as SetRow["liftRole"],
          equipmentType: newRow.equipmentType as SetRow["equipmentType"],
          setType: newRow.setType as SetRow["setType"],
          actualWeight: null,
          actualReps: null,
          completedAt: null,
        },
      ]);
      setCustomAccessoryDraft("");
    });
  }

  function handleRemoveSet(row: SetRow) {
    if (!row.isExtra && !confirm("Remove this set? This can't be undone.")) {
      return;
    }
    setAddSetError(null);
    startTransition(async () => {
      try {
        await removeSet(row.id);
      } catch {
        setAddSetError("Couldn't remove that set -- try again.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  let lastGroupKey = "";

  return (
    <div className="flex flex-col gap-3">
      <p className="-mt-3 text-sm font-bold opacity-70">
        {isPaused ? "paused" : status.replace("_", " ")}
      </p>
      <InolWidget sets={rows} />
      <div
        className={`${CARD_CLASS} flex flex-col gap-2 p-4 transition-colors ${
          isPaused ? "bg-brutal-white" : isRestAlert ? "bg-brutal-red" : "bg-brutal-cyan"
        }`}
      >
        {isPaused && <p className="text-xs font-bold uppercase tracking-wide">⏸ Paused</p>}
        <div className="flex justify-between text-sm font-bold">
          <span>Elapsed</span>
          <span className="font-mono text-lg">
            {elapsedSeconds != null ? formatDuration(elapsedSeconds) : "--:--"}
          </span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>Rest</span>
          <span className="font-mono text-lg">
            {restSeconds != null ? formatDuration(restSeconds) : "--:--"}
            {restTargetSeconds != null ? ` / ${formatDuration(restTargetSeconds)}` : ""}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        {status === "in_progress" && (
          <button
            type="button"
            disabled={isPending}
            onClick={handlePauseToggle}
            className={`flex-1 py-3 text-base ${isPaused ? SUCCESS_BUTTON_CLASS : BUTTON_CLASS}`}
          >
            {isPaused ? "Resume Workout" : "Pause Workout"}
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={handleComplete}
          className={`flex-1 py-3 text-base ${PINK_BUTTON_CLASS}`}
        >
          Complete Session
        </button>
        {(hasProgress || status !== "pending") && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleReset}
            className={`flex-1 py-3 text-base ${DANGER_BUTTON_CLASS}`}
          >
            Reset Session
          </button>
        )}
      </div>
      {timerError && (
        <p className={`${CARD_CLASS} bg-brutal-white p-2 text-xs font-bold text-red-600`}>
          {timerError}
        </p>
      )}
      {resetError && (
        <p className={`${CARD_CLASS} bg-brutal-white p-2 text-xs font-bold text-red-600`}>
          {resetError}
        </p>
      )}
      {completeError && (
        <p className={`${CARD_CLASS} bg-brutal-white p-2 text-xs font-bold text-red-600`}>
          {completeError}
        </p>
      )}
      {addSetError && (
        <p className={`${CARD_CLASS} bg-brutal-white p-2 text-xs font-bold text-red-600`}>
          {addSetError}
        </p>
      )}
      {swapError && (
        <p className={`${CARD_CLASS} bg-brutal-white p-2 text-xs font-bold text-red-600`}>
          {swapError}
        </p>
      )}

      {rows.map((row, index) => {
        const groupKey = `${row.liftId}:${row.setType}`;
        const showHeader = groupKey !== lastGroupKey;
        lastGroupKey = groupKey;

        const isDone = row.completedAt != null;
        const isEditing = editingId === row.id || !isDone;
        const draft = draftFor(row);

        // Live "reps needed for a PR" hint on an AMRAP set's dedicated
        // reps panel, based on the weight currently entered.
        const priorBest = priorBestE1rmByLiftId[row.liftId];
        const draftWeightNum = Number(draft.weight);
        const amrapNeededReps =
          row.isAmrap && isEditing && priorBest != null && draft.weight !== "" && !Number.isNaN(draftWeightNum) && draftWeightNum > 0
            ? calcRepsNeededForPr(draftWeightNum, priorBest)
            : null;

        const nextRow = rows[index + 1];
        const isLastOfGroup = nextRow == null || `${nextRow.liftId}:${nextRow.setType}` !== groupKey;
        const canAddExtra = isLastOfGroup && (row.setType === "main" || row.setType === "accessory");

        // Warm-Up + Work Sets always share one lift ("main" slot) -- the
        // arrows live only on the Work Sets header, and swapping there
        // moves both groups' rows together in one action call.
        const slot: SwapSlot | null =
          row.setType === "main" ? "main" : row.setType === "assistance" ? "assistance" : null;
        const swapPool = slot ? getSwapPool(dayNumber, slot) : [];
        const slotSetTypes = slot === "main" ? ["warmup", "main"] : ["assistance"];
        const slotLocked =
          slot != null &&
          rows.some((r) => r.liftId === row.liftId && slotSetTypes.includes(r.setType) && r.completedAt != null);
        const canSwap = slot != null && swapPool.length > 1 && !slotLocked;

        return (
          <div key={row.id}>
            {showHeader && (
              <h2 className={`${PILL_CLASS} mb-2 mt-3 inline-flex items-center gap-2 bg-brutal-white`}>
                {canSwap && (
                  <button
                    type="button"
                    aria-label="Previous lift"
                    disabled={isPending}
                    onClick={() => handleSwapLift(slot!, "prev")}
                    className="font-bold opacity-60 hover:opacity-100"
                  >
                    ◀
                  </button>
                )}
                <span>
                  {row.liftName} — {SET_TYPE_LABEL[row.setType]}
                </span>
                {canSwap && (
                  <button
                    type="button"
                    aria-label="Next lift"
                    disabled={isPending}
                    onClick={() => handleSwapLift(slot!, "next")}
                    className="font-bold opacity-60 hover:opacity-100"
                  >
                    ▶
                  </button>
                )}
              </h2>
            )}
            <div
              className={`${CARD_CLASS} flex items-center justify-between gap-2 p-3 ${
                isDone ? "bg-brutal-white opacity-60" : "bg-brutal-white"
              }`}
            >
              <div className="text-sm">
                {row.targetWeight != null ? (
                  <>
                    <span className="font-bold">
                      {fmt(row.targetWeight)} lb{row.equipmentType === "dumbbell" ? " (each)" : ""} ×{" "}
                      {row.targetReps}
                      {row.isAmrap ? "+" : ""}
                    </span>
                    {row.equipmentType === "barbell" &&
                      (() => {
                        // Always the full per-side breakdown to load this
                        // set's weight from an empty 45 lb bar -- not a
                        // delta from whatever the previous set was.
                        const breakdown = calcPlateBreakdown(Number(row.targetWeight));
                        return (
                          <div className="text-xs font-medium opacity-70">
                            {breakdown.belowBarWeight
                              ? "Below an empty bar (45 lb) -- use just the bar"
                              : formatPlateBreakdown(breakdown.perSide)}
                          </div>
                        );
                      })()}
                  </>
                ) : row.targetReps != null ? (
                  <span className="font-medium opacity-70">
                    New lift, no history yet — log your own weight × {row.targetReps}
                    {row.isAmrap ? "+" : ""} reps
                  </span>
                ) : (
                  <span className="font-medium opacity-70">
                    Freeform — log your own weight &amp; reps
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="lb"
                    className={`${COMPACT_INPUT_CLASS} w-16 text-sm`}
                    value={draft.weight}
                    onChange={(e) => updateDraft(row, "weight", e.target.value)}
                  />
                  {!row.isAmrap && (
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="reps"
                      className={`${COMPACT_INPUT_CLASS} w-14 text-sm`}
                      value={draft.reps}
                      onChange={(e) => updateDraft(row, "reps", e.target.value)}
                    />
                  )}
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
                  className={`${PILL_CLASS} flex items-center gap-2 bg-brutal-green`}
                >
                  <span>
                    ✓ {row.actualWeight != null ? `${fmt(row.actualWeight)} lb × ` : ""}
                    {row.actualReps}
                  </span>
                  <span className="opacity-70">Edit</span>
                </button>
              )}
              {row.setType !== "warmup" && (
                <button
                  type="button"
                  aria-label="Remove set"
                  disabled={isPending}
                  onClick={() => handleRemoveSet(row)}
                  className="shrink-0 text-lg font-bold leading-none opacity-50 hover:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
            {row.isAmrap && isEditing && (
              <div
                className={`${CARD_CLASS} mt-2 flex items-center justify-between gap-3 bg-brutal-pink p-3`}
              >
                <span className="text-sm font-bold uppercase tracking-wide">AMRAP</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="reps"
                    className={`${COMPACT_INPUT_CLASS} w-16 text-center text-lg font-bold`}
                    value={draft.reps}
                    onChange={(e) => updateDraft(row, "reps", e.target.value)}
                  />
                  <span className="text-sm font-bold">reps</span>
                </div>
                <span className="text-sm font-bold">
                  PR: {amrapNeededReps ?? "—"}
                </span>
              </div>
            )}
            {errorId === row.id && (
              <p className="mt-1 text-xs font-bold text-red-600">Enter a valid rep count.</p>
            )}
            {canAddExtra && (
              <div
                className={`${CARD_CLASS} mt-2 flex items-center justify-between bg-brutal-white p-2`}
              >
                <span className="text-xs font-bold uppercase tracking-wide opacity-70">
                  Extra Sets
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAddSet(row, row.setType as "main" | "accessory")}
                  className={`px-3 py-1 text-xs ${BUTTON_CLASS}`}
                >
                  + Add
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className={`${CARD_CLASS} mt-3 flex flex-col gap-2 bg-brutal-white p-3`}>
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-70">Add Accessory</h2>
        <div className="flex flex-wrap gap-2">
          {ACCESSORY_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={isPending}
              onClick={() => handleAddCustomAccessory(suggestion)}
              className={`${PILL_CLASS} bg-brutal-yellow`}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className={`${INPUT_CLASS} flex-1 text-sm`}
            placeholder="Custom accessory..."
            value={customAccessoryDraft}
            onChange={(e) => setCustomAccessoryDraft(e.target.value)}
          />
          <button
            type="button"
            disabled={isPending || !customAccessoryDraft.trim()}
            onClick={() => handleAddCustomAccessory(customAccessoryDraft)}
            className={`px-3 text-sm ${BUTTON_CLASS}`}
          >
            Add
          </button>
        </div>
        {addAccessoryError && (
          <p className="text-xs font-bold text-red-600">{addAccessoryError}</p>
        )}
      </div>
    </div>
  );
}
