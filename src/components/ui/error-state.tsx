"use client";

import Link from "next/link";
import { Button, buttonClass } from "./button";

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Try again, or head back.",
  reset,
  homeHref = "/map",
  homeLabel = "Go to map",
}: {
  title?: string;
  message?: string;
  reset?: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold text-brand-navy">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-navy/60">
        {message}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {reset && (
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        )}
        <Link href={homeHref} className={buttonClass("secondary")}>
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
