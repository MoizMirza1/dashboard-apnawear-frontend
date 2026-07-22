"use client";

import { useEffect, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { Order, PrintingJob } from "@/types";

const initialForm = { orderId: "", printerName: "", printingCost: 400, pickupCost: 50, sentAt: new Date().toISOString().slice(0, 10), dueAt: "", notes: "" };

export default function PrintingPage() {
  const [jobs, setJobs] = useState<PrintingJob[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [jobData, orderData] = await Promise.all([
        apiFetch<{ success: true; jobs: PrintingJob[] }>("/printing-jobs"),
        apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200"),
      ]);
      setJobs(jobData.jobs);
      const eligible = orderData.orders.filter((order) => ["DRAFT", "STOCK_RESERVED", "CONFIRMED"].includes(order.status) && !jobData.jobs.some((job) => job.order.id === order.id));
      setOrders(eligible);
      setForm((current) => ({ ...current, orderId: current.orderId || eligible[0]?.id || "" }));
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const result = await apiFetch<{ success: true; message: string }>("/printing-jobs", { method: "POST", body: JSON.stringify({ ...form, sentAt: form.sentAt || undefined, dueAt: form.dueAt || undefined }) });
      setMessage(result.message); setForm(initialForm); await load();
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSaving(false); }
  }

  async function update(id: string, status: PrintingJob["status"]) {
    try { const result = await apiFetch<{ success: true; message: string }>(`/printing-jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setMessage(result.message); await load(); }
    catch (requestError) { setError((requestError as Error).message); }
  }

  if (loading) return <LoadingScreen message="Loading printing jobs..." />;
  return <main className="page">
    <div className="page-header"><div><h1>Printing Jobs</h1><p className="muted">Send reserved blank shirts for printing and lock actual printing costs.</p></div><span className="badge">{jobs.length} JOBS</span></div>
    {error ? <div className="error-box page-message">{error}</div> : null}{message ? <div className="success-box page-message">{message}</div> : null}
    <section className="card card-padding"><h2 className="section-title">Create printing job</h2><form className="form" onSubmit={submit}><div className="form-grid-3">
      <div className="field"><label>Order</label><select className="select" required value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}><option value="">Select order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customer.name}</option>)}</select></div>
      <div className="field"><label>Printer / vendor</label><input className="input" required value={form.printerName} onChange={(e) => setForm({ ...form, printerName: e.target.value })} /></div>
      <div className="field"><label>Printing cost</label><input className="input" min="0" type="number" value={form.printingCost} onChange={(e) => setForm({ ...form, printingCost: Number(e.target.value) })} /></div>
      <div className="field"><label>Pickup cost</label><input className="input" min="0" type="number" value={form.pickupCost} onChange={(e) => setForm({ ...form, pickupCost: Number(e.target.value) })} /></div>
      <div className="field"><label>Sent date</label><input className="input" type="date" value={form.sentAt} onChange={(e) => setForm({ ...form, sentAt: e.target.value })} /></div>
      <div className="field"><label>Due date</label><input className="input" type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></div>
      <div className="field field-span-3"><label>Notes</label><textarea className="input textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    </div><div className="actions-row"><button className="button" disabled={saving || !orders.length}>{saving ? "Creating..." : "Create job"}</button></div></form></section>
    <section className="card users-table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Job</th><th>Order</th><th>Printer</th><th>Cost</th><th>Status</th><th>Dates</th><th>Action</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td className="code-text">{job.jobNumber}</td><td><strong>{job.order.orderNumber}</strong><div className="table-subtext">{job.order.customer.name}</div></td><td>{job.printerName}</td><td>{formatCurrency(job.printingCost + job.pickupCost)}</td><td><span className="badge">{labelize(job.status)}</span></td><td>{job.sentAt ? formatDate(job.sentAt) : "—"}{job.completedAt ? <div className="table-subtext">Completed {formatDate(job.completedAt)}</div> : null}</td><td><select className="select compact-select" value={job.status} onChange={(e) => void update(job.id, e.target.value as PrintingJob["status"])}>{["PENDING","SENT","IN_PROGRESS","COMPLETED","CANCELLED"].map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}{!jobs.length ? <tr><td className="empty-state" colSpan={7}>No printing jobs yet.</td></tr> : null}</tbody></table></div></section>
  </main>;
}
