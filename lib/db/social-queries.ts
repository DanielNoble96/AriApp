import { eq, and, or, ne, inArray, ilike, desc, asc, isNotNull } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  friendRequests,
  sets,
  sessions,
  posts,
  postPhotos,
  postPrs,
  comments,
  programDays,
  accessoryDayEntries,
} from "./schema";
import { calcEstimated1Rm } from "@/lib/prs";
import type { AccessoryActivityType } from "@/lib/constants";

/** Accepted friend rows in either direction, returning the *other* party's id. */
export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendRequests.requesterId, addresseeId: friendRequests.addresseeId })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "accepted"),
        or(eq(friendRequests.requesterId, userId), eq(friendRequests.addresseeId, userId))
      )
    );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/** Incoming pending requests, joined to the requester's identity. */
export async function getPendingRequestsForUser(userId: string) {
  return db
    .select({
      id: friendRequests.id,
      requesterId: friendRequests.requesterId,
      requesterUsername: users.username,
      requesterName: users.name,
      createdAt: friendRequests.createdAt,
    })
    .from(friendRequests)
    .innerJoin(users, eq(users.id, friendRequests.requesterId))
    .where(and(eq(friendRequests.addresseeId, userId), eq(friendRequests.status, "pending")))
    .orderBy(desc(friendRequests.createdAt));
}

export type FriendStatus = "none" | "pending-sent" | "pending-received" | "friends";

export interface UserSearchResult {
  id: string;
  username: string;
  name: string | null;
  status: FriendStatus;
}

/** Username search (excluding self), each result labeled with the caller's relationship to it. */
export async function searchUsersByUsername(
  query: string,
  excludeUserId: string
): Promise<UserSearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const matches = await db
    .select({ id: users.id, username: users.username, name: users.name })
    .from(users)
    .where(and(ilike(users.username, `%${trimmed}%`), ne(users.id, excludeUserId)))
    .limit(20);

  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);
  const relevantRequests = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.requesterId, excludeUserId), inArray(friendRequests.addresseeId, matchIds)),
        and(eq(friendRequests.addresseeId, excludeUserId), inArray(friendRequests.requesterId, matchIds))
      )
    );

  return matches.map((m) => {
    const req = relevantRequests.find((r) => r.requesterId === m.id || r.addresseeId === m.id);
    let status: FriendStatus = "none";
    if (req) {
      if (req.status === "accepted") status = "friends";
      else status = req.requesterId === excludeUserId ? "pending-sent" : "pending-received";
    }
    return { id: m.id, username: m.username!, name: m.name, status };
  });
}

/**
 * The best estimated 1RM among every prior completed "main" set for each of
 * the given lifts, excluding the current session -- computed in JS (one
 * query for all lifts) to match calcTotalInol's existing "fetch, then
 * reduce in TS" style rather than doing the aggregation in SQL.
 */
export async function getPriorBestE1rmByLift(
  userId: string,
  liftIds: string[],
  excludeSessionId: string
): Promise<Map<string, number>> {
  if (liftIds.length === 0) return new Map();

  const rows = await db
    .select({
      liftId: sets.liftId,
      actualWeight: sets.actualWeight,
      actualReps: sets.actualReps,
    })
    .from(sets)
    .innerJoin(sessions, eq(sets.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sets.sessionId, excludeSessionId),
        eq(sets.setType, "main"),
        inArray(sets.liftId, liftIds),
        isNotNull(sets.completedAt),
        isNotNull(sets.actualWeight),
        isNotNull(sets.actualReps)
      )
    );

  const best = new Map<string, number>();
  for (const row of rows) {
    if (row.actualWeight == null || row.actualReps == null) continue;
    const e1rm = calcEstimated1Rm(Number(row.actualWeight), row.actualReps);
    const current = best.get(row.liftId);
    if (current == null || e1rm > current) best.set(row.liftId, e1rm);
  }
  return best;
}

export interface FeedPostPr {
  liftName: string;
  weight: string;
  reps: number;
  estimatedOneRepMax: string;
}

