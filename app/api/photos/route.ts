import { get } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { diaryEntries, diaryPhotos } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

/**
 * Streams a post photo from the private Blob store. proxy.ts already
 * redirects any unauthenticated request before it reaches here (this path
 * isn't in its PUBLIC_PATHS), but checking again directly keeps this route
 * consistent with every other server-side entry point in the app rather
 * than relying solely on the proxy. Pathnames are random-suffixed at
 * upload time and only ever surface inside already-visibility-filtered
 * feed responses, so no further per-photo ownership check is done here.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Not signed in", { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
  }

  // Diary photos are private to their owner, unlike feed photos (which are
  // visible to friends), so these pathnames get a real ownership check.
  if (pathname.startsWith("diary-photos/")) {
    const photoUrl = `/api/photos?pathname=${encodeURIComponent(pathname)}`;
    const [owned] = await db
      .select({ id: diaryPhotos.id })
      .from(diaryPhotos)
      .innerJoin(diaryEntries, eq(diaryPhotos.entryId, diaryEntries.id))
      .where(and(eq(diaryPhotos.photoUrl, photoUrl), eq(diaryEntries.userId, user.id)));
    if (!owned) return new NextResponse("Not found", { status: 404 });
  }

  const result = await get(pathname, { access: "private" });
  if (result === null) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
