import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { CARD_CLASS, PILL_CLASS } from "@/lib/ui";

// Reads the signed-in user -- must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <Link href="/" className={`${PILL_CLASS} bg-brutal-cyan`}>
          ← Home
        </Link>
      </div>

      <div className={`${CARD_CLASS} bg-brutal-purple p-6`}>
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
    </main>
  );
}
