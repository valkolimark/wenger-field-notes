import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSubmissions } from "@/components/admin/admin-submissions";

export default async function AdminPage() {
  // Server-side role check on every render (defense in depth; middleware
  // is the first line).
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/map");

  return <AdminSubmissions />;
}
