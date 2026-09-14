import Link from "next/link";
import { getCurrentUser, getLiftsForUser } from "@/lib/db/queries";
import {
  DEFAULT_MAIN_WAVE,
  DEFAULT_WARMUP_SCHEME,
  DEFAULT_ASSISTANCE_PERCENTAGE,
} from "@/lib/constants";
import { SetupForm } from "./setup-form";

// Reads currentTrainingMax fresh each visit -- must not be statically
// prerendered at build time (see app/page.tsx for the same reasoning).
export const dynamic = "force-dynamic";

export default async function CycleSetupPage() {
  const user = await getCurrentUser();
  const lifts = await getLiftsForUser(user.id);

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/" className="mb-4 inline-block text-sm opacity-70">
        ← Home
      </Link>
      <h1 className="mb-1 text-2xl font-bold">New Cycle</h1>
      <p className="mb-6 text-sm opacity-70">
        Set your training maxes and confirm the rep scheme for this cycle.
      </p>
      <SetupForm
        lifts={lifts}
        defaultMainWave={DEFAULT_MAIN_WAVE}
        defaultWarmupScheme={DEFAULT_WARMUP_SCHEME}
        defaultAssistancePercentage={DEFAULT_ASSISTANCE_PERCENTAGE}
      />
    </main>
  );
}
