export default function PropertyDetailLoading() {
  return (
    <main className="property-detail-page">
      <div className="property-detail-shell detail-skeleton" role="status">
        <span className="sr-only">Loading property…</span>
        <i className="detail-skeleton-line" />
        <i className="detail-skeleton-title" />
        <i className="detail-skeleton-gallery" />
      </div>
    </main>
  );
}
