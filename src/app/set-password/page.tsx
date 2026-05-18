"use client";

import { useActionState } from "react";
import Image from "next/image";
import { setPassword } from "./actions";

export default function SetPasswordPage() {
  const [error, formAction, pending] = useActionState(setPassword, null);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-linear-to-b from-brand-navy-dark to-brand-navy-light px-6 py-12">
      <div className="flex w-full max-w-sm animate-fade-in flex-col items-center">
        <Image
          src="/logo-white.png"
          alt="Wenger Corporation"
          width={800}
          height={450}
          priority
          className="h-20 w-auto"
        />
        <h1 className="mt-5 text-lg italic text-white">
          Set your password
        </h1>
        <p className="mt-2 text-center text-sm text-white/70">
          First time in — choose a new password to continue.
        </p>

        <form action={formAction} className="mt-10 w-full space-y-3">
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="New password (min 8 characters)"
            aria-label="New password"
            className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white outline-none backdrop-blur-md placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20"
          />
          <input
            type="password"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white outline-none backdrop-blur-md placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20"
          />

          {error && (
            <p role="alert" className="text-sm font-medium text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-base font-semibold text-brand-navy transition-all duration-200 hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Set password"}
          </button>
        </form>
      </div>
    </main>
  );
}