export interface FeedPostComment {
  id: string;
  userId: string;
  username: string;
  name: string | null;
  body: string;
  createdAt: Date;
}

export interface FeedPostPhoto {
  id: string;
  photoUrl: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  authorUsername: string;
  authorName: string | null;
  kind: "session" | "accessory_day";
  inolScore: string | null;
  caption: string | null;
  photos: FeedPostPhoto[];
  createdAt: Date;
  weekNumber: number | null;
  dayNumber: number | null;
  dayName: string | null;
  activityType: AccessoryActivityType | null;
  customActivityName: string | null;
  durationMinutes: number | null;
  distanceMiles: string | null;
  prs: FeedPostPr[];
  comments: FeedPostComment[];
}

/** Self's posts + accepted friends' posts, newest first, each with its PRs and comments attached. */
export async function getFeedPosts(userId: string): Promise<FeedPost[]> {
  const friendIds = await getFriendIds(userId);
  const visibleUserIds = [userId, ...friendIds];

  const postRows = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      authorUsername: users.username,
      authorName: users.name,
      inolScore: posts.inolScore,
      caption: posts.caption,
      createdAt: posts.createdAt,
      weekNumber: sessions.weekNumber,
      dayNumber: sessions.dayNumber,
      dayName: programDays.name,
      activityType: accessoryDayEntries.activityType,
      customActivityName: accessoryDayEntries.customActivityName,
      durationMinutes: accessoryDayEntries.durationMinutes,
      distanceMiles: accessoryDayEntries.distanceMiles,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.userId))
    .leftJoin(sessions, eq(sessions.id, posts.sessionId))
    .leftJoin(
      programDays,
      and(eq(programDays.userId, sessions.userId), eq(programDays.dayNumber, sessions.dayNumber))
    )
    .leftJoin(accessoryDayEntries, eq(accessoryDayEntries.id, posts.accessoryDayEntryId))
    .where(inArray(posts.userId, visibleUserIds))
    .orderBy(desc(posts.createdAt))
    .limit(100);

  if (postRows.length === 0) return [];

  const postIds = postRows.map((p) => p.id);

  const photoRows = await db
    .select({ id: postPhotos.id, postId: postPhotos.postId, photoUrl: postPhotos.photoUrl })
    .from(postPhotos)
    .where(inArray(postPhotos.postId, postIds))
    .orderBy(asc(postPhotos.createdAt));

  const prRows = await db.select().from(postPrs).where(inArray(postPrs.postId, postIds));
  const commentRows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      username: users.username,
      name: users.name,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(inArray(comments.postId, postIds))
    .orderBy(asc(comments.createdAt));

  const photosByPost = new Map<string, FeedPostPhoto[]>();
  for (const photo of photoRows) {
    const arr = photosByPost.get(photo.postId) ?? [];
    arr.push({ id: photo.id, photoUrl: photo.photoUrl });
    photosByPost.set(photo.postId, arr);
  }

  const prsByPost = new Map<string, FeedPostPr[]>();
  for (const pr of prRows) {
    const arr = prsByPost.get(pr.postId) ?? [];
    arr.push({ liftName: pr.liftName, weight: pr.weight, reps: pr.reps, estimatedOneRepMax: pr.estimatedOneRepMax });
    prsByPost.set(pr.postId, arr);
  }

  const commentsByPost = new Map<string, FeedPostComment[]>();
  for (const c of commentRows) {
    const arr = commentsByPost.get(c.postId) ?? [];
    arr.push({ id: c.id, userId: c.userId, username: c.username!, name: c.name, body: c.body, createdAt: c.createdAt });
    commentsByPost.set(c.postId, arr);
  }

  return postRows.map((p) => ({
    ...p,
    kind: p.activityType != null ? ("accessory_day" as const) : ("session" as const),
    photos: photosByPost.get(p.id) ?? [],
    prs: prsByPost.get(p.id) ?? [],
    comments: commentsByPost.get(p.id) ?? [],
  }));
}
