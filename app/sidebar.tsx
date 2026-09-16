"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { BORDER_CLASS, SHADOW_CLASS, SHADOW_SM_CLASS } from "@/lib/ui";

// Same 5 colors as CANDY_BG_CLASSES, one per petal, in the same order.
const PETAL_COLORS = ["#f2716a", "#b28cf5", "#f472b6", "#5cd9e8", "#86efac"];

function FlowerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {PETAL_COLORS.map((color, i) => (
        <g key={color} transform={`rotate(${i * 72} 50 50)`}>
          <ellipse cx="50" cy="28" rx="17" ry="23" fill={color} stroke="#0a0a0a" strokeWidth="4" />
        </g>
      ))}
      <circle cx="50" cy="50" r="13" fill="#ffffff" stroke="#0a0a0a" strokeWidth="4" />
    </svg>
  );
}

const LINKS = [
  { href: "/cycle/setup", label: "New Cycle", bg: "bg-brutal-yellow" },
  { href: "/profile", label: "Profile", bg: "bg-brutal-purple" },
  { href: "/about", label: "About", bg: "bg-brutal-green" },
];

/** Collapsible flower-icon menu holding the less-frequent nav destinations. */
export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [rotation, setRotation] = useState(0);

  function handleToggle() {
    // Always spins forward a full turn on click, open or close -- no reset
    // needed between clicks since the angle just keeps accumulating.
    setRotation((r) => r + 360);
    setIsOpen((open) => !open);
  }

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        onClick={handleToggle}
        className="h-11 w-11 shrink-0 cursor-pointer"
        style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.6s ease" }}
      >
        <FlowerIcon className="h-full w-full" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-brutal-black/30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`${BORDER_CLASS} ${SHADOW_CLASS} fixed left-0 top-0 z-50 flex h-full w-64 flex-col gap-2 bg-brutal-white p-4 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-[110%]"
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <FlowerIcon className="h-10 w-10" />
          <h2 className="text-xl font-bold">Menu</h2>
        </div>

        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setIsOpen(false)}
            className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} rounded-lg ${link.bg} px-3 py-2 text-sm font-bold`}
          >
            {link.label}
          </Link>
        ))}

        <form action={logout}>
          <button
            type="submit"
            className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} w-full rounded-lg bg-brutal-cyan px-3 py-2 text-left text-sm font-bold`}
          >
            Log Out
          </button>
        </form>
      </div>
    </>
  );
}
