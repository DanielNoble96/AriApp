import Link from "next/link";
import { redirect } from "next/navigation";
import { getLiftsForUser } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import {
  DEFAULT_MAIN_WAVE,
  DEFAULT_WARMUP_SCHEME,
  DEFAULT_ASSISTANCE_PERCENTAGE,
  DEFAULT_REST_TARGET_WARMUP_SECONDS,
  DEFAULT_REST_TARGET_WORK_SECONDS,
} from "@/lib/constants";
import { SetupForm } from "./setup-form";
import { PILL_CLASS } from "@/lib/ui";

// Reads currentTrainingMax fresh each visit -- must not be statically
// prerendered at build time (see app/page.tsx for the same reasoning).
export const dynamic = "force-dynamic";

export default async function CycleSetupPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const lifts = await getLiftsForUser(user.id);

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/" className={`${PILL_CLASS} mb-4 inline-block bg-brutal-cyan`}>
        ← Home
      </Link>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">New Cycle</h1>
      <p className="mb-6 text-sm font-medium opacity-70">
        Set your training maxes and confirm the rep scheme for this cycle.
      </p>
      <SetupForm
        lifts={lifts}
        defaultMainWave={DEFAULT_MAIN_WAVE}
        defaultWarmupScheme={DEFAULT_WARMUP_SCHEME}
        defaultAssistancePercentage={DEFAULT_ASSISTANCE_PERCENTAGE}
        defaultRestTargetWarmupSeconds={DEFAULT_REST_TARGET_WARMUP_SECONDS}
        defaultRestTargetWorkSeconds={DEFAULT_REST_TARGET_WORK_SECONDS}
      />
    </main>
  );
}
