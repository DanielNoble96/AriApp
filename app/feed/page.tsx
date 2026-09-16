import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getFeedPosts, getPendingRequestsForUser } from "@/lib/db/social-queries";
import { CARD_CLASS, PILL_CLASS } from "@/lib/ui";
import { FriendSearch } from "./friend-search";
import { PostCard } from "./post-card";

// Reads live posts/friend-request state -- must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [feedPosts, pendingRequests] = await Promise.all([
    getFeedPosts(user.id),
    getPendingRequestsForUser(user.id),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Feed</h1>
        <Link href="/" className={`${PILL_CLASS} bg-brutal-white`}>
          ← Home
        </Link>
      </div>

      <details className={`group ${CARD_CLASS} bg-brutal-cyan p-4`}>
        <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
          <h2 className="text-lg font-bold">
            Find Friends {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </h2>
          <span className="inline-block transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="mt-3">
          <FriendSearch pendingRequests={pendingRequests} />
        </div>
      </details>

      {feedPosts.length === 0 ? (
        <div className={`${CARD_CLASS} bg-brutal-white p-6 text-center`}>
          <p className="font-bold">No posts yet — complete a workout or add some friends.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {feedPosts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={user.id} />
          ))}
        </div>
      )}
    </main>
  );
}
