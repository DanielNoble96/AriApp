import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionById, getSetsForSession } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import { SessionClient } from "./session-client";

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
      <Link href="/" className="mb-4 inline-block text-sm opacity-70">
        ← Home
      </Link>
      <h1 className="mb-1 text-2xl font-bold">
        Week {session.weekNumber}, Day {session.dayNumber}
      </h1>
      <p className="mb-6 text-sm opacity-70">
        {session.dayName} · {session.status.replace("_", " ")}
      </p>
      <SessionClient
        sessionId={session.id}
        initialSets={sessionSets}
        initialStartedAt={session.startedAt}
        restTargetWarmupSeconds={session.restTargetWarmupSeconds}
        restTargetWorkSeconds={session.restTargetWorkSeconds}
      />
    </main>
  );
}
