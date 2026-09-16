import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCycle, getSessionsForCycle, getAccessoryDaysForCycle } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { CARD_CLASS, PILL_CLASS, CANDY_BG_CLASSES, BORDER_CLASS, SHADOW_SM_CLASS } from "@/lib/ui";
import { DAY_LABELS, DAY_DISPLAY_ORDER, ACCESSORY_ACTIVITY_LABELS } from "@/lib/constants";
import { AccessoryDayForm } from "./accessory-day-form";
import { AccessoryDayRow } from "./accessory-day-row";

// This page reads live DB state (active cycle, session progress) and has no
// request-time API of its own, so without this it could get statically
// prerendered at build time and serve a stale snapshot forever.
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Not started",
  in_progress: "In progress",
  completed: "Done",
};

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const activeCycle = await getActiveCycle(user.id);
  const cycleSessions = activeCycle ? await getSessionsForCycle(activeCycle.id) : [];
  const accessoryDays = activeCycle ? await getAccessoryDaysForCycle(activeCycle.id) : [];
  const completedCount = cycleSessions.filter((s) => s.status === "completed").length;
  // Default-open only the current (first not-fully-done) week; collapse the rest.
  const firstIncompleteWeek =
    [1, 2, 3].find((wn) => cycleSessions.some((s) => s.weekNumber === wn && s.status !== "completed")) ??
    1;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Pretty Heavy</h1>
        <div className="flex items-center gap-2">
          <Link href="/cycle/setup" className={`${PILL_CLASS} bg-brutal-yellow`}>
            New Cycle
          </Link>
          <Link href="/feed" className={`${PILL_CLASS} bg-brutal-white`}>
            Feed
          </Link>
          <form action={logout}>
            <button type="submit" className={`${PILL_CLASS} bg-brutal-white`}>
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

          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((weekNumber, wi) => {
              const weekSessions = cycleSessions
                .filter((s) => s.weekNumber === weekNumber)
                .sort((a, b) => DAY_DISPLAY_ORDER.indexOf(a.dayNumber) - DAY_DISPLAY_ORDER.indexOf(b.dayNumber));
              if (weekSessions.length === 0) return null;
              const weekCompleted = weekSessions.filter((s) => s.status === "completed").length;
              const weekAccessoryDays = accessoryDays.filter((a) => a.weekNumber === weekNumber);

              return (
                <details
                  key={weekNumber}
                  open={weekNumber === firstIncompleteWeek}
                  className={`group ${CARD_CLASS} ${CANDY_BG_CLASSES[wi % CANDY_BG_CLASSES.length]} p-4`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                    <h3 className="text-lg font-bold">Week {weekNumber}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold opacity-70">
                        {weekCompleted} of {weekSessions.length} done
                      </span>
                      <span className="inline-block transition-transform group-open:rotate-180">▼</span>
                    </div>
                  </summary>
                  <div className="mt-3 flex flex-col gap-2">
                    {weekSessions.map((session) => (
                      <Link
                        key={session.id}
                        href={`/session/${session.id}`}
                        className={`${BORDER_CLASS} ${SHADOW_SM_CLASS} flex items-center justify-between rounded-lg bg-brutal-white p-3 ${
                          session.status === "completed" ? "opacity-60" : ""
                        }`}
                      >
                        <span className="font-bold">
                          {DAY_LABELS[session.dayNumber] ?? `Day ${session.dayNumber}`}
                        </span>
                        <span className={`${PILL_CLASS} bg-brutal-white text-xs`}>
                          {STATUS_LABEL[session.status]}
                        </span>
                      </Link>
                    ))}
                    {weekAccessoryDays.map((entry) => (
                      <AccessoryDayRow
                        key={entry.id}
                        id={entry.id}
                        label={ACCESSORY_ACTIVITY_LABELS[entry.activityType]}
                        summary={
                          [
                            entry.durationMinutes != null ? formatDuration(entry.durationMinutes) : null,
                            entry.distanceMiles != null ? `${Number(entry.distanceMiles)} mi` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Logged"
                        }
                      />
                    ))}
                    <AccessoryDayForm cycleId={activeCycle.id} weekNumber={weekNumber} />
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
