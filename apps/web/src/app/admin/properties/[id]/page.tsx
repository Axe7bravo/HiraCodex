import { AdminShell } from "@/components/admin-shell";
import { AdminPropertyReview } from "./property-review";

export default async function AdminPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminShell><AdminPropertyReview id={id} /></AdminShell>
  );
}
