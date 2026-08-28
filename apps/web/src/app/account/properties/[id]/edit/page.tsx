import { LandlordShell } from "@/components/landlord-shell";
import { PropertyForm } from "../../property-form";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LandlordShell><PropertyForm propertyId={id} /></LandlordShell>
  );
}
