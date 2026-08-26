import { PropertyDetail } from "./property-detail";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="property-detail-page">
      <PropertyDetail propertyId={id} />
    </main>
  );
}
