import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCycle, getSessionsForCycle } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import { logout } from "@/actions/auth";

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
        <h1 className="text-2xl font-bold">Pretty Heavy</h1>
        <div className="flex items-center gap-4">
          <Link href="/cycle/setup" className="text-sm font-semibold opacity-70">
            New Cycle
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm font-semibold opacity-70">
              Log Out
            </button>
          </form>
        </div>
      </div>

      {!activeCycle ? (
        <p className="text-sm opacity-70">
          No active cycle yet — start one with the link above.
        </p>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold">Cycle {activeCycle.cycleNumber}</h2>
            <p className="text-sm opacity-70">
              {completedCount} of {cycleSessions.length} sessions complete
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {cycleSessions.map((session) => (
              <Link
                key={session.id}
                href={`/session/${session.id}`}
                className={`flex items-center justify-between rounded border p-3 ${
                  session.status === "completed" ? "opacity-60" : ""
                }`}
              >
                <span>
                  Week {session.weekNumber}, Day {session.dayNumber}
                </span>
                <span className="text-sm opacity-70">{STATUS_LABEL[session.status]}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
