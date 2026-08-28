import { AdminShell } from "@/components/admin-shell";
import { AdminVerificationReview } from "./verification-review";

export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminShell><AdminVerificationReview id={id} /></AdminShell>
  );
}
