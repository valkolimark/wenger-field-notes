"use client";

// Root fallback (catches errors in the root layout). Must render its own
// <html>/<body>; keep it dependency-free and inline-styled.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#082a45",
          color: "#fff",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.5rem", opacity: 0.8 }}>
            Please reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              height: "44px",
              padding: "0 1.25rem",
              borderRadius: "0.75rem",
              background: "#fff",
              color: "#0a3758",
              fontWeight: 600,
              border: "none",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
