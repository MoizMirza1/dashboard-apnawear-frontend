"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { GarmentVariant, PurchaseBatch, Supplier } from "@/types";

type PurchaseForm = {
  supplierId: string;
  variantId: string;
  quantity: number;
  unitPurchaseCost: number;
  transportCost: number;
  otherCost: number;
  receivedAt: string;
  invoiceReference: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);
const initialForm: PurchaseForm = {
  supplierId: "",
  variantId: "",
  quantity: 10,
  unitPurchaseCost: 400,
  transportCost: 0,
  otherCost: 0,
  receivedAt: today,
  invoiceReference: "",
  notes: "",
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseBatch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variants, setVariants] = useState<GarmentVariant[]>([]);
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [purchaseResponse, supplierResponse, variantResponse] = await Promise.all([
        apiFetch<{ success: true; purchases: PurchaseBatch[] }>("/purchases"),
        apiFetch<{ success: true; suppliers: Supplier[] }>("/suppliers?active=true"),
        apiFetch<{ success: true; variants: GarmentVariant[] }>("/inventory/variants?active=true"),
      ]);
      setPurchases(purchaseResponse.purchases);
      setSuppliers(supplierResponse.suppliers);
      setVariants(variantResponse.variants);
      setForm((current) => {
        const variant = variantResponse.variants.find((item) => item.id === current.variantId) ?? variantResponse.variants[0];
        return {
          ...current,
          supplierId: current.supplierId || supplierResponse.suppliers[0]?.id || "",
          variantId: variant?.id || "",
          unitPurchaseCost: variant?.defaultUnitCost ?? current.unitPurchaseCost,
        };
      });
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => {
    const totalCost = form.quantity * form.unitPurchaseCost + form.transportCost + form.otherCost;
    return { totalCost, landedCost: form.quantity > 0 ? totalCost / form.quantity : 0 };
  }, [form]);

  function selectVariant(variantId: string) {
    const variant = variants.find((item) => item.id === variantId);
    setForm((current) => ({ ...current, variantId, unitPurchaseCost: variant?.defaultUnitCost ?? current.unitPurchaseCost }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await apiFetch<{ success: true; message: string }>("/purchases", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage(response.message);
      setForm((current) => ({ ...current, quantity: 10, transportCost: 0, otherCost: 0, invoiceReference: "", notes: "" }));
      await load();
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingScreen message="Loading purchase batches..." />;

  return (
    <main className="page">
      <div className="page-header"><div><h1>Purchase Batches</h1><p className="muted">Receive manufacturer stock and calculate actual landed cost per shirt.</p></div><span className="badge">{purchases.length} BATCHES</span></div>
      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      {!suppliers.length ? <div className="notice-box page-message">Add an active supplier before recording a purchase.</div> : null}
      {!variants.length ? <div className="notice-box page-message">Add an active garment variant before recording a purchase.</div> : null}

      <section className="split-layout">
        <article className="card card-padding">
          <h2 className="section-title">Receive stock</h2>
          <p className="section-copy">Transport and other batch costs are distributed across all purchased units.</p>
          <form className="form" onSubmit={submit}>
            <div className="two-column-form">
              <div className="field"><label htmlFor="purchaseSupplier">Supplier</label><select className="select" id="purchaseSupplier" required value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
              <div className="field"><label htmlFor="purchaseVariant">Blank shirt variant</label><select className="select" id="purchaseVariant" required value={form.variantId} onChange={(event) => selectVariant(event.target.value)}><option value="">Select variant</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku} · {labelize(variant.garmentType)} · {variant.color} {variant.size}</option>)}</select></div>
              <div className="field"><label htmlFor="purchaseQty">Quantity</label><input className="input" id="purchaseQty" min="1" required type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /></div>
              <div className="field"><label htmlFor="purchaseUnitCost">Per-shirt purchase cost</label><input className="input" id="purchaseUnitCost" min="0" required type="number" value={form.unitPurchaseCost} onChange={(event) => setForm({ ...form, unitPurchaseCost: Number(event.target.value) })} /></div>
              <div className="field"><label htmlFor="transportCost">Manufacturer transport</label><input className="input" id="transportCost" min="0" required type="number" value={form.transportCost} onChange={(event) => setForm({ ...form, transportCost: Number(event.target.value) })} /></div>
              <div className="field"><label htmlFor="otherCost">Other batch cost</label><input className="input" id="otherCost" min="0" required type="number" value={form.otherCost} onChange={(event) => setForm({ ...form, otherCost: Number(event.target.value) })} /></div>
              <div className="field"><label htmlFor="receivedAt">Received date</label><input className="input" id="receivedAt" required type="date" value={form.receivedAt} onChange={(event) => setForm({ ...form, receivedAt: event.target.value })} /></div>
              <div className="field"><label htmlFor="invoiceReference">Invoice/reference</label><input className="input" id="invoiceReference" value={form.invoiceReference} onChange={(event) => setForm({ ...form, invoiceReference: event.target.value })} /></div>
              <div className="field field-span-2"><label htmlFor="purchaseNotes">Notes</label><textarea className="input textarea" id="purchaseNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            </div>
            <div className="actions-row"><button className="button" disabled={saving || !suppliers.length || !variants.length} type="submit">{saving ? "Receiving..." : "Receive purchase batch"}</button></div>
          </form>
        </article>

        <aside className="card card-padding calculation-card">
          <h2 className="section-title">Live landed-cost calculation</h2>
          <div className="calculation-list">
            <div><span>Shirt cost</span><strong>{formatCurrency(form.quantity * form.unitPurchaseCost)}</strong></div>
            <div><span>Transport</span><strong>{formatCurrency(form.transportCost)}</strong></div>
            <div><span>Other cost</span><strong>{formatCurrency(form.otherCost)}</strong></div>
            <div className="calculation-total"><span>Total batch cost</span><strong>{formatCurrency(totals.totalCost)}</strong></div>
            <div className="landed-highlight"><span>Landed cost per shirt</span><strong>{formatCurrency(totals.landedCost)}</strong></div>
          </div>
          <p className="section-copy top-gap">Formula: (quantity × purchase cost + transport + other cost) ÷ quantity.</p>
        </aside>
      </section>

      <section className="card users-table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Batch</th><th>Supplier</th><th>Variant</th><th>Qty</th><th>Base Cost</th><th>Batch Charges</th><th>Landed / Unit</th><th>Total</th><th>Received</th></tr></thead><tbody>
        {purchases.map((purchase) => <tr key={purchase.id}><td className="code-text"><strong>{purchase.batchNumber}</strong><div className="table-subtext">{purchase.invoiceReference || "No invoice ref"}</div></td><td>{purchase.supplier.name}</td><td><strong>{purchase.variant.sku}</strong><div className="table-subtext">{purchase.variant.color} · {purchase.variant.size}</div></td><td>{purchase.quantity}<div className="table-subtext">Remaining: {purchase.remainingQty}</div></td><td>{formatCurrency(purchase.unitPurchaseCost)}</td><td>{formatCurrency(purchase.transportCost + purchase.otherCost)}<div className="table-subtext">Transport {formatCurrency(purchase.transportCost)}</div></td><td><strong>{formatCurrency(purchase.landedUnitCost)}</strong></td><td>{formatCurrency(purchase.totalCost)}</td><td>{formatDate(purchase.receivedAt)}</td></tr>)}
        {!purchases.length ? <tr><td className="empty-state" colSpan={9}>No purchase batches recorded yet.</td></tr> : null}
      </tbody></table></div></section>
    </main>
  );
}
