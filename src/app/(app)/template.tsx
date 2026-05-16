"use client";

// A template re-mounts on every navigation within the group, so the
// fade-in keyframe re-runs — giving smooth (200ms) tab transitions.
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-fade-in-soft">{children}</div>;
}
