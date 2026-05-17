import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AccountForm } from "@/components/account/account-form";

export default async function AccountPage() {
  const session = await auth();
  // Middleware already gates this, but guard + provide initial values.
  if (!session?.user) redirect("/");

  return (
    <AccountForm
      initialName={session.user.name ?? ""}
      initialEmail={session.user.email ?? ""}
    />
  );
}
