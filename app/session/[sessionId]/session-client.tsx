"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeSet } from "@/actions/sets";
import { resetSession, completeSession, beginSession, pauseSession, resumeSession } from "@/actions/sessions";
import { calcPlateBreakdown, formatPlateBreakdown } from "@/lib/plates";
import {
  BUTTON_CLASS,
  DANGER_BUTTON_CLASS,
  SUCCESS_BUTTON_CLASS,
  PINK_BUTTON_CLASS,
  CARD_CLASS,
  PILL_CLASS,
  COMPACT_INPUT_CLASS,
} from "@/lib/ui";

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
  initialSets,
  initialStatus,
  initialStartedAt,
  initialPausedAt,
  initialPausedSeconds,
  restTargetWarmupSeconds,
  restTargetWorkSeconds,
}: {
  sessionId: string;
  initialSets: SetRow[];
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

  function handlePauseToggle() {
    setTimerError(null);
    const wasPaused = isPaused;
    const pauseStartedAt = pausedAt;
    startTransition(async () => {
      try {
        if (wasPaused) {
          await resumeSession(sessionId);
        } else {
          await pauseSession(sessionId);
        }
      } catch {
        setTimerError("Couldn't update the pause state -- try again.");
        return;
      }
      if (wasPaused) {
        const pausedDuration = pauseStartedAt
          ? Math.max(0, Math.floor((Date.now() - pauseStartedAt.getTime()) / 1000))
          : 0;
        setPausedSeconds((prev) => prev + pausedDuration);
        setPausedAt(null);
      } else {
        setPausedAt(new Date());
      }
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
      router.push("/");
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

  let lastGroupKey = "";

  return (
    <div className="flex flex-col gap-3">
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

      {status === "pending" && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={handleBegin}
            className={`flex-1 py-3 text-base ${SUCCESS_BUTTON_CLASS}`}
          >
            Begin Workout
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleComplete}
            className={`flex-1 py-3 text-base ${PINK_BUTTON_CLASS}`}
          >
            Complete Session
          </button>
        </div>
      )}
      {status === "in_progress" && (
        <button
          type="button"
          disabled={isPending}
          onClick={handlePauseToggle}
          className={`w-full py-3 text-base ${isPaused ? SUCCESS_BUTTON_CLASS : BUTTON_CLASS}`}
        >
          {isPaused ? "Resume Workout" : "Pause Workout"}
        </button>
      )}
      {timerError && (
        <p className={`${CARD_CLASS} bg-brutal-white p-2 text-xs font-bold text-red-600`}>
          {timerError}
        </p>
      )}

      {(hasProgress || status !== "pending") && (
        <div className="flex items-center justify-between gap-3">
          {hasProgress ? (
            <button
              type="button"
              disabled={isPending}
              onClick={handleReset}
              className={`px-3 py-2 text-sm ${DANGER_BUTTON_CLASS}`}
            >
              Reset Session
            </button>
          ) : (
            <span />
          )}
          {status !== "pending" && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleComplete}
              className={`px-4 py-2 text-sm ${PINK_BUTTON_CLASS}`}
            >
              Complete Session
            </button>
          )}
        </div>
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
              <h2 className={`${PILL_CLASS} mb-2 mt-3 inline-block bg-brutal-white`}>
                {row.liftName} — {SET_TYPE_LABEL[row.setType]}
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
                        const breakdown = calcPlateBreakdown(Number(row.targetWeight));
                        return (
                          <div className="text-xs font-medium opacity-70">
                            {breakdown.belowBarWeight
                              ? "Below an empty bar (45 lb) -- use just the bar"
                              : `${formatPlateBreakdown(breakdown.perSide)} / side`}
                          </div>
                        );
                      })()}
                  </>
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
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="reps"
                    className={`${COMPACT_INPUT_CLASS} w-14 text-sm`}
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
                  className={`${PILL_CLASS} flex items-center gap-2 bg-brutal-green`}
                >
                  <span>
                    ✓ {row.actualWeight != null ? `${fmt(row.actualWeight)} lb × ` : ""}
                    {row.actualReps}
                  </span>
                  <span className="opacity-70">Edit</span>
                </button>
              )}
            </div>
            {errorId === row.id && (
              <p className="mt-1 text-xs font-bold text-red-600">Enter a valid rep count.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
