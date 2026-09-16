"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePostCaption } from "@/actions/posts";
import { addComment } from "@/actions/comments";
import { getInolTier, INOL_TIER_LABEL, type InolTier } from "@/lib/inol";
import { CARD_CLASS, INPUT_CLASS, BUTTON_CLASS, PILL_CLASS } from "@/lib/ui";
import type { FeedPost } from "@/lib/db/social-queries";

const TIER_BG: Record<InolTier, string> = {
  low: "bg-brutal-white",
  optimal: "bg-brutal-cyan",
  heavy: "bg-brutal-pink",
};

/** Drops trailing ".00" from numeric-column strings for display. */
function fmt(value: string): string {
  return String(Number(value));
}

export function PostCard({ post, currentUserId }: { post: FeedPost; currentUserId: string }) {
  const router = useRouter();
  const isOwner = post.userId === currentUserId;
  const [captionDraft, setCaptionDraft] = useState(post.caption ?? "");
  const [editingCaption, setEditingCaption] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inol = Number(post.inolScore);
  const tier = getInolTier(inol);

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
        <span className="text-xs font-medium opacity-70">
          Week {post.weekNumber}, Day {post.dayNumber} — {post.dayName}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium opacity-80">completed a workout</p>

      {post.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external Blob URL, no next/image config in this app
        <img
          src={post.photoUrl}
          alt=""
          className="mt-3 w-full rounded-lg border-[3px] border-brutal-black"
        />
      )}

      <div className={`${CARD_CLASS} ${TIER_BG[tier]} mt-3 flex items-center justify-between p-3`}>
        <span className="text-xs font-bold uppercase tracking-wide opacity-70">INOL</span>
        <span className="text-xl font-bold">{inol.toFixed(2)}</span>
        <span className="text-xs font-bold">{INOL_TIER_LABEL[tier]}</span>
      </div>

      {post.prs.length > 0 && (
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
