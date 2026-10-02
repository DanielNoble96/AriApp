"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadPostPhotos, MAX_PHOTOS_PER_POST } from "@/lib/upload-post-photos";
import { BORDER_CLASS, SHADOW_SM_CLASS } from "@/lib/ui";

export function ResultsPhotoUploader({
  postId,
  photoUrls,
}: {
  postId: string;
  photoUrls: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const remaining = MAX_PHOTOS_PER_POST - photoUrls.length;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    if (files.length === 0) return;
    if (files.some((f) => !f.type.startsWith("image/"))) {
      setError("Files must be images.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await uploadPostPhotos(postId, files);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't upload photo.");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {photoUrls.length > 0 && (
        <div className="flex gap-2">
          {photoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element -- served via app/api/photos, no next/image config in this app
            <img
              key={url}
              src={url}
              alt=""
              className="h-24 w-24 rounded-lg border-[3px] border-brutal-black object-cover"
            />
          ))}
        </div>
      )}
      {remaining > 0 && (
        <label
          className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brutal-white p-3 text-sm font-bold ${
            isPending ? "opacity-50" : ""
          }`}
        >
          {isPending ? "Uploading..." : `📷 Add photos to your post (${photoUrls.length}/${MAX_PHOTOS_PER_POST})`}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={isPending}
            onChange={handleChange}
          />
        </label>
      )}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    </div>
  );
}
