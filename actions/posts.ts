"use server";

import { eq, count } from "drizzle-orm";
import { del } from "@vercel/blob";
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

const MAX_PHOTOS_PER_POST = 3;

/** Pulls the Blob pathname back out of the app/api/photos serving URL stored on a photo row. */
function pathnameFromPhotoUrl(photoUrl: string): string | null {
  return new URL(photoUrl, "http://internal").searchParams.get("pathname");
}

/**
 * Records a photo the browser already uploaded directly to Blob storage
 * (see app/api/photos/upload-handler/route.ts) -- this only ever receives
 * a pathname, never the file bytes, so it isn't subject to the serverless
 * function body-size limit a direct file upload here would hit.
 */
export async function confirmPostPhoto(postId: string, pathname: string) {
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

  const photoUrl = `/api/photos?pathname=${encodeURIComponent(pathname)}`;
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
