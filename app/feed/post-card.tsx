"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePostCaption, uploadPostPhoto, removePostPhoto } from "@/actions/posts";
import { addComment } from "@/actions/comments";
import { getInolTier, INOL_TIER_LABEL, type InolTier } from "@/lib/inol";
import { CARD_CLASS, INPUT_CLASS, BUTTON_CLASS, PILL_CLASS, BORDER_CLASS, SHADOW_SM_CLASS } from "@/lib/ui";
import { ACCESSORY_ACTIVITY_LABELS } from "@/lib/constants";
import type { FeedPost } from "@/lib/db/social-queries";

const TIER_BG: Record<InolTier, string> = {
  low: "bg-brutal-white",
  optimal: "bg-brutal-cyan",
  heavy: "bg-brutal-pink",
};

const MAX_PHOTOS = 3;

/** Drops trailing ".00" from numeric-column strings for display. */
function fmt(value: string): string {
  return String(Number(value));
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function PostCard({ post, currentUserId }: { post: FeedPost; currentUserId: string }) {
  const router = useRouter();
  const isOwner = post.userId === currentUserId;
  const [captionDraft, setCaptionDraft] = useState(post.caption ?? "");
  const [editingCaption, setEditingCaption] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAccessoryDay = post.kind === "accessory_day";
  const inol = post.inolScore != null ? Number(post.inolScore) : null;
  const tier = inol != null ? getInolTier(inol) : null;

  function handleSaveCaption() {
    setError(null);
    startTransition(async () => {
      try {
        await updatePostCaption(post.id, captionDraft);
      } catch {
        setError("Couldn't save caption.");
        return;
      }
      setEditingCaption(false);
      router.refresh();
    });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      try {
        await uploadPostPhoto(post.id, formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't upload photo.");
        return;
      }
      router.refresh();
    });
  }

  function handleRemovePhoto(photoId: string) {
    if (!confirm("Remove this photo?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await removePostPhoto(photoId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove photo.");
        return;
      }
      router.refresh();
    });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addComment(post.id, commentDraft);
      } catch {
        setError("Couldn't post comment.");
        return;
      }
      setCommentDraft("");
      router.refresh();
    });
  }

  return (
    <div className={`${CARD_CLASS} bg-brutal-white p-4`}>
      <div className="flex items-center justify-between">
        <span className="font-bold">@{post.authorUsername}</span>
        {isAccessoryDay ? (
          post.activityType && (
            <span className="text-xs font-medium opacity-70">{ACCESSORY_ACTIVITY_LABELS[post.activityType]}</span>
          )
        ) : (
          <span className="text-xs font-medium opacity-70">{formatDate(post.createdAt)}</span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium opacity-80">
        {isAccessoryDay
          ? `logged ${post.activityType ? ACCESSORY_ACTIVITY_LABELS[post.activityType].toLowerCase() : "an activity"}`
          : "completed a workout"}
      </p>
      {isAccessoryDay && (post.durationMinutes != null || post.distanceMiles != null) && (
        <p className="text-xs font-medium opacity-70">
          {[
            post.durationMinutes != null ? formatDuration(post.durationMinutes) : null,
            post.distanceMiles != null ? `${fmt(post.distanceMiles)} mi` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {post.photos.length > 0 && (
        <div className="relative mt-3 h-80 snap-y snap-mandatory overflow-y-auto rounded-lg border-[3px] border-brutal-black">
          {post.photos.map((photo, i) => (
            <div key={photo.id} className="relative h-80 w-full shrink-0 snap-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- served via app/api/photos, no next/image config in this app */}
              <img src={photo.photoUrl} alt="" className="h-full w-full object-cover" />
              {isOwner && (
                <button
                  type="button"
                  aria-label="Remove photo"
                  disabled={isPending}
                  onClick={() => handleRemovePhoto(photo.id)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-brutal-black bg-brutal-white text-base font-bold leading-none"
                >
                  ×
                </button>
              )}
              {post.photos.length > 1 && (
                <span className="absolute bottom-2 right-2 rounded-full border-2 border-brutal-black bg-brutal-white px-2 py-0.5 text-xs font-bold">
                  {i + 1}/{post.photos.length}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && post.photos.length < MAX_PHOTOS && (
        <label
          className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brutal-white p-3 text-sm font-bold ${
            isPending ? "opacity-50" : ""
          }`}
        >
          📷 Add a photo{post.photos.length > 0 ? ` (${post.photos.length}/${MAX_PHOTOS})` : ""}
          <input
            key={post.photos.length}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isPending}
            onChange={handlePhotoChange}
          />
        </label>
      )}

      {!isAccessoryDay && inol != null && tier != null && (
        <div className={`${CARD_CLASS} ${TIER_BG[tier]} mt-3 flex items-center justify-between p-3`}>
          <span className="text-xs font-bold uppercase tracking-wide opacity-70">INOL</span>
          <span className="text-xl font-bold">{inol.toFixed(2)}</span>
          <span className="text-xs font-bold">{INOL_TIER_LABEL[tier]}</span>
        </div>
      )}

      {!isAccessoryDay && post.prs.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {post.prs.map((pr, i) => (
            <span key={i} className={`${PILL_CLASS} inline-block w-fit bg-brutal-yellow`}>
              🏆 New PR: {pr.liftName} {fmt(pr.weight)}×{pr.reps}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        {editingCaption ? (
          <div className="flex gap-2">
            <input
              type="text"
              className={`${INPUT_CLASS} flex-1`}
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              placeholder="Add a caption..."
            />
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveCaption}
              className={`px-3 text-sm ${BUTTON_CLASS}`}
            >
              Save
            </button>
          </div>
        ) : post.caption ? (
          isOwner ? (
            <button
              type="button"
              onClick={() => setEditingCaption(true)}
              className="text-left text-sm font-medium"
            >
              {post.caption}
            </button>
          ) : (
            <p className="text-sm font-medium">{post.caption}</p>
          )
        ) : (
          isOwner && (
            <button
              type="button"
              onClick={() => setEditingCaption(true)}
              className="text-sm font-bold opacity-60 hover:opacity-100"
            >
              + Add a caption
            </button>
          )
        )}
      </div>

      {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}

      <div className="mt-3 flex flex-col gap-2 border-t-[3px] border-brutal-black pt-3">
        {post.comments.map((c) => (
          <p key={c.id} className="text-sm">
            <span className="font-bold">@{c.username}</span> {c.body}
          </p>
        ))}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            className={`${INPUT_CLASS} flex-1 text-sm`}
            placeholder="Add a comment..."
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
          />
          <button type="submit" disabled={isPending} className={`px-3 text-sm ${BUTTON_CLASS}`}>
            Post
          </button>
        </form>
      </div>
    </div>
  );
}
