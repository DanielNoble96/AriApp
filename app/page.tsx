import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCycle, getSessionsForCycle } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { CARD_CLASS, PILL_CLASS, CANDY_BG_CLASSES } from "@/lib/ui";

// This page reads live DB state (active cycle, session progress) and has no
// request-time API of its own, so without this it could get statically
// prerendered at build time and serve a stale snapshot forever.
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Not started",
  in_progress: "In progress",
  completed: "Done",
};

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const activeCycle = await getActiveCycle(user.id);
  const cycleSessions = activeCycle ? await getSessionsForCycle(activeCycle.id) : [];
  const completedCount = cycleSessions.filter((s) => s.status === "completed").length;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Pretty Heavy</h1>
        <div className="flex items-center gap-2">
          <Link href="/cycle/setup" className={`${PILL_CLASS} bg-brutal-yellow`}>
            New Cycle
          </Link>
          <form action={logout}>
            <button type="submit" className={PILL_CLASS}>
              Log Out
            </button>
          </form>
        </div>
      </div>

      {!activeCycle ? (
        <div className={`${CARD_CLASS} bg-brutal-cyan p-6 text-center`}>
          <p className="font-bold">No active cycle yet — start one above.</p>
        </div>
      ) : (
        <>
          <div className={`${CARD_CLASS} bg-brutal-cyan p-4`}>
            <h2 className="text-xl font-bold">Cycle {activeCycle.cycleNumber}</h2>
            <p className="text-sm font-medium">
              {completedCount} of {cycleSessions.length} sessions complete
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {cycleSessions.map((session, i) => (
              <Link
                key={session.id}
                href={`/session/${session.id}`}
                className={`${CARD_CLASS} flex items-center justify-between p-3 ${
                  session.status === "completed"
                    ? "bg-brutal-white opacity-60"
                    : CANDY_BG_CLASSES[i % CANDY_BG_CLASSES.length]
                }`}
              >
                <span className="font-bold">
                  Week {session.weekNumber}, Day {session.dayNumber}
                </span>
                <span className={`${PILL_CLASS} bg-brutal-white text-xs`}>
                  {STATUS_LABEL[session.status]}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
