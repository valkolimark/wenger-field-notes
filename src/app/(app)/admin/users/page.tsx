import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminUsers } from "@/components/admin/admin-users";

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/map");

  return <AdminUsers />;
}
