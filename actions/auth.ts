"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword, createSession, destroySession } from "@/lib/auth";
import { seedProgramForUser } from "@/lib/db/seed-user";

type AuthResult = { success: true } | { success: false; error: string };

function isAllowedEmail(email: string): boolean {
  const allowlist = (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// TODO: no email verification -- signup trusts whatever email is typed in,
// with no confirmation link sent. Security currently relies entirely on the
// allowlist + password. Fine for a small group of trusted people; revisit
// (needs an email-sending service like Resend) if that stops being true.
export async function signup(
  email: string,
  password: string,
  name: string,
  username: string
): Promise<AuthResult> {
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }
  if (!isAllowedEmail(email)) {
    return { success: false, error: "This email isn't approved for signup." };
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  const passwordHash = await hashPassword(password);

  if (existing) {
    if (existing.passwordHash) {
      return { success: false, error: "An account with this email already exists. Log in instead." };
    }
    // Claim flow: attach a password to a pre-existing, unclaimed account
    // (e.g. the originally seeded user), preserving all of its data. The
    // account already has a username from the backfill -- the submitted
    // one is ignored here on purpose.
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
    await createSession(existing.id);
    return { success: true };
  }

  const normalizedUsername = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return {
      success: false,
      error: "Username must be 3-20 characters: lowercase letters, numbers, and underscores only.",
    };
  }
  const [usernameTaken] = await db.select().from(users).where(eq(users.username, normalizedUsername));
  if (usernameTaken) {
    return { success: false, error: "That username is taken." };
  }

  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash, username: normalizedUsername })
    .returning();
  await seedProgramForUser(user.id);
  await createSession(user.id);
  return { success: true };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.passwordHash) {
    return { success: false, error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: "Invalid email or password." };
  }

  await createSession(user.id);
  return { success: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  // Safe to redirect() here (unlike the actions called from client
  // components elsewhere in the app): this is bound directly to a plain
  // <form action={logout}>, not wrapped in a client-side try/catch that
  // would misinterpret the throw as a failure.
  redirect("/login");
}
