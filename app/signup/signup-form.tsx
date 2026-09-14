"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/actions/auth";
import { INPUT_CLASS, BUTTON_CLASS } from "@/lib/ui";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signup(email, password, name);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        required
        placeholder="Name"
        className={INPUT_CLASS}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="email"
        required
        placeholder="Email"
        className={INPUT_CLASS}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        required
        placeholder="Password (min. 8 characters)"
        className={INPUT_CLASS}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={isPending} className={`${BUTTON_CLASS} py-3`}>
        {isPending ? "Signing up..." : "Sign Up"}
      </button>
    </form>
  );
}
