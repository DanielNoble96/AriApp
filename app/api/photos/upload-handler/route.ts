import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, postPhotos } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

const MAX_PHOTOS_PER_POST = 3;

/**
 * Issues short-lived client-upload tokens so the browser uploads photo
 * bytes directly to Blob storage instead of routing them through a
 * serverless function -- Vercel's functions have a hard ~4.5MB request body
 * cap that a plain Server Action upload runs straight into on real phone
 * photos, independent of Next.js's own (configurable) bodySizeLimit.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await getSessionUser();
        if (!user) throw new Error("Not signed in.");

        const postId = clientPayload;
        if (!postId) throw new Error("Missing post id.");

        const [post] = await db.select().from(posts).where(eq(posts.id, postId));
        if (!post) throw new Error("Post not found.");
        if (post.userId !== user.id) throw new Error("Forbidden");

        const [{ value: existingCount }] = await db
          .select({ value: count() })
          .from(postPhotos)
          .where(eq(postPhotos.postId, postId));
        if (existingCount >= MAX_PHOTOS_PER_POST) {
          throw new Error(`You can only add up to ${MAX_PHOTOS_PER_POST} photos.`);
        }

        return {
          allowedContentTypes: ["image/*"],
          maximumSizeInBytes: 8 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 }
    );
  }
}
