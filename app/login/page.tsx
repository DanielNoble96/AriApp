import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-4xl font-extrabold tracking-tight">Pretty Heavy</h1>
      <LoginForm />
      <p className="text-center text-sm opacity-70">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
