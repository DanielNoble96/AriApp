"use server";

import { eq } from "drizzle-orm";
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

// uploadPostPhoto is added once Vercel Blob storage is connected.
