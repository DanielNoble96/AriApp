import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionById, getSetsForSession } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import { SessionClient } from "./session-client";
import { PILL_CLASS } from "@/lib/ui";

// Reads live set/session state -- must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { sessionId } = await params;
  const session = await getSessionById(sessionId);
  if (!session) notFound();
  if (session.userId !== user.id) notFound();

  const sessionSets = await getSetsForSession(sessionId);

  return (
    <main className="mx-auto max-w-md p-4 pb-28">
      <Link href="/" className={`${PILL_CLASS} mb-4 inline-block bg-brutal-cyan`}>
        ← Home
      </Link>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">
        Week {session.weekNumber}, Day {session.dayNumber}
      </h1>
      <p className="mb-6 text-sm font-bold opacity-70">
        {session.status.replace("_", " ")}
      </p>
      <SessionClient
        sessionId={session.id}
        dayNumber={session.dayNumber}
        initialSets={sessionSets}
        initialStatus={session.status}
        initialStartedAt={session.startedAt}
        initialPausedAt={session.pausedAt}
        initialPausedSeconds={session.pausedSeconds}
        restTargetWarmupSeconds={session.restTargetWarmupSeconds}
        restTargetWorkSeconds={session.restTargetWorkSeconds}
      />
    </main>
  );
}
