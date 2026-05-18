"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { TextField } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Status =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; msg: string };

async function patchAccount(
  payload: Record<string, string>,
): Promise<{ ok: true } | { ok: false; msg: string }> {
  try {
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        msg: data.error || "Couldn't update your profile — try again.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      msg: "Couldn't update your profile — check your connection and try again.",
    };
  }
}

function StatusLine({ status }: { status: Status }) {
  if (status.state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-navy">
        <Check size={15} aria-hidden /> Saved
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span role="alert" className="text-sm font-medium text-red-600">
        {status.msg}
      </span>
    );
  }
  return null;
}

function SaveButton({
  status,
  children,
}: {
  status: Status;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" variant="primary" disabled={status.state === "saving"}>
      {status.state === "saving" ? "Saving…" : children}
    </Button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white p-5">
      <h2 className="text-lg text-brand-navy">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function AccountForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const { update } = useSession();
  const { success } = useToast();

  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<Status>({ state: "idle" });

  const [email, setEmail] = useState(initialEmail);
  const [emailStatus, setEmailStatus] = useState<Status>({ state: "idle" });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<Status>({ state: "idle" });

  function flashSaved(set: (s: Status) => void) {
    set({ state: "saved" });
    success("Saved");
    setTimeout(() => set({ state: "idle" }), 2000);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameStatus({ state: "error", msg: "Name can't be empty." });
      return;
    }
    setNameStatus({ state: "saving" });
    const r = await patchAccount({ name });
    if (!r.ok) return setNameStatus({ state: "error", msg: r.msg });
    await update({ name: name.trim() });
    flashSaved(setNameStatus);
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus({ state: "saving" });
    const r = await patchAccount({ email });
    if (!r.ok) return setEmailStatus({ state: "error", msg: r.msg });
    await update({ email: email.trim().toLowerCase() });
    flashSaved(setEmailStatus);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      setPwStatus({
        state: "error",
        msg: "Enter your current password to change it.",
      });
      return;
    }
    if (newPassword.length < 8) {
      setPwStatus({
        state: "error",
        msg: "New password must be at least 8 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ state: "error", msg: "New passwords don't match." });
      return;
    }
    setPwStatus({ state: "saving" });
    const r = await patchAccount({ currentPassword, newPassword });
    if (!r.ok) return setPwStatus({ state: "error", msg: r.msg });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    flashSaved(setPwStatus);
  }

  return (
    <div className="pb-10">
      <h1 className="text-3xl text-brand-navy">Account</h1>
      <p className="mt-1 text-sm text-brand-navy/55">
        Update your name, email, or password.
      </p>

      <div className="mt-6 space-y-4">
        <form onSubmit={saveName}>
          <Section title="Name">
            <TextField
              label="Full name"
              value={name}
              onChange={setName}
              maxLength={120}
            />
            <div className="flex items-center justify-between gap-3">
              <StatusLine status={nameStatus} />
              <SaveButton status={nameStatus}>Save name</SaveButton>
            </div>
          </Section>
        </form>

        <form onSubmit={saveEmail}>
          <Section title="Email">
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              value={email}
              onChange={setEmail}
              hint="You'll sign in with this email next time."
            />
            <div className="flex items-center justify-between gap-3">
              <StatusLine status={emailStatus} />
              <SaveButton status={emailStatus}>Save email</SaveButton>
            </div>
          </Section>
        </form>

        <form onSubmit={savePassword}>
          <Section title="Password">
            <TextField
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              hint="At least 8 characters."
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
            <div className="flex items-center justify-between gap-3">
              <StatusLine status={pwStatus} />
              <SaveButton status={pwStatus}>Change password</SaveButton>
            </div>
          </Section>
        </form>
      </div>
    </div>
  );
}
