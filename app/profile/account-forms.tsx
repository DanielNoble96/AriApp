"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUsername, updateEmail, updatePassword } from "@/actions/profile";
import { CARD_CLASS, INPUT_CLASS, BUTTON_CLASS } from "@/lib/ui";

interface ProfileUser {
  id: string;
  email: string;
  username: string;
  name: string | null;
}

function UsernameForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [username, setUsername] = useState(user.username);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateUsername(username);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} bg-brutal-purple flex flex-col gap-2 p-4`}>
      <h3 className="text-lg font-bold">Change Username</h3>
      <input
        type="text"
        className={INPUT_CLASS}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {success && <p className="text-xs font-bold">Username updated.</p>}
      <button type="submit" disabled={isPending} className={`${BUTTON_CLASS} py-2 text-sm`}>
        {isPending ? "Saving..." : "Save Username"}
      </button>
    </form>
  );
}

function EmailForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateEmail(email, password);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPassword("");
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} bg-brutal-cyan flex flex-col gap-2 p-4`}>
      <h3 className="text-lg font-bold">Change Email</h3>
      <input
        type="email"
        placeholder="New email"
        className={INPUT_CLASS}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Current password"
        className={INPUT_CLASS}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {success && <p className="text-xs font-bold">Email updated.</p>}
      <button type="submit" disabled={isPending} className={`${BUTTON_CLASS} py-2 text-sm`}>
        {isPending ? "Saving..." : "Save Email"}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    startTransition(async () => {
      const result = await updatePassword(currentPassword, newPassword);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} bg-brutal-green flex flex-col gap-2 p-4`}>
      <h3 className="text-lg font-bold">Change Password</h3>
      <input
        type="password"
        placeholder="Current password"
        className={INPUT_CLASS}
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="New password (min. 8 characters)"
        className={INPUT_CLASS}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        className={INPUT_CLASS}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {success && <p className="text-xs font-bold">Password updated. Other devices have been signed out.</p>}
      <button type="submit" disabled={isPending} className={`${BUTTON_CLASS} py-2 text-sm`}>
        {isPending ? "Saving..." : "Save Password"}
      </button>
    </form>
  );
}

export function AccountForms({ user }: { user: ProfileUser }) {
  return (
    <div className="flex flex-col gap-3">
      <UsernameForm user={user} />
      <EmailForm user={user} />
      <PasswordForm />
    </div>
  );
}
