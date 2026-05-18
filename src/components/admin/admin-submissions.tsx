"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Sparkles,
  RotateCw,
  X,
} from "lucide-react";
import type { Submission } from "@/lib/submissions";
import type { AdminUserDTO } from "@/lib/admin";
import { AdminNav } from "./admin-nav";

type Row = Submission & { createdAt: string };

function shortPriority(v: string) {
  return v?.split("—")[0]?.trim() || v || "—";
}
function fmt(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-brand-navy/45">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-brand-navy/85">{value || "—"}</dd>
    </div>
  );
}

export function AdminSubmissions() {
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [subs, setSubs] = useState<Row[]>([]);
  const [repFilter, setRepFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [sumOpen, setSumOpen] = useState(false);
  const [sumText, setSumText] = useState("");
  const [sumStreaming, setSumStreaming] = useState(false);
  const [sumError, setSumError] = useState<string | null>(null);
  const [sumTitle, setSumTitle] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const lastScopeRef = useRef<"pipeline" | "rep">("pipeline");

  const runSummary = useCallback(
    async (scope: "pipeline" | "rep") => {
      if (scope === "rep" && !repFilter) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      lastScopeRef.current = scope;
      setSumOpen(true);
      setSumError(null);
      setSumText("");
      setSumStreaming(true);
      setSumTitle(
        scope === "rep"
          ? `Summary — ${
              users.find((u) => u.repId === repFilter)?.name || repFilter
            }`
          : "Pipeline summary",
      );
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            repId: scope === "rep" ? repFilter : undefined,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const d = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setSumStreaming(false);
          setSumError(
            d.error || "Couldn't generate the summary — try again.",
          );
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setSumText((p) => p + dec.decode(value, { stream: true }));
        }
        setSumStreaming(false);
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setSumStreaming(false);
        setSumError("Connection lost — regenerate.");
      }
    },
    [repFilter, users],
  );

  function closeSummary() {
    abortRef.current?.abort();
    setSumOpen(false);
    setSumStreaming(false);
    setSumText("");
    setSumError(null);
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = repFilter
        ? `?repId=${encodeURIComponent(repFilter)}`
        : "";
      const res = await fetch(`/api/admin/submissions${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSubs(d.submissions ?? []);
    } catch {
      setError("Couldn't load submissions — try again.");
    } finally {
      setLoading(false);
    }
  }, [repFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = subs.filter(
      (s) => new Date(s.visitDate).getTime() >= weekAgo,
    ).length;
    return { total: subs.length, thisWeek };
  }, [subs]);

  const exportHref = `/api/admin/submissions/export.csv${
    repFilter ? `?repId=${encodeURIComponent(repFilter)}` : ""
  }`;

  return (
    <div className="pb-10">
      <h1 className="text-3xl text-brand-navy">Admin</h1>
      <AdminNav />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="rounded-xl border border-black/8 bg-white px-4 py-3">
          <div className="text-2xl font-semibold text-brand-navy">
            {stats.total}
          </div>
          <div className="text-xs text-brand-navy/55">
            submissions {repFilter ? "(filtered)" : "total"}
          </div>
        </div>
        <div className="rounded-xl border border-black/8 bg-white px-4 py-3">
          <div className="text-2xl font-semibold text-brand-navy">
            {stats.thisWeek}
          </div>
          <div className="text-xs text-brand-navy/55">this week</div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          aria-label="Filter by rep"
          className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-brand-navy"
        >
          <option value="">All reps</option>
          {users.map((u) => (
            <option key={u.id} value={u.repId}>
              {u.name || u.email} ({u.repId})
            </option>
          ))}
        </select>
        <a
          href={exportHref}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-light"
        >
          <Download size={16} aria-hidden />
          Export CSV
        </a>
        <button
          type="button"
          onClick={() => runSummary("pipeline")}
          disabled={sumStreaming}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand-navy/20 bg-white px-4 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-navy/40 disabled:opacity-50"
        >
          <Sparkles size={16} aria-hidden />
          Summarize pipeline
        </button>
        <button
          type="button"
          onClick={() => runSummary("rep")}
          disabled={sumStreaming || !repFilter}
          title={!repFilter ? "Select a rep first" : undefined}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand-navy/20 bg-white px-4 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-navy/40 disabled:opacity-50"
        >
          <Sparkles size={16} aria-hidden />
          Per-rep summary
        </button>
      </div>

      {sumOpen && (
        <div className="mb-5 rounded-2xl border border-brand-navy/15 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg text-brand-navy">
              {sumTitle}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => runSummary(lastScopeRef.current)}
                disabled={sumStreaming}
                aria-label="Regenerate"
                className="grid h-9 w-9 place-items-center rounded-lg text-brand-navy/60 hover:bg-black/5 hover:text-brand-navy disabled:opacity-40"
              >
                <RotateCw size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={closeSummary}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-brand-navy/60 hover:bg-black/5 hover:text-brand-navy"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          </div>
          {sumError ? (
            <p className="mt-3 text-sm text-red-600">{sumError}</p>
          ) : (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-navy/85">
              {sumText}
              {sumStreaming && (
                <span className="ml-0.5 animate-pulse">▍</span>
              )}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-brand-navy/45">Loading…</p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => load()}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-brand-navy/55">No submissions.</p>
      ) : (
        <ul className="space-y-3">
          {subs.map((s) => {
            const open = openId === s.id;
            return (
              <li
                key={s.id}
                className="overflow-hidden rounded-2xl border border-black/8 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-lg text-brand-navy">
                        {s.schoolName}
                      </span>
                      <span className="shrink-0 rounded-full bg-brand-navy/8 px-2 py-0.5 text-[11px] font-medium text-brand-navy">
                        {shortPriority(s.priority.visitPriority)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-brand-navy/50">
                      {s.repName} ({s.repId}) · {fmt(s.visitDate)}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    className={`shrink-0 text-brand-navy/40 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {open && (
                  <div className="border-t border-black/8 px-4 py-4">
                    <dl className="grid gap-x-6 sm:grid-cols-2">
                      <DetailRow
                        label="Visit priority"
                        value={s.priority.visitPriority}
                      />
                      <DetailRow
                        label="Project timing"
                        value={s.priority.projectTiming}
                      />
                      <DetailRow
                        label="Opportunity size"
                        value={s.priority.opportunitySize}
                      />
                      <DetailRow
                        label="Next action"
                        value={s.priority.nextAction}
                      />
                      <DetailRow
                        label="Contact"
                        value={[s.contact.name, s.contact.title]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                      <DetailRow
                        label="Contact email"
                        value={s.contact.email}
                      />
                      <DetailRow
                        label="Met with"
                        value={(s.contact.metWith || []).join(", ")}
                      />
                      <DetailRow
                        label="Budget status"
                        value={s.purchasing.budgetStatus}
                      />
                      <DetailRow
                        label="Decision timeline"
                        value={s.decisionMaking.decisionTimeline}
                      />
                      <DetailRow
                        label="Stakeholders"
                        value={(
                          s.decisionMaking.stakeholders || []
                        ).join(", ")}
                      />
                    </dl>
                    {s.notes?.trim() && (
                      <div className="mt-3 border-t border-black/5 pt-3">
                        <dt className="text-xs font-medium uppercase tracking-wide text-brand-navy/45">
                          Notes
                        </dt>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-brand-navy/85">
                          {s.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
