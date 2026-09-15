"use client";

import { useRef, useState } from "react";
import { calcTotalInol, getInolTier, type InolSetInput, type InolTier } from "@/lib/inol";
import { BORDER_CLASS, SHADOW_CLASS } from "@/lib/ui";

const TIER_BG: Record<InolTier, string> = {
  low: "bg-brutal-white",
  optimal: "bg-brutal-cyan",
  heavy: "bg-brutal-pink",
};

/** A draggable floating widget showing the session's running INOL score. */
export function InolWidget({ sets }: { sets: InolSetInput[] }) {
  const [position, setPosition] = useState({ x: 16, y: 96 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );

  const inol = calcTotalInol(sets);
  const tier = getInolTier(inol);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPosition({ x: dragState.current.originX + dx, y: dragState.current.originY + dy });
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ position: "fixed", left: position.x, top: position.y, touchAction: "none" }}
      className={`${BORDER_CLASS} ${SHADOW_CLASS} z-50 cursor-grab select-none rounded-2xl px-4 py-2 text-center active:cursor-grabbing ${TIER_BG[tier]}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">INOL</div>
      <div className="text-2xl font-bold leading-none">{inol.toFixed(2)}</div>
    </div>
  );
}
