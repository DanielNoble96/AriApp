"use server";

import { cookies } from "next/headers";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userSessions } from "@/lib/db/schema";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { USERNAME_PATTERN } from "@/lib/constants";

type ProfileResult = { success: true } | { success: false; error: string };

export async function updateUsername(newUsername: string): Promise<ProfileResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not signed in." };

  const normalized = newUsername.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      success: false,
      error: "Username must be 3-20 characters: lowercase letters, numbers, and underscores only.",
    };
  }

  const [taken] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, normalized), ne(users.id, user.id)));
  if (taken) {
    return { success: false, error: "That username is taken." };
  }

  await db.update(users).set({ username: normalized }).where(eq(users.id, user.id));
  return { success: true };
}

export async function updateEmail(newEmail: string, currentPassword: string): Promise<ProfileResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not signed in." };
  if (!user.passwordHash) return { success: false, error: "Account has no password set." };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: "Incorrect password." };

  const normalized = newEmail.trim();
  if (!normalized || !normalized.includes("@")) {
    return { success: false, error: "Enter a valid email address." };
  }

  const [taken] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, normalized), ne(users.id, user.id)));
  if (taken) {
    return { success: false, error: "That email is already in use." };
  }

  await db.update(users).set({ email: normalized }).where(eq(users.id, user.id));
  return { success: true };
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<ProfileResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not signed in." };
  if (!user.passwordHash) return { success: false, error: "Account has no password set." };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: "Incorrect password." };

  if (newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." };
  }

  const newHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  // Invalidate any other signed-in sessions -- an old stolen cookie
  // shouldn't survive a password change. The current session (this browser)
  // is kept so the user isn't logged out by changing their own password.
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (currentToken) {
    await db
      .delete(userSessions)
      .where(and(eq(userSessions.userId, user.id), ne(userSessions.id, currentToken)));
  }

  return { success: true };
}
