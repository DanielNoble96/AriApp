// Shared neobrutalist style primitives: thick black borders, hard offset
// (unblurred) drop-shadows, bold rounded shapes. Centralized so every
// screen stays visually consistent rather than redefining these per file.

export const BORDER_CLASS = "border-[3px] border-brutal-black";
export const SHADOW_CLASS = "shadow-[4px_4px_0_0_#0a0a0a]";
export const SHADOW_SM_CLASS = "shadow-[2px_2px_0_0_#0a0a0a]";

/** A block/panel: thick border, hard shadow, rounded corners. Pass a bg-* class for its color. */
export const CARD_CLASS = `${BORDER_CLASS} ${SHADOW_CLASS} rounded-2xl`;

export const INPUT_CLASS =
  `${BORDER_CLASS} rounded-lg bg-brutal-white px-3 py-2 font-medium text-brutal-black placeholder:text-brutal-black/40 focus:outline-none`;

/** Same as INPUT_CLASS but tighter padding, right-aligned -- for small inline number fields. */
export const COMPACT_INPUT_CLASS =
  `${BORDER_CLASS} rounded-lg bg-brutal-white px-2 py-1 text-right font-bold text-brutal-black focus:outline-none`;

/** Presses down (shadow disappears, shifts toward the surface) on tap -- the classic neobrutalist button feel. */
export const BUTTON_CLASS =
  `${BORDER_CLASS} ${SHADOW_CLASS} rounded-lg bg-brutal-yellow font-bold text-brutal-black transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50`;

/** Same press mechanics as BUTTON_CLASS, red -- for destructive actions (e.g. Reset Session). */
export const DANGER_BUTTON_CLASS =
  `${BORDER_CLASS} ${SHADOW_CLASS} rounded-lg bg-brutal-red font-bold text-brutal-black transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50`;

/** Same press mechanics as BUTTON_CLASS, green -- for positive/completion actions. */
export const SUCCESS_BUTTON_CLASS =
  `${BORDER_CLASS} ${SHADOW_CLASS} rounded-lg bg-brutal-green font-bold text-brutal-black transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50`;

export const PILL_CLASS =
  `${BORDER_CLASS} inline-flex items-center justify-center whitespace-nowrap rounded-full bg-brutal-white px-3 py-1 text-sm font-bold text-brutal-black`;

/** Rotating background colors for day/section cards. */
export const CANDY_BG_CLASSES = [
  "bg-brutal-red",
  "bg-brutal-purple",
  "bg-brutal-pink",
  "bg-brutal-cyan",
  "bg-brutal-green",
];
