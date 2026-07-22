"use client";

import { useEffect, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { AdCampaign } from "@/types";

const initial = { name: "", platform: "INSTAGRAM", spend: 0, startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "ACTIVE", notes: "" };
export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]); const [form, setForm] = useState(initial); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() { try { const data = await apiFetch<{ success: true; campaigns: AdCampaign[] }>("/ad-campaigns"); setCampaigns(data.campaigns); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); setMessage(""); try { const result = await apiFetch<{ success: true; message: string }>("/ad-campaigns", { method: "POST", body: JSON.stringify({ ...form, endDate: form.endDate || undefined }) }); setMessage(result.message); setForm(initial); await load(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
  if (loading) return <LoadingScreen message="Loading campaigns..." />;
  return <main className="page"><div className="page-header"><div><h1>Advertisement Campaigns</h1><p className="muted">Track campaign spend, delivered orders, cost per delivery and ROAS.</p></div><span className="badge">{campaigns.length} CAMPAIGNS</span></div>{error ? <div className="error-box page-message">{error}</div> : null}{message ? <div className="success-box page-message">{message}</div> : null}
    <section className="card card-padding"><h2 className="section-title">New campaign</h2><form className="form" onSubmit={submit}><div className="form-grid-3">
      <div className="field"><label>Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="field"><label>Platform</label><select className="select" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{["INSTAGRAM","FACEBOOK","TIKTOK","GOOGLE","OTHER"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label>Spend</label><input className="input" min="0" type="number" value={form.spend} onChange={(e) => setForm({ ...form, spend: Number(e.target.value) })} /></div>
      <div className="field"><label>Start</label><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
      <div className="field"><label>End</label><input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
      <div className="field"><label>Status</label><select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["PLANNED","ACTIVE","COMPLETED","PAUSED"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field field-span-3"><label>Notes</label><textarea className="input textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    </div><div className="actions-row"><button className="button" disabled={saving}>Create campaign</button></div></form></section>
    <section className="card users-table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Campaign</th><th>Platform</th><th>Spend</th><th>Orders</th><th>Delivered</th><th>Revenue</th><th>Cost / Delivered</th><th>ROAS</th><th>Profit After Ads</th><th>Status</th></tr></thead><tbody>{campaigns.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><div className="table-subtext">{formatDate(item.startDate)}</div></td><td>{item.platform}</td><td>{formatCurrency(item.spend)}</td><td>{item.metrics?.orders ?? 0}</td><td>{item.metrics?.delivered ?? 0}</td><td>{formatCurrency(item.metrics?.revenue ?? 0)}</td><td>{item.metrics?.costPerDeliveredOrder === null ? "—" : formatCurrency(item.metrics?.costPerDeliveredOrder ?? 0)}</td><td>{item.metrics?.roas === null ? "—" : `${item.metrics?.roas ?? 0}x`}</td><td className={(item.metrics?.profitAfterAds ?? 0) >= 0 ? "positive-text" : "negative-text"}>{formatCurrency(item.metrics?.profitAfterAds ?? -item.spend)}</td><td><span className="badge">{labelize(item.status)}</span></td></tr>)}{!campaigns.length ? <tr><td className="empty-state" colSpan={10}>No campaigns.</td></tr> : null}</tbody></table></div></section>
  </main>;
}
