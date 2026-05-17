import { AppShell } from "@/components/shell/app-shell";
import { MigrateLegacy } from "@/components/submissions/migrate-legacy";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MigrateLegacy />
      <AppShell>{children}</AppShell>
    </>
  );
}
