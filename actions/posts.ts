"use server";

import { eq, count } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { posts, postPhotos } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function updatePostCaption(postId: string, caption: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new Error("Post not found.");
  if (post.userId !== user.id) throw new Error("Forbidden");

  const trimmed = caption.trim();
  await db.update(posts).set({ caption: trimmed || null }).where(eq(posts.id, postId));
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_PHOTOS_PER_POST = 3;

/** Pulls the Blob pathname back out of the app/api/photos serving URL stored on a photo row. */
function pathnameFromPhotoUrl(photoUrl: string): string | null {
  return new URL(photoUrl, "http://internal").searchParams.get("pathname");
}

/** Adds a photo to a post, up to MAX_PHOTOS_PER_POST. */
export async function uploadPostPhoto(postId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new Error("Post not found.");
  if (post.userId !== user.id) throw new Error("Forbidden");

  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(postPhotos)
    .where(eq(postPhotos.postId, postId));
  if (existingCount >= MAX_PHOTOS_PER_POST) {
    throw new Error(`You can only add up to ${MAX_PHOTOS_PER_POST} photos.`);
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No photo provided.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Image must be under 8MB.");
  }

  // The Blob store is private (locked in at creation, can't be switched to
  // public), so the stored "photoUrl" is actually our own serving route
  // (app/api/photos/route.ts), not the blob's own URL -- that route reads
  // it back from the store server-side with the token, using this pathname.
  const blob = await put(`post-photos/${postId}`, file, {
    access: "private",
    addRandomSuffix: true,
  });

  const photoUrl = `/api/photos?pathname=${encodeURIComponent(blob.pathname)}`;
  const [photo] = await db.insert(postPhotos).values({ postId, photoUrl }).returning();
  return { id: photo.id, photoUrl };
}

/** Removes one photo from a post (any owner-added photo, not just the last one). */
export async function removePostPhoto(photoId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [row] = await db
    .select({ photo: postPhotos, postUserId: posts.userId })
    .from(postPhotos)
    .innerJoin(posts, eq(postPhotos.postId, posts.id))
    .where(eq(postPhotos.id, photoId));
  if (!row) throw new Error("Photo not found.");
  if (row.postUserId !== user.id) throw new Error("Forbidden");

  const pathname = pathnameFromPhotoUrl(row.photo.photoUrl);
  if (pathname) {
    await del(pathname).catch(() => {}); // best-effort -- don't block removal on storage errors
  }

  await db.delete(postPhotos).where(eq(postPhotos.id, photoId));
}
