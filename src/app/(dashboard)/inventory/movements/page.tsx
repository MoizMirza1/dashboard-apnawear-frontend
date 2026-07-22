"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { StockMovement } from "@/types";

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ success: true; movements: StockMovement[] }>("/inventory/movements")
      .then((response) => setMovements(response.movements))
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen message="Loading stock movements..." />;

  return (
    <main className="page">
      <div className="page-header"><div><h1>Stock Movements</h1><p className="muted">Permanent history of purchase receipts and manual stock corrections.</p></div><span className="badge">{movements.length} RECORDS</span></div>
      {error ? <div className="error-box page-message">{error}</div> : null}
      <section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Movement</th><th>Variant</th><th>Type</th><th>Change</th><th>Balance</th><th>Unit Cost</th><th>Reason</th><th>Date</th></tr></thead><tbody>
        {movements.map((movement) => <tr key={movement.id}><td className="code-text"><strong>{movement.movementNumber}</strong><div className="table-subtext">{movement.purchaseBatch?.batchNumber ?? "Manual"}</div></td><td><strong>{movement.variant.sku}</strong><div className="table-subtext">{movement.variant.color} · {movement.variant.size}</div></td><td><span className={`badge ${movement.quantityDelta >= 0 ? "badge-partner" : movement.type === "DAMAGE_OUT" ? "badge-inactive" : "badge-warning"}`}>{labelize(movement.type)}</span></td><td className={movement.quantityDelta >= 0 ? "positive-text" : "negative-text"}><strong>{movement.quantityDelta >= 0 ? "+" : ""}{movement.quantityDelta}</strong></td><td>{movement.balanceAfter}</td><td>{movement.unitCost === null ? "—" : formatCurrency(movement.unitCost)}</td><td>{movement.reason}</td><td>{formatDate(movement.createdAt)}</td></tr>)}
        {!movements.length ? <tr><td className="empty-state" colSpan={8}>No stock movements recorded yet.</td></tr> : null}
      </tbody></table></div></section>
    </main>
  );
}
