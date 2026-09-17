import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionById, getSetsForSession } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import { calcTotalInol, getInolTier, INOL_TIER_LABEL } from "@/lib/inol";
import { CARD_CLASS, PILL_CLASS } from "@/lib/ui";

// Reads live set data -- must not be statically prerendered.
export const dynamic = "force-dynamic";

const TIER_BG = {
  low: "bg-brutal-white",
  optimal: "bg-brutal-cyan",
  heavy: "bg-brutal-pink",
} as const;

export default async function SessionResultsPage({
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
  const inol = calcTotalInol(sessionSets);
  const tier = getInolTier(inol);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-2xl font-bold">Congrats on completing your workout!</p>
      <div className={`${CARD_CLASS} ${TIER_BG[tier]} flex w-full flex-col gap-2 p-8`}>
        <p className="text-xs font-bold uppercase tracking-wide opacity-70">Your INOL Score</p>
        <p className="text-6xl font-bold">{inol.toFixed(2)}</p>
        <p className="text-xl font-bold">{INOL_TIER_LABEL[tier]}</p>
      </div>
      <Link href="/" className={`${PILL_CLASS} bg-brutal-cyan`}>
        ← Home
      </Link>
    </main>
  );
}
