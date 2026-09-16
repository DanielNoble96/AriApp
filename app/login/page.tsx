import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getSessionUser } from "@/lib/auth";
import { CARD_CLASS, PILL_CLASS } from "@/lib/ui";

// Reads the session cookie -- must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-5xl font-bold tracking-tight text-brutal-black">
        Pretty Heavy
      </h1>
      <div className={`${CARD_CLASS} bg-brutal-purple p-6`}>
        <LoginForm />
      </div>
      <p className="text-center text-sm font-medium">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={`${PILL_CLASS} inline-block bg-brutal-white`}>
          Sign up
        </Link>
      </p>
      <p className="text-center text-xs font-medium opacity-60">
        <Link href="/about" className="underline">
          About this app
        </Link>
      </p>
    </main>
  );
}
