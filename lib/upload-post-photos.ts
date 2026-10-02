import { upload } from "@vercel/blob/client";
import { confirmPostPhoto } from "@/actions/posts";

export const MAX_PHOTOS_PER_POST = 3;

/**
 * Uploads each image straight from the browser to Blob storage (bypassing
 * the serverless body-size cap), then records it on the post. Sequential so
 * the server-side per-post photo cap is checked against an accurate count.
 */
export async function uploadPostPhotos(postId: string, files: File[]) {
  for (const file of files) {
    const blob = await upload(`post-photos/${postId}`, file, {
      access: "private",
      handleUploadUrl: "/api/photos/upload-handler",
      clientPayload: postId,
    });
    await confirmPostPhoto(postId, blob.pathname);
  }
}
