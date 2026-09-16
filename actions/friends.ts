"use server";

import { eq, and, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendRequests } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

/**
 * Sends a friend request, unless one already exists between these two
 * users: an accepted row means already friends; a pending row the caller
 * sent means it's a duplicate; a pending row the OTHER person already sent
 * is accepted here instead of inserting a second, reverse-direction row.
 */
export async function sendFriendRequest(addresseeUserId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");
  if (user.id === addresseeUserId) throw new Error("You can't friend yourself.");

  const [existing] = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.requesterId, user.id), eq(friendRequests.addresseeId, addresseeUserId)),
        and(eq(friendRequests.requesterId, addresseeUserId), eq(friendRequests.addresseeId, user.id))
      )
    );

  if (existing) {
    if (existing.status === "accepted") {
      throw new Error("You're already friends.");
    }
    if (existing.requesterId === user.id) {
      throw new Error("Friend request already sent.");
    }
    await db.update(friendRequests).set({ status: "accepted" }).where(eq(friendRequests.id, existing.id));
    return;
  }

  await db.insert(friendRequests).values({ requesterId: user.id, addresseeId: addresseeUserId });
}

export async function acceptFriendRequest(requestId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [request] = await db.select().from(friendRequests).where(eq(friendRequests.id, requestId));
  if (!request) throw new Error("Request not found.");
  if (request.addresseeId !== user.id) throw new Error("Forbidden");

  await db.update(friendRequests).set({ status: "accepted" }).where(eq(friendRequests.id, requestId));
}

/** Declining just deletes the row -- a fresh request can be sent again later. */
export async function declineFriendRequest(requestId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [request] = await db.select().from(friendRequests).where(eq(friendRequests.id, requestId));
  if (!request) throw new Error("Request not found.");
  if (request.addresseeId !== user.id) throw new Error("Forbidden");

  await db.delete(friendRequests).where(eq(friendRequests.id, requestId));
}
