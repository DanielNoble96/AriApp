import { upload } from "@vercel/blob/client";
import { confirmDiaryPhoto } from "@/actions/diary";

export const MAX_DIARY_PHOTOS = 3;

/** Browser -> Blob direct upload (same pattern as post photos), then recorded on the diary entry. */
export async function uploadDiaryPhotos(entryId: string, files: File[]) {
  for (const file of files) {
    const blob = await upload(`diary-photos/${entryId}`, file, {
      access: "private",
      handleUploadUrl: "/api/photos/upload-handler",
      clientPayload: `diary:${entryId}`,
    });
    await confirmDiaryPhoto(entryId, blob.pathname);
  }
}
