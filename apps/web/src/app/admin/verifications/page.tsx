import { AdminShell } from "@/components/admin-shell";
import { AdminVerificationQueue } from "./verification-queue";

export default function AdminVerificationsPage() {
  return (
    <AdminShell><AdminVerificationQueue /></AdminShell>
  );
}
