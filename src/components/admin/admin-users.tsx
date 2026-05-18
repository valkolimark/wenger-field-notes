"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AdminNav } from "./admin-nav";
import type { AdminUserDTO } from "@/lib/admin";

const inputCls =
  "h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-brand-navy outline-none focus-visible:border-brand-navy/40";

async function api(
  url: string,
  init: RequestInit,
): Promise<{ ok: true } | { ok: false; msg: string }> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, msg: d.error || "Something went wrong — try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, msg: "Network error — try again." };
  }
}

export function AdminUsers() {
  const { data: session } = useSession();
  const selfRepId = session?.user?.repId;

  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState({
    email: "",
    name: "",
    repId: "",
    role: "rep",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    email: "",
    name: "",
    repId: "",
    role: "rep",
  });
  const [delUser, setDelUser] = useState<AdminUserDTO | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setUsers(d.users ?? []);
      setError(null);
    } catch {
      setError("Couldn't load users — try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitAdd() {
    const r = await api("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(add),
    });
    if (!r.ok) return setError(r.msg);
    setAdding(false);
    setAdd({ email: "", name: "", repId: "", role: "rep" });
    setError(null);
    void refresh();
  }

  function startEdit(u: AdminUserDTO) {
    setEditId(u.id);
    setEdit({
      email: u.email,
      name: u.name ?? "",
      repId: u.repId,
      role: u.role,
    });
  }
  async function submitEdit(id: string) {
    const r = await api(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (!r.ok) return setError(r.msg);
    setEditId(null);
    setError(null);
    void refresh();
  }

  async function resetPw(u: AdminUserDTO) {
    if (
      !window.confirm(
        `Reset ${u.email}'s password to the bootstrap password? They'll be forced to change it on next login.`,
      )
    )
      return;
    const r = await api(`/api/admin/users/${u.id}/reset-password`, {
      method: "POST",
    });
    if (!r.ok) return setError(r.msg);
    setError(null);
    void refresh();
  }

  async function doDelete(
    u: AdminUserDTO,
    body?: Record<string, unknown>,
  ) {
    const r = await api(`/api/admin/users/${u.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) return setError(r.msg);
    setDelUser(null);
    setReassignTo("");
    setError(null);
    void refresh();
  }

  function onDeleteClick(u: AdminUserDTO) {
    if (u.submissionCount === 0) {
      if (window.confirm(`Delete ${u.email}? This can't be undone.`))
        void doDelete(u);
      return;
    }
    setReassignTo("");
    setDelUser(u);
  }

  return (
    <div className="pb-10">
      <h1 className="font-display text-3xl text-brand-navy">Admin</h1>
      <AdminNav />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="h-10 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-navy-light"
        >
          {adding ? "Cancel" : "Add user"}
        </button>
      </div>

      {adding && (
        <div className="mb-5 space-y-2 rounded-2xl border border-black/8 bg-white p-4">
          <input
            className={inputCls}
            placeholder="email@wengercorp.com"
            value={add.email}
            onChange={(e) => setAdd({ ...add, email: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Full name"
            value={add.name}
            onChange={(e) => setAdd({ ...add, name: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="repId (e.g. JSmith)"
            value={add.repId}
            onChange={(e) => setAdd({ ...add, repId: e.target.value })}
          />
          <select
            className={inputCls}
            value={add.role}
            onChange={(e) => setAdd({ ...add, role: e.target.value })}
          >
            <option value="rep">rep</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="button"
            onClick={submitAdd}
            className="h-10 w-full rounded-xl bg-brand-navy text-sm font-semibold text-white hover:bg-brand-navy-light"
          >
            Create user (bootstrap password)
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-brand-navy/45">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const isSelf = u.repId === selfRepId;
            const editing = editId === u.id;
            return (
              <li
                key={u.id}
                className="rounded-2xl border border-black/8 bg-white p-4"
              >
                {editing ? (
                  <div className="space-y-2">
                    <input
                      className={inputCls}
                      value={edit.name}
                      onChange={(e) =>
                        setEdit({ ...edit, name: e.target.value })
                      }
                      placeholder="Name"
                    />
                    <input
                      className={inputCls}
                      value={edit.email}
                      onChange={(e) =>
                        setEdit({ ...edit, email: e.target.value })
                      }
                      placeholder="Email"
                    />
                    <input
                      className={inputCls}
                      value={edit.repId}
                      onChange={(e) =>
                        setEdit({ ...edit, repId: e.target.value })
                      }
                      placeholder="repId"
                    />
                    <select
                      className={inputCls}
                      value={edit.role}
                      disabled={isSelf}
                      onChange={(e) =>
                        setEdit({ ...edit, role: e.target.value })
                      }
                    >
                      <option value="rep">rep</option>
                      <option value="admin">admin</option>
                    </select>
                    {isSelf && (
                      <p className="text-xs text-brand-navy/45">
                        You can&apos;t change your own role.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitEdit(u.id)}
                        className="h-9 flex-1 rounded-lg bg-brand-navy text-sm font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="h-9 flex-1 rounded-lg border border-black/10 text-sm font-medium text-brand-navy"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-brand-navy">
                          {u.name || "—"}{" "}
                          <span className="text-xs font-normal text-brand-navy/50">
                            ({u.repId})
                          </span>
                        </p>
                        <p className="truncate text-xs text-brand-navy/55">
                          {u.email}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          u.role === "admin"
                            ? "bg-brand-navy text-white"
                            : "bg-brand-navy/8 text-brand-navy"
                        }`}
                      >
                        {u.role}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-brand-navy/45">
                      {u.passwordSet ? "password set" : "bootstrap"} ·{" "}
                      {u.submissionCount} submission
                      {u.submissionCount === 1 ? "" : "s"}
                      {isSelf ? " · you" : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="h-9 rounded-lg border border-black/10 px-3 text-sm font-medium text-brand-navy hover:border-brand-navy/30"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPw(u)}
                        className="h-9 rounded-lg border border-black/10 px-3 text-sm font-medium text-brand-navy hover:border-brand-navy/30"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClick(u)}
                        disabled={isSelf}
                        className="h-9 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {delUser && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h2 className="font-display text-xl text-brand-navy">
              Delete {delUser.name || delUser.email}
            </h2>
            <p className="mt-2 text-sm text-brand-navy/70">
              This user has {delUser.submissionCount} submission
              {delUser.submissionCount === 1 ? "" : "s"}. Reassign them to
              another user, or delete them along with the user.
            </p>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className={`${inputCls} mt-4`}
            >
              <option value="">Choose a user to reassign to…</option>
              {users
                .filter((x) => x.id !== delUser.id)
                .map((x) => (
                  <option key={x.id} value={x.repId}>
                    {x.name || x.email} ({x.repId})
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!reassignTo}
              onClick={() =>
                doDelete(delUser, { reassignTo })
              }
              className="mt-3 h-10 w-full rounded-xl bg-brand-navy text-sm font-semibold text-white hover:bg-brand-navy-light disabled:opacity-40"
            >
              Reassign &amp; delete user
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete this user AND permanently delete all ${delUser.submissionCount} of their submissions? This can't be undone.`,
                  )
                )
                  void doDelete(delUser, { deleteSubmissions: true });
              }}
              className="mt-2 h-10 w-full rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete user &amp; all submissions
            </button>
            <button
              type="button"
              onClick={() => {
                setDelUser(null);
                setReassignTo("");
              }}
              className="mt-2 h-10 w-full rounded-xl text-sm font-medium text-brand-navy/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
