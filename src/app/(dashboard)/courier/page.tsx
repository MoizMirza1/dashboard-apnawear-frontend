"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { CourierSettlement, Order, Shipment } from "@/types";

const shipmentInitial = { orderId: "", courierCompany: "", trackingNumber: "", courierCharge: 300, codAmount: 0, bookedAt: new Date().toISOString().slice(0, 10), notes: "" };
const settlementInitial = { shipmentIds: [] as string[], courierDeductions: 0, otherDeductions: 0, receivedInto: "BANK", receivedAt: new Date().toISOString().slice(0, 10), reference: "", notes: "" };

export default function CourierPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [settlements, setSettlements] = useState<CourierSettlement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipmentForm, setShipmentForm] = useState(shipmentInitial);
  const [settlementForm, setSettlementForm] = useState(settlementInitial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [shipmentData, settlementData, orderData] = await Promise.all([
        apiFetch<{ success: true; shipments: Shipment[] }>("/courier/shipments"),
        apiFetch<{ success: true; settlements: CourierSettlement[] }>("/courier/settlements"),
        apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200"),
      ]);
      setShipments(shipmentData.shipments);
      setSettlements(settlementData.settlements);
      const shippable = orderData.orders.filter((order) => !shipmentData.shipments.some((shipment) => shipment.order.id === order.id) && !["CANCELLED", "RETURNED", "RTO"].includes(order.status));
      setOrders(shippable);
      setShipmentForm((current) => ({ ...current, orderId: current.orderId || shippable[0]?.id || "", codAmount: current.codAmount || Math.max(0, (shippable[0]?.revenue ?? 0) - (shippable[0]?.advancePayment ?? 0)) }));
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const unsettled = shipments.filter((shipment) => shipment.status === "DELIVERED" && !shipment.settled);
  const settlementTotals = useMemo(() => {
    const selected = unsettled.filter((shipment) => settlementForm.shipmentIds.includes(shipment.id));
    const gross = selected.reduce((sum, shipment) => sum + shipment.codAmount, 0);
    const defaultDeduction = selected.reduce((sum, shipment) => sum + shipment.courierCharge, 0);
    return { gross, defaultDeduction, net: gross - (settlementForm.courierDeductions || defaultDeduction) - settlementForm.otherDeductions };
  }, [unsettled, settlementForm]);

  function selectOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId);
    setShipmentForm((current) => ({ ...current, orderId, codAmount: Math.max(0, (order?.revenue ?? 0) - (order?.advancePayment ?? 0)) }));
  }

  async function createShipment(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try { const result = await apiFetch<{ success: true; message: string }>("/courier/shipments", { method: "POST", body: JSON.stringify(shipmentForm) }); setMessage(result.message); setShipmentForm(shipmentInitial); await load(); }
    catch (requestError) { setError((requestError as Error).message); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: Shipment["status"]) {
    try { const result = await apiFetch<{ success: true; message: string }>(`/courier/shipments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); setMessage(result.message); await load(); }
    catch (requestError) { setError((requestError as Error).message); }
  }

  function toggleShipment(id: string) {
    setSettlementForm((current) => ({ ...current, shipmentIds: current.shipmentIds.includes(id) ? current.shipmentIds.filter((item) => item !== id) : [...current.shipmentIds, id] }));
  }

  async function createSettlement(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = { ...settlementForm, courierDeductions: settlementForm.courierDeductions || undefined };
      const result = await apiFetch<{ success: true; message: string }>("/courier/settlements", { method: "POST", body: JSON.stringify(payload) });
      setMessage(result.message); setSettlementForm(settlementInitial); await load();
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingScreen message="Loading courier records..." />;
  return <main className="page">
    <div className="page-header"><div><h1>Courier & COD</h1><p className="muted">Book shipments, track delivery/RTO and reconcile courier COD payments.</p></div><span className="badge">{unsettled.length} UNSETTLED</span></div>
    {error ? <div className="error-box page-message">{error}</div> : null}{message ? <div className="success-box page-message">{message}</div> : null}
    <section className="content-grid">
      <article className="card card-padding"><h2 className="section-title">Book shipment</h2><form className="form" onSubmit={createShipment}><div className="two-column-form">
        <div className="field"><label>Order</label><select className="select" required value={shipmentForm.orderId} onChange={(e) => selectOrder(e.target.value)}><option value="">Select order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customer.name}</option>)}</select></div>
        <div className="field"><label>Courier company</label><input className="input" required value={shipmentForm.courierCompany} onChange={(e) => setShipmentForm({ ...shipmentForm, courierCompany: e.target.value })} /></div>
        <div className="field"><label>Tracking number</label><input className="input" required value={shipmentForm.trackingNumber} onChange={(e) => setShipmentForm({ ...shipmentForm, trackingNumber: e.target.value })} /></div>
        <div className="field"><label>Courier charge</label><input className="input" min="0" type="number" value={shipmentForm.courierCharge} onChange={(e) => setShipmentForm({ ...shipmentForm, courierCharge: Number(e.target.value) })} /></div>
        <div className="field"><label>COD amount</label><input className="input" min="0" type="number" value={shipmentForm.codAmount} onChange={(e) => setShipmentForm({ ...shipmentForm, codAmount: Number(e.target.value) })} /></div>
        <div className="field"><label>Booking date</label><input className="input" type="date" value={shipmentForm.bookedAt} onChange={(e) => setShipmentForm({ ...shipmentForm, bookedAt: e.target.value })} /></div>
      </div><div className="actions-row"><button className="button" disabled={saving || !orders.length}>Book shipment</button></div></form></article>
      <aside className="card card-padding"><h2 className="section-title">COD settlement</h2><form className="form" onSubmit={createSettlement}><div className="settlement-select-list">{unsettled.map((shipment) => <label className="check-row" key={shipment.id}><input checked={settlementForm.shipmentIds.includes(shipment.id)} type="checkbox" onChange={() => toggleShipment(shipment.id)} /><span><strong>{shipment.order.orderNumber}</strong><small>{shipment.courierCompany} · {formatCurrency(shipment.codAmount)}</small></span></label>)}{!unsettled.length ? <p className="muted">No delivered unsettled shipments.</p> : null}</div>
        <div className="field"><label>Courier deductions (blank = shipment charges)</label><input className="input" min="0" type="number" value={settlementForm.courierDeductions} onChange={(e) => setSettlementForm({ ...settlementForm, courierDeductions: Number(e.target.value) })} /></div>
        <div className="field"><label>Other deductions</label><input className="input" min="0" type="number" value={settlementForm.otherDeductions} onChange={(e) => setSettlementForm({ ...settlementForm, otherDeductions: Number(e.target.value) })} /></div>
        <div className="field"><label>Received into</label><select className="select" value={settlementForm.receivedInto} onChange={(e) => setSettlementForm({ ...settlementForm, receivedInto: e.target.value })}>{["CASH","BANK","EASYPAISA","JAZZCASH"].map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>Received date</label><input className="input" type="date" value={settlementForm.receivedAt} onChange={(e) => setSettlementForm({ ...settlementForm, receivedAt: e.target.value })} /></div>
        <div className="calculation-list"><div><span>Gross COD</span><strong>{formatCurrency(settlementTotals.gross)}</strong></div><div><span>Expected net</span><strong>{formatCurrency(settlementTotals.net)}</strong></div></div>
        <button className="button" disabled={saving || !settlementForm.shipmentIds.length}>Reconcile settlement</button>
      </form></aside>
    </section>
    <section className="card users-table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Shipment</th><th>Order</th><th>Courier / Tracking</th><th>COD</th><th>Charge</th><th>Status</th><th>Settlement</th><th>Booked</th><th>Action</th></tr></thead><tbody>{shipments.map((shipment) => <tr key={shipment.id}><td className="code-text">{shipment.shipmentNumber}</td><td><strong>{shipment.order.orderNumber}</strong><div className="table-subtext">{shipment.order.customer.name}</div></td><td>{shipment.courierCompany}<div className="table-subtext code-text">{shipment.trackingNumber}</div></td><td>{formatCurrency(shipment.codAmount)}</td><td>{formatCurrency(shipment.courierCharge)}</td><td><span className="badge">{labelize(shipment.status)}</span></td><td>{shipment.settled ? <span className="badge badge-partner">SETTLED</span> : <span className="badge badge-warning">PENDING</span>}</td><td>{formatDate(shipment.bookedAt)}</td><td><select className="select compact-select" value={shipment.status} onChange={(e) => void updateStatus(shipment.id, e.target.value as Shipment["status"])}>{["BOOKED","IN_TRANSIT","DELIVERED","RTO","CANCELLED"].map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}{!shipments.length ? <tr><td className="empty-state" colSpan={9}>No shipments yet.</td></tr> : null}</tbody></table></div></section>
    <section className="card users-table-card"><div className="card-padding"><h2 className="section-title">Settlement history</h2></div><div className="table-wrap"><table className="table"><thead><tr><th>Settlement</th><th>Courier</th><th>Gross COD</th><th>Deductions</th><th>Net Received</th><th>Account</th><th>Date</th></tr></thead><tbody>{settlements.map((item) => <tr key={item.id}><td className="code-text">{item.settlementNumber}</td><td>{item.courierCompany}</td><td>{formatCurrency(item.grossCod)}</td><td>{formatCurrency(item.courierDeductions + item.otherDeductions)}</td><td className="positive-text"><strong>{formatCurrency(item.netReceived)}</strong></td><td>{item.receivedInto}</td><td>{formatDate(item.receivedAt)}</td></tr>)}{!settlements.length ? <tr><td className="empty-state" colSpan={7}>No settlements yet.</td></tr> : null}</tbody></table></div></section>
  </main>;
}
