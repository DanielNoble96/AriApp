import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-4xl font-extrabold tracking-tight">Pretty Heavy</h1>
      <SignupForm />
      <p className="text-center text-sm opacity-70">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
