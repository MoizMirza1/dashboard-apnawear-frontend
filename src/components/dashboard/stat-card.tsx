export default function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}
