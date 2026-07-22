"use client";

import { useEffect, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { Expense, Order } from "@/types";

const initial = { expenseDate: new Date().toISOString().slice(0, 10), category: "Advertisement", scope: "GENERAL_BUSINESS", amount: 0, description: "", paidFrom: "CASH", orderId: "", receiptUrl: "" };
export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]); const [orders, setOrders] = useState<Order[]>([]); const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() { try { const [expenseData, orderData] = await Promise.all([apiFetch<{ success: true; expenses: Expense[] }>("/expenses"), apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200")]); setExpenses(expenseData.expenses); setOrders(orderData.orders); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); setMessage(""); try { const result = await apiFetch<{ success: true; message: string }>("/expenses", { method: "POST", body: JSON.stringify(form) }); setMessage(result.message); setForm(initial); await load(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
  if (loading) return <LoadingScreen message="Loading expenses..." />;
  return <main className="page"><div className="page-header"><div><h1>Expenses</h1><p className="muted">Record business-paid and partner-paid costs with automatic ledger entries.</p></div><span className="badge">{expenses.length} ENTRIES</span></div>{error ? <div className="error-box page-message">{error}</div> : null}{message ? <div className="success-box page-message">{message}</div> : null}
    <section className="card card-padding"><h2 className="section-title">Add expense</h2><form className="form" onSubmit={submit}><div className="form-grid-3">
      <div className="field"><label>Date</label><input className="input" type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></div>
      <div className="field"><label>Category</label><input className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
      <div className="field"><label>Scope</label><select className="select" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>{["PER_ITEM","PER_ORDER","PURCHASE_BATCH","PRINTING_BATCH","GENERAL_BUSINESS","ADVERTISEMENT_CAMPAIGN"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label>Amount</label><input className="input" min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
      <div className="field"><label>Paid from</label><select className="select" value={form.paidFrom} onChange={(e) => setForm({ ...form, paidFrom: e.target.value })}>{["CASH","BANK","EASYPAISA","JAZZCASH","PARTNER_A","PARTNER_B"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label>Linked order</label><select className="select" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}><option value="">None</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}</select></div>
      <div className="field field-span-3"><label>Description</label><textarea className="input textarea" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
    </div><div className="actions-row"><button className="button" disabled={saving}>{saving ? "Saving..." : "Record expense"}</button></div></form></section>
    <section className="card users-table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Expense</th><th>Date</th><th>Category</th><th>Scope</th><th>Description</th><th>Paid From</th><th>Amount</th></tr></thead><tbody>{expenses.map((item) => <tr key={item.id}><td className="code-text">{item.expenseNumber}</td><td>{formatDate(item.expenseDate)}</td><td>{item.category}</td><td>{labelize(item.scope)}</td><td>{item.description}</td><td><span className="badge">{labelize(item.paidFrom)}</span></td><td><strong>{formatCurrency(item.amount)}</strong></td></tr>)}{!expenses.length ? <tr><td className="empty-state" colSpan={7}>No expenses recorded.</td></tr> : null}</tbody></table></div></section>
  </main>;
}
