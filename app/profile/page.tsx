import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCycleHistoryForUser } from "@/lib/db/cycle-history";
import { CARD_CLASS, PILL_CLASS, CANDY_BG_CLASSES } from "@/lib/ui";
import { AccountForms } from "./account-forms";

// Reads the signed-in user and their cycle history -- must not be
// statically prerendered.
export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Drops trailing ".00" from numeric-column strings for display. */
function fmt(value: string): string {
  return String(Number(value));
}

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const cycleHistory = await getCycleHistoryForUser(user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <Link href="/" className={`${PILL_CLASS} bg-brutal-cyan`}>
          ← Home
        </Link>
      </div>

      <div className={`${CARD_CLASS} bg-brutal-white p-6`}>
        <dl className="flex flex-col gap-4 text-sm font-medium">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide opacity-70">Username</dt>
            <dd className="text-lg font-bold">@{user.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide opacity-70">Name</dt>
            <dd className="text-lg font-bold">{user.name ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide opacity-70">Email</dt>
            <dd className="text-lg font-bold">{user.email}</dd>
          </div>
        </dl>
      </div>

      <AccountForms user={{ id: user.id, email: user.email, username: user.username, name: user.name }} />

      <div>
        <h2 className="mb-2 text-xl font-bold">Past Cycles</h2>
        {cycleHistory.length === 0 ? (
          <div className={`${CARD_CLASS} bg-brutal-white p-4 text-center`}>
            <p className="text-sm font-medium opacity-70">
              No completed cycles yet -- finish your active one by starting a new cycle.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cycleHistory.map((cycle, i) => (
              <details
                key={cycle.id}
                className={`group ${CARD_CLASS} ${CANDY_BG_CLASSES[i % CANDY_BG_CLASSES.length]} p-4`}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                  <div>
                    <h3 className="text-lg font-bold">Cycle {cycle.cycleNumber}</h3>
                    <p className="text-xs font-medium opacity-70">
                      {formatDate(cycle.startedAt)}
                      {cycle.completedAt ? ` – ${formatDate(cycle.completedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold opacity-70">
                      {cycle.sessionsCompleted} of {cycle.sessionsTotal} done
                    </span>
                    <span className="inline-block transition-transform group-open:rotate-180">▼</span>
                  </div>
                </summary>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`${CARD_CLASS} bg-brutal-white p-2`}>
                      <p className="text-xs font-bold uppercase tracking-wide opacity-70">INOL</p>
                      <p className="text-lg font-bold">{cycle.totalInol.toFixed(2)}</p>
                    </div>
                    <div className={`${CARD_CLASS} bg-brutal-white p-2`}>
                      <p className="text-xs font-bold uppercase tracking-wide opacity-70">PRs</p>
                      <p className="text-lg font-bold">{cycle.prCount}</p>
                    </div>
                    <div className={`${CARD_CLASS} bg-brutal-white p-2`}>
                      <p className="text-xs font-bold uppercase tracking-wide opacity-70">Extra</p>
                      <p className="text-lg font-bold">{cycle.accessoryDayCount}</p>
                    </div>
                  </div>
                  {cycle.startingTms.length > 0 && (
                    <div className={`${CARD_CLASS} bg-brutal-white p-3`}>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-70">
                        Starting Training Maxes
                      </p>
                      <div className="flex flex-col gap-1">
                        {cycle.startingTms.map((tm, ti) => (
                          <div key={ti} className="flex items-center justify-between text-sm font-medium">
                            <span>{tm.liftName}</span>
                            <span className="font-bold">{fmt(tm.startingTm)} lb</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
