"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Button } from "./button";

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; msg: string };

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ToastCtx = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used within <ToastProvider>");
  return c;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, msg: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      3000,
    );
  }, []);

  const success = useCallback((m: string) => push("success", m), [push]);
  const error = useCallback((m: string) => push("error", m), [push]);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        setConfirmState({ opts, resolve }),
      ),
    [],
  );

  function settle(v: boolean) {
    confirmState?.resolve(v);
    setConfirmState(null);
  }

  return (
    <Ctx.Provider value={{ success, error, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[2000] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              setToasts((x) => x.filter((y) => y.id !== t.id))
            }
            className={`pointer-events-auto max-w-sm animate-toast-in rounded-xl px-4 py-3 text-left text-sm font-medium text-white shadow-lg ${
              t.kind === "success" ? "bg-brand-navy" : "bg-danger"
            }`}
          >
            {t.msg}
          </button>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => settle(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm animate-pop rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-brand-navy">
              {confirmState.opts.title}
            </h2>
            {confirmState.opts.body && (
              <p className="mt-2 text-sm leading-relaxed text-brand-navy/70">
                {confirmState.opts.body}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => settle(false)}
              >
                {confirmState.opts.cancelLabel || "Cancel"}
              </Button>
              <Button
                variant={
                  confirmState.opts.destructive
                    ? "destructive"
                    : "primary"
                }
                className="flex-1"
                onClick={() => settle(true)}
              >
                {confirmState.opts.confirmLabel || "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
