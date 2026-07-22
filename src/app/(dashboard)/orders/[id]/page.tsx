"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { Order } from "@/types";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [costs, setCosts] = useState({ printing: 0, printingPickup: 0, flyer: 0, label: 0, courier: 0, returnCost: 0, other: 0, adAllocation: 0, deliveryCharged: 0, discount: 0, advancePayment: 0 });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{ success: true; order: Order }>(`/orders/${id}`);
      setOrder(data.order);
      setCosts({ ...data.order.costs, deliveryCharged: data.order.deliveryCharged, discount: data.order.discount, advancePayment: data.order.advancePayment });
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id]);

  async function saveCosts(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const data = await apiFetch<{ success: true; message: string; order: Order }>(`/orders/${id}/costs`, { method: "PATCH", body: JSON.stringify(costs) });
      setOrder(data.order); setMessage(data.message);
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingScreen message="Loading order..." />;
  if (!order) return <main className="page"><div className="error-box">{error || "Order not found."}</div></main>;

  return <main className="page">
    <div className="page-header"><div><Link className="link-button" href="/orders">← Orders</Link><h1>{order.orderNumber}</h1><p className="muted">{order.customer.name} · {order.customer.phone} · {order.customer.city}</p></div><span className="badge">{labelize(order.status)}</span></div>
    {error ? <div className="error-box page-message">{error}</div> : null}{message ? <div className="success-box page-message">{message}</div> : null}
    <section className="stats-grid">
      <div className="card stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{formatCurrency(order.revenue)}</div></div>
      <div className="card stat-card"><div className="stat-label">Direct Cost</div><div className="stat-value">{formatCurrency(order.directCost)}</div></div>
      <div className="card stat-card"><div className="stat-label">Profit After Ads</div><div className={`stat-value ${order.profitAfterAds >= 0 ? "positive-text" : "negative-text"}`}>{formatCurrency(order.profitAfterAds)}</div></div>
      <div className="card stat-card"><div className="stat-label">Stock State</div><div className="stat-value small-stat">{labelize(order.stockState)}</div></div>
    </section>
    <section className="content-grid">
      <article className="card card-padding"><h2 className="section-title">Items</h2><div className="table-wrap"><table className="table"><thead><tr><th>Design / SKU</th><th>Qty</th><th>Sale</th><th>Inventory</th><th>Print</th><th>Margin</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td><strong>{item.designName}</strong><div className="table-subtext">{item.sku} · {item.color} · {item.size}</div></td><td>{item.quantity}</td><td>{formatCurrency(item.grossSellingPrice)}</td><td>{formatCurrency(item.inventoryCost)}</td><td>{formatCurrency(item.printingCost)}</td><td>{formatCurrency(item.grossSellingPrice - item.inventoryCost - item.printingCost)}</td></tr>)}</tbody></table></div><h2 className="section-title top-gap">Customer</h2><p>{order.customer.address}</p><p className="muted">Source: {labelize(order.source)} · Payment: {labelize(order.paymentStatus)} · Created: {formatDate(order.createdAt)}</p></article>
      <aside className="card card-padding"><h2 className="section-title">Update costs</h2><form className="form" onSubmit={saveCosts}>{Object.entries(costs).map(([key, value]) => <div className="field" key={key}><label>{labelize(key)}</label><input className="input" min="0" type="number" value={value} onChange={(e) => setCosts({ ...costs, [key]: Number(e.target.value) })} /></div>)}<button className="button" disabled={saving}>{saving ? "Saving..." : "Recalculate order"}</button></form></aside>
    </section>
  </main>;
}
