"use client";

import { FormEvent, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Supplier } from "@/types";

type SupplierForm = Omit<Supplier, "id" | "createdAt" | "updatedAt">;
const blankForm: SupplierForm = { name: "", phone: "", email: "", address: "", notes: "", isActive: true };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await apiFetch<{ success: true; suppliers: Supplier[] }>("/suppliers");
      setSuppliers(response.suppliers);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function edit(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({ name: supplier.name, phone: supplier.phone, email: supplier.email, address: supplier.address, notes: supplier.notes, isActive: supplier.isActive });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() { setEditingId(null); setForm(blankForm); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await apiFetch<{ success: true; message: string }>(editingId ? `/suppliers/${editingId}` : "/suppliers", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      setMessage(response.message); reset(); await load();
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingScreen message="Loading suppliers..." />;

  return (
    <main className="page">
      <div className="page-header"><div><h1>Suppliers</h1><p className="muted">Manage blank-shirt manufacturers and stock vendors.</p></div><span className="badge">{suppliers.filter((item) => item.isActive).length} ACTIVE</span></div>
      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}
      <section className="card card-padding">
        <h2 className="section-title">{editingId ? "Edit supplier" : "Add supplier"}</h2>
        <form className="form" onSubmit={submit}>
          <div className="form-grid-3">
            <div className="field"><label htmlFor="supplierName">Name</label><input className="input" id="supplierName" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="field"><label htmlFor="supplierPhone">Phone</label><input className="input" id="supplierPhone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <div className="field"><label htmlFor="supplierEmail">Email</label><input className="input" id="supplierEmail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div className="field field-span-2"><label htmlFor="supplierAddress">Address</label><input className="input" id="supplierAddress" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
            <div className="field"><label htmlFor="supplierActive">Status</label><select className="select" id="supplierActive" value={String(form.isActive)} onChange={(event) => setForm({ ...form, isActive: event.target.value === "true" })}><option value="true">Active</option><option value="false">Inactive</option></select></div>
            <div className="field field-span-3"><label htmlFor="supplierNotes">Notes</label><textarea className="input textarea" id="supplierNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          </div>
          <div className="actions-row gap-row">{editingId ? <button className="button button-secondary" type="button" onClick={reset}>Cancel edit</button> : null}<button className="button" disabled={saving} type="submit">{saving ? "Saving..." : editingId ? "Update supplier" : "Add supplier"}</button></div>
        </form>
      </section>
      <section className="card users-table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Supplier</th><th>Contact</th><th>Address</th><th>Status</th><th>Added</th><th>Action</th></tr></thead><tbody>
        {suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.name}</strong><div className="table-subtext">{supplier.notes || "No notes"}</div></td><td>{supplier.phone || "—"}<div className="table-subtext">{supplier.email || ""}</div></td><td>{supplier.address || "—"}</td><td><span className={`badge ${supplier.isActive ? "badge-partner" : "badge-inactive"}`}>{supplier.isActive ? "ACTIVE" : "INACTIVE"}</span></td><td>{formatDate(supplier.createdAt)}</td><td><button className="link-button" onClick={() => edit(supplier)} type="button">Edit</button></td></tr>)}
        {!suppliers.length ? <tr><td className="empty-state" colSpan={6}>No suppliers added yet.</td></tr> : null}
      </tbody></table></div></section>
    </main>
  );
}
