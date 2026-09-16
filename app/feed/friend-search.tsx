"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
} from "@/actions/friends";
import type { getPendingRequestsForUser, UserSearchResult } from "@/lib/db/social-queries";
import { INPUT_CLASS, BUTTON_CLASS, PILL_CLASS } from "@/lib/ui";

type PendingRequest = Awaited<ReturnType<typeof getPendingRequestsForUser>>[number];

export function FriendSearch({ pendingRequests }: { pendingRequests: PendingRequest[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const found = await searchUsers(query);
      setResults(found);
    });
  }

  function handleSendRequest(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await sendFriendRequest(userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send request.");
        return;
      }
      setResults((prev) => prev.map((r) => (r.id === userId ? { ...r, status: "pending-sent" } : r)));
    });
  }

  function handleAccept(requestId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await acceptFriendRequest(requestId);
      } catch {
        setError("Couldn't accept request.");
        return;
      }
      router.refresh();
    });
  }

  function handleDecline(requestId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await declineFriendRequest(requestId);
      } catch {
        setError("Couldn't decline request.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {pendingRequests.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide opacity-70">Requests</h3>
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between rounded-lg bg-brutal-white p-2">
              <span className="font-bold">@{req.requesterUsername}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAccept(req.id)}
                  className={`px-3 py-1 text-xs ${BUTTON_CLASS}`}
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDecline(req.id)}
                  className="px-3 py-1 text-xs font-bold opacity-60 hover:opacity-100"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search by username"
          className={`${INPUT_CLASS} flex-1`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={isPending} className={`px-3 ${BUTTON_CLASS}`}>
          Search
        </button>
      </form>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-brutal-white p-2">
              <span className="font-bold">@{r.username}</span>
              {r.status === "none" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSendRequest(r.id)}
                  className={`px-3 py-1 text-xs ${BUTTON_CLASS}`}
                >
                  Add Friend
                </button>
              )}
              {r.status === "pending-sent" && (
                <span className={`${PILL_CLASS} bg-brutal-white text-xs`}>Requested</span>
              )}
              {r.status === "pending-received" && (
                <span className={`${PILL_CLASS} bg-brutal-white text-xs`}>Check Requests ↑</span>
              )}
              {r.status === "friends" && (
                <span className={`${PILL_CLASS} bg-brutal-green text-xs`}>Friends</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
