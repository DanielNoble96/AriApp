"use server";

import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
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

/**
 * Adds a photo to a post -- only ever set once. There's no "change photo"
 * flow yet, so the UI only offers this while photoUrl is still null.
 */
export async function uploadPostPhoto(postId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new Error("Post not found.");
  if (post.userId !== user.id) throw new Error("Forbidden");

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

  const blob = await put(`post-photos/${postId}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await db.update(posts).set({ photoUrl: blob.url }).where(eq(posts.id, postId));
  return { photoUrl: blob.url };
}
