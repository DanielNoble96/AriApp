// Kept in its own file with zero other imports so proxy.ts can share this
// constant without pulling in lib/auth.ts's DB client / next/headers usage.
export const SESSION_COOKIE_NAME = "session";
