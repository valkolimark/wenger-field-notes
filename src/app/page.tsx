"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (!res || res.error) {
      setSubmitting(false);
      setError(
        "Couldn't sign you in — check your email and password and try again.",
      );
      return;
    }
    // middleware sends first-login users to /set-password.
    router.push("/map");
    router.refresh();
  }

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
          Field Notes
        </h1>
        <p className="mt-2 text-sm text-white/70">Sign in to continue</p>

        <form onSubmit={onSubmit} className="mt-10 w-full space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white outline-none backdrop-blur-md placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white outline-none backdrop-blur-md placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20"
          />

          {error && (
            <p role="alert" className="text-sm font-medium text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-base font-semibold text-brand-navy transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
