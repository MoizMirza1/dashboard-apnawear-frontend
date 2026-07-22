"use client";

import { useEffect, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { FinishedItem, Order, ReturnRecord } from "@/types";

const initial = { orderId: "", type: "RTO", reason: "", outboundCourierCost: 0, returnCourierCost: 0, refundAmount: 0, itemCondition: "CUSTOMER_REFUSED", resellable: false, completedAt: new Date().toISOString().slice(0, 10), notes: "", refundFrom: "CASH" };

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [finished, setFinished] = useState<FinishedItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() {
    try {
      const [returnData, itemData, orderData] = await Promise.all([
        apiFetch<{ success: true; returns: ReturnRecord[] }>("/returns"),
        apiFetch<{ success: true; items: FinishedItem[] }>("/returns/finished-items"),
        apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200"),
      ]);
      setReturns(returnData.returns); setFinished(itemData.items);
      const eligible = orderData.orders.filter((order) => !returnData.returns.some((item) => item.order.id === order.id) && !["CANCELLED", "DRAFT"].includes(order.status));
      setOrders(eligible); setForm((current) => ({ ...current, orderId: current.orderId || eligible[0]?.id || "" }));
    } catch (requestError) { setError((requestError as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try { const result = await apiFetch<{ success: true; message: string }>("/returns", { method: "POST", body: JSON.stringify({ ...form, refundFrom: form.refundAmount > 0 ? form.refundFrom : undefined }) }); setMessage(result.message); setForm(initial); await load(); }
    catch (requestError) { setError((requestError as Error).message); } finally { setSaving(false); }
  }
  async function updateFinished(id: string, status: FinishedItem["status"]) {
    try { await apiFetch(`/returns/finished-items/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (requestError) { setError((requestError as Error).message); }
  }
  if (loading) return <LoadingScreen message="Loading returns..." />;
  return <main className="page">
    <div className="page-header"><div><h1>Returns & RTO</h1><p className="muted">Record return losses and preserve resellable printed inventory.</p></div><span className="badge">{returns.length} RETURNS</span></div>
    {error ? <div className="error-box page-message">{error}</div> : null}{message ? <div className="success-box page-message">{message}</div> : null}
    <section className="card card-padding"><h2 className="section-title">Record return</h2><form className="form" onSubmit={submit}><div className="form-grid-3">
      <div className="field"><label>Order</label><select className="select" required value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}><option value="">Select</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customer.name}</option>)}</select></div>
      <div className="field"><label>Type</label><select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="RTO">RTO</option><option value="CUSTOMER_RETURN">Customer Return</option></select></div>
      <div className="field"><label>Condition</label><select className="select" value={form.itemCondition} onChange={(e) => setForm({ ...form, itemCondition: e.target.value })}>{["RESELLABLE","DAMAGED","WRONG_SIZE","PRINT_DEFECT","CUSTOMER_REFUSED","OTHER"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label>Outbound courier</label><input className="input" min="0" type="number" value={form.outboundCourierCost} onChange={(e) => setForm({ ...form, outboundCourierCost: Number(e.target.value) })} /></div>
      <div className="field"><label>Return courier</label><input className="input" min="0" type="number" value={form.returnCourierCost} onChange={(e) => setForm({ ...form, returnCourierCost: Number(e.target.value) })} /></div>
      <div className="field"><label>Refund amount</label><input className="input" min="0" type="number" value={form.refundAmount} onChange={(e) => setForm({ ...form, refundAmount: Number(e.target.value) })} /></div>
      <div className="field"><label>Refund account</label><select className="select" value={form.refundFrom} onChange={(e) => setForm({ ...form, refundFrom: e.target.value })}>{["CASH","BANK","EASYPAISA","JAZZCASH"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label>Completed date</label><input className="input" type="date" value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} /></div>
      <div className="field checkbox-field"><label><input checked={form.resellable} type="checkbox" onChange={(e) => setForm({ ...form, resellable: e.target.checked })} /> Add to finished stock</label></div>
      <div className="field field-span-3"><label>Reason</label><textarea className="input textarea" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
    </div><div className="actions-row"><button className="button" disabled={saving || !orders.length}>Record return</button></div></form></section>
    <section className="card users-table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Return</th><th>Order</th><th>Type</th><th>Reason</th><th>Operational Cost</th><th>Refund</th><th>Condition</th><th>Date</th></tr></thead><tbody>{returns.map((item) => <tr key={item.id}><td className="code-text">{item.returnNumber}</td><td>{item.order.orderNumber}<div className="table-subtext">{item.order.customer.name}</div></td><td>{labelize(item.type)}</td><td>{item.reason}</td><td>{formatCurrency(item.outboundCourierCost + item.returnCourierCost)}</td><td>{formatCurrency(item.refundAmount)}</td><td>{labelize(item.itemCondition)}</td><td>{formatDate(item.completedAt)}</td></tr>)}{!returns.length ? <tr><td className="empty-state" colSpan={8}>No returns.</td></tr> : null}</tbody></table></div></section>
    <section className="card users-table-card"><div className="card-padding"><h2 className="section-title">Finished printed stock</h2></div><div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Design</th><th>SKU</th><th>Qty</th><th>Cost</th><th>Status</th><th>Action</th></tr></thead><tbody>{finished.map((item) => <tr key={item.id}><td className="code-text">{item.itemCode}</td><td>{item.designName}</td><td>{item.sku} · {item.size}</td><td>{item.quantity}</td><td>{formatCurrency(item.unitCost)}</td><td>{item.status}</td><td><select className="select compact-select" value={item.status} onChange={(e) => void updateFinished(item.id, e.target.value as FinishedItem["status"])}>{["AVAILABLE","SOLD","DAMAGED"].map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}{!finished.length ? <tr><td className="empty-state" colSpan={7}>No finished returned stock.</td></tr> : null}</tbody></table></div></section>
  </main>;
}
