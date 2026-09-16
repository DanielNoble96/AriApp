"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments, posts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getFriendIds } from "@/lib/db/social-queries";

/** Only the post's owner or their accepted friends may comment -- matches feed visibility. */
export async function addComment(postId: string, body: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment can't be empty.");

  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new Error("Post not found.");

  if (post.userId !== user.id) {
    const friendIds = await getFriendIds(user.id);
    if (!friendIds.includes(post.userId)) throw new Error("Forbidden");
  }

  const [comment] = await db.insert(comments).values({ postId, userId: user.id, body: trimmed }).returning();
  return comment;
}
