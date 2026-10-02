"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePostCaption } from "@/actions/posts";
import { BUTTON_CLASS, INPUT_CLASS } from "@/lib/ui";

export function ResultsCaptionEditor({
  postId,
  initialCaption,
}: {
  postId: string;
  initialCaption: string;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState(initialCaption);
  const [savedCaption, setSavedCaption] = useState(initialCaption);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = caption.trim() !== savedCaption.trim();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updatePostCaption(postId, caption);
      } catch {
        setError("Couldn't save caption.");
        return;
      }
      setSavedCaption(caption);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSave} className="flex w-full flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          className={`${INPUT_CLASS} flex-1`}
          placeholder="Add a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <button type="submit" disabled={isPending || !dirty} className={`px-3 text-sm ${BUTTON_CLASS}`}>
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
      {!dirty && savedCaption.trim() && <p className="text-xs font-bold opacity-70">Caption saved</p>}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    </form>
  );
}
