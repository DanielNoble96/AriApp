"use server";

import { eq, and, count } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { diaryEntries, diaryPhotos } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

const MAX_DIARY_PHOTOS = 3;
const MAX_NOTE_LENGTH = 600;

function pathnameFromPhotoUrl(photoUrl: string): string | null {
  return new URL(photoUrl, "http://internal").searchParams.get("pathname");
}

function cleanWeight(weightLbs: number | null): string | null {
  if (weightLbs == null) return null;
  if (!Number.isFinite(weightLbs) || weightLbs <= 0 || weightLbs >= 1000) {
    throw new Error("Enter a valid weight.");
  }
  return String(Math.round(weightLbs * 10) / 10);
}

function cleanNote(note: string | null): string | null {
  const trimmed = note?.trim() ?? "";
  if (trimmed.length > MAX_NOTE_LENGTH) throw new Error("Note is too long.");
  return trimmed || null;
}

async function loadOwnedEntry(entryId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");
  const [entry] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, entryId));
  if (!entry) throw new Error("Entry not found.");
  if (entry.userId !== user.id) throw new Error("Forbidden");
  return { user, entry };
}

export async function createDiaryEntry(input: {
  entryDate: string;
  weightLbs: number | null;
  note: string | null;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) throw new Error("Pick a valid date.");

  const [entry] = await db
    .insert(diaryEntries)
    .values({
      userId: user.id,
      entryDate: input.entryDate,
      weightLbs: cleanWeight(input.weightLbs),
      note: cleanNote(input.note),
    })
    .returning();
  return { id: entry.id };
}

export async function updateDiaryEntry(
  entryId: string,
  input: { weightLbs: number | null; note: string | null }
) {
  await loadOwnedEntry(entryId);
  await db
    .update(diaryEntries)
    .set({ weightLbs: cleanWeight(input.weightLbs), note: cleanNote(input.note) })
    .where(eq(diaryEntries.id, entryId));
}

export async function deleteDiaryEntry(entryId: string) {
  await loadOwnedEntry(entryId);
  const photos = await db.select().from(diaryPhotos).where(eq(diaryPhotos.entryId, entryId));
  for (const photo of photos) {
    const pathname = pathnameFromPhotoUrl(photo.photoUrl);
    if (pathname) await del(pathname).catch(() => {});
  }
  await db.delete(diaryEntries).where(eq(diaryEntries.id, entryId));
}

/** Records a photo the browser already uploaded straight to Blob storage. */
export async function confirmDiaryPhoto(entryId: string, pathname: string) {
  await loadOwnedEntry(entryId);
  if (!pathname.startsWith(`diary-photos/${entryId}`)) throw new Error("Invalid photo.");

  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(diaryPhotos)
    .where(eq(diaryPhotos.entryId, entryId));
  if (existing >= MAX_DIARY_PHOTOS) {
    throw new Error(`You can only add up to ${MAX_DIARY_PHOTOS} photos.`);
  }

  const photoUrl = `/api/photos?pathname=${encodeURIComponent(pathname)}`;
  const [photo] = await db.insert(diaryPhotos).values({ entryId, photoUrl }).returning();
  return { id: photo.id, photoUrl };
}

export async function removeDiaryPhoto(photoId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [row] = await db
    .select({ photo: diaryPhotos, ownerId: diaryEntries.userId })
    .from(diaryPhotos)
    .innerJoin(diaryEntries, eq(diaryPhotos.entryId, diaryEntries.id))
    .where(eq(diaryPhotos.id, photoId));
  if (!row) throw new Error("Photo not found.");
  if (row.ownerId !== user.id) throw new Error("Forbidden");

  const pathname = pathnameFromPhotoUrl(row.photo.photoUrl);
  if (pathname) await del(pathname).catch(() => {});
  await db.delete(diaryPhotos).where(and(eq(diaryPhotos.id, photoId)));
}
