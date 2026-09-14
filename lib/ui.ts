// Shared Tailwind class strings for form inputs/buttons. Centralized because
// the same "invisible button in dark mode" bug (hardcoded bg-black with no
// dark: variant) showed up everywhere these were duplicated inline.
export const INPUT_CLASS =
  "rounded border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 px-3 py-2 placeholder:text-black/40 dark:placeholder:text-white/40";

export const BUTTON_CLASS =
  "rounded bg-black text-white dark:bg-white dark:text-black font-semibold disabled:opacity-50";
