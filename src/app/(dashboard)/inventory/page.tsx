"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import StatCard from "@/components/dashboard/stat-card";
import { apiFetch } from "@/lib/api";
import { formatCurrency, labelize } from "@/lib/format";
import type {
  BusinessSettings,
  GarmentSize,
  GarmentType,
  GarmentVariant,
  InventorySummary,
} from "@/types";

type VariantForm = {
  sku: string;
  garmentType: GarmentType;
  color: string;
  size: GarmentSize;
  defaultUnitCost: number;
  lowStockThreshold: number;
  isActive: boolean;
};

type AdjustmentForm = {
  variantId: string;
  type: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE_OUT";
  quantity: number;
  reason: string;
};

const sizes: GarmentSize[] = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const initialVariant: VariantForm = {
  sku: "",
  garmentType: "REGULAR",
  color: "Black",
  size: "M",
  defaultUnitCost: 400,
  lowStockThreshold: 3,
  isActive: true,
};
const initialAdjustment: AdjustmentForm = {
  variantId: "",
  type: "ADJUSTMENT_IN",
  quantity: 1,
  reason: "Physical stock correction",
};

export default function InventoryPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [variants, setVariants] = useState<GarmentVariant[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [variantForm, setVariantForm] = useState<VariantForm>(initialVariant);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(initialAdjustment);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingVariant, setSavingVariant] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [summaryResponse, variantResponse, settingsResponse] = await Promise.all([
        apiFetch<{ success: true; summary: InventorySummary }>("/inventory/summary"),
        apiFetch<{ success: true; variants: GarmentVariant[] }>("/inventory/variants"),
        apiFetch<{ success: true; settings: BusinessSettings }>("/settings"),
      ]);
      setSummary(summaryResponse.summary);
      setVariants(variantResponse.variants);
      setSettings(settingsResponse.settings);
      setAdjustmentForm((current) => ({
        ...current,
        variantId: current.variantId || variantResponse.variants[0]?.id || "",
      }));
      if (!editingId) {
        setVariantForm((current) => ({
          ...current,
          defaultUnitCost:
            current.garmentType === "DROP_SHOULDER"
              ? settingsResponse.settings.defaultCosts.dropShoulderBlankCost
              : settingsResponse.settings.defaultCosts.regularBlankCost,
        }));
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const activeVariants = useMemo(() => variants.filter((variant) => variant.isActive), [variants]);

  function changeGarmentType(type: GarmentType) {
    const defaultUnitCost =
      type === "DROP_SHOULDER"
        ? settings?.defaultCosts.dropShoulderBlankCost ?? 550
        : settings?.defaultCosts.regularBlankCost ?? 400;
    setVariantForm((current) => ({ ...current, garmentType: type, defaultUnitCost }));
  }

  function editVariant(variant: GarmentVariant) {
    setEditingId(variant.id);
    setVariantForm({
      sku: variant.sku,
      garmentType: variant.garmentType,
      color: variant.color,
      size: variant.size,
      defaultUnitCost: variant.defaultUnitCost,
      lowStockThreshold: variant.lowStockThreshold,
      isActive: variant.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetVariant() {
    setEditingId(null);
    setVariantForm({
      ...initialVariant,
      defaultUnitCost: settings?.defaultCosts.regularBlankCost ?? 400,
    });
  }

  async function saveVariant(event: FormEvent) {
    event.preventDefault(); setSavingVariant(true); setError(""); setMessage("");
    try {
      const response = await apiFetch<{ success: true; message: string }>(editingId ? `/inventory/variants/${editingId}` : "/inventory/variants", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(variantForm),
      });
      setMessage(response.message); resetVariant(); await load();
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSavingVariant(false); }
  }

  async function saveAdjustment(event: FormEvent) {
    event.preventDefault(); setSavingAdjustment(true); setError(""); setMessage("");
    try {
      const response = await apiFetch<{ success: true; message: string }>("/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify(adjustmentForm),
      });
      setMessage(response.message);
      setAdjustmentForm((current) => ({ ...current, quantity: 1, reason: "Physical stock correction" }));
      await load();
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSavingAdjustment(false); }
  }

  if (loading) return <LoadingScreen message="Loading blank inventory..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div><h1>Blank T-Shirt Inventory</h1><p className="muted">Stock is tracked separately by type, color and size.</p></div>
        <span className={`badge ${summary?.lowStockCount ? "badge-warning" : "badge-partner"}`}>{summary?.lowStockCount ?? 0} LOW STOCK</span>
      </div>
      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      <section className="stats-grid">
        <StatCard label="Available Units" value={String(summary?.totalAvailableUnits ?? 0)} note="Blank stock ready to reserve" />
        <StatCard label="Estimated Value" value={formatCurrency(summary?.estimatedStockValue ?? 0)} note="Using latest landed/default cost" />
        <StatCard label="Active Variants" value={String(summary?.activeVariants ?? 0)} note="Type, color and size SKUs" />
        <StatCard label="Damaged Units" value={String(summary?.totalDamagedUnits ?? 0)} note="Removed from available stock" />
      </section>

      <section className="split-layout top-gap">
        <article className="card card-padding">
          <h2 className="section-title">{editingId ? "Edit garment variant" : "Add garment variant"}</h2>
          <p className="section-copy">A separate SKU is required for every type, color and size combination.</p>
          <form className="form" onSubmit={saveVariant}>
            <div className="two-column-form">
              <div className="field"><label htmlFor="sku">SKU</label><input className="input" id="sku" required value={variantForm.sku} onChange={(event) => setVariantForm({ ...variantForm, sku: event.target.value.toUpperCase() })} placeholder="REG-BLK-M" /></div>
              <div className="field"><label htmlFor="garmentType">Garment type</label><select className="select" id="garmentType" value={variantForm.garmentType} onChange={(event) => changeGarmentType(event.target.value as GarmentType)}><option value="REGULAR">Regular</option><option value="DROP_SHOULDER">Drop Shoulder</option></select></div>
              <div className="field"><label htmlFor="color">Color</label><input className="input" id="color" required value={variantForm.color} onChange={(event) => setVariantForm({ ...variantForm, color: event.target.value })} /></div>
              <div className="field"><label htmlFor="size">Size</label><select className="select" id="size" value={variantForm.size} onChange={(event) => setVariantForm({ ...variantForm, size: event.target.value as GarmentSize })}>{sizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
              <div className="field"><label htmlFor="defaultCost">Default blank cost</label><input className="input" id="defaultCost" min="0" required type="number" value={variantForm.defaultUnitCost} onChange={(event) => setVariantForm({ ...variantForm, defaultUnitCost: Number(event.target.value) })} /></div>
              <div className="field"><label htmlFor="lowStock">Low-stock threshold</label><input className="input" id="lowStock" min="0" required type="number" value={variantForm.lowStockThreshold} onChange={(event) => setVariantForm({ ...variantForm, lowStockThreshold: Number(event.target.value) })} /></div>
              <div className="field"><label htmlFor="variantStatus">Status</label><select className="select" id="variantStatus" value={String(variantForm.isActive)} onChange={(event) => setVariantForm({ ...variantForm, isActive: event.target.value === "true" })}><option value="true">Active</option><option value="false">Inactive</option></select></div>
            </div>
            <div className="actions-row gap-row">{editingId ? <button className="button button-secondary" type="button" onClick={resetVariant}>Cancel edit</button> : null}<button className="button" disabled={savingVariant} type="submit">{savingVariant ? "Saving..." : editingId ? "Update variant" : "Add variant"}</button></div>
          </form>
        </article>

        <article className="card card-padding">
          <h2 className="section-title">Manual stock adjustment</h2>
          <p className="section-copy">Use only for physical corrections, missing units or damaged stock. Purchases have their own screen.</p>
          <form className="form" onSubmit={saveAdjustment}>
            <div className="field"><label htmlFor="adjustVariant">Variant</label><select className="select" id="adjustVariant" required value={adjustmentForm.variantId} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, variantId: event.target.value })}><option value="">Select variant</option>{activeVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku} · {variant.color} · {variant.size} ({variant.availableQty})</option>)}</select></div>
            <div className="field"><label htmlFor="adjustType">Adjustment type</label><select className="select" id="adjustType" value={adjustmentForm.type} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, type: event.target.value as AdjustmentForm["type"] })}><option value="ADJUSTMENT_IN">Add stock</option><option value="ADJUSTMENT_OUT">Remove stock</option><option value="DAMAGE_OUT">Mark damaged</option></select></div>
            <div className="field"><label htmlFor="adjustQty">Quantity</label><input className="input" id="adjustQty" min="1" required type="number" value={adjustmentForm.quantity} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, quantity: Number(event.target.value) })} /></div>
            <div className="field"><label htmlFor="adjustReason">Reason</label><textarea className="input textarea" id="adjustReason" required value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.target.value })} /></div>
            <div className="actions-row"><button className="button" disabled={savingAdjustment || !activeVariants.length} type="submit">{savingAdjustment ? "Recording..." : "Record adjustment"}</button></div>
          </form>
        </article>
      </section>

      <section className="card users-table-card">
        <div className="table-wrap"><table className="table inventory-table"><thead><tr><th>SKU</th><th>Type</th><th>Color / Size</th><th>Available</th><th>Reserved</th><th>Unit Cost</th><th>Value</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {variants.map((variant) => <tr key={variant.id}><td className="code-text"><strong>{variant.sku}</strong></td><td>{labelize(variant.garmentType)}</td><td>{variant.color} · {variant.size}</td><td className="number-cell"><strong>{variant.availableQty}</strong></td><td>{variant.reservedQty}</td><td>{formatCurrency(variant.effectiveUnitCost)}<div className="table-subtext">{variant.lastPurchaseCost === null ? "Default cost" : "Latest landed cost"}</div></td><td>{formatCurrency(variant.estimatedValue)}</td><td><span className={`badge ${!variant.isActive ? "badge-inactive" : variant.isLowStock ? "badge-warning" : "badge-partner"}`}>{!variant.isActive ? "INACTIVE" : variant.isLowStock ? "LOW STOCK" : "OK"}</span></td><td><button className="link-button" onClick={() => editVariant(variant)} type="button">Edit</button></td></tr>)}
          {!variants.length ? <tr><td className="empty-state" colSpan={9}>No garment variants found.</td></tr> : null}
        </tbody></table></div>
      </section>
    </main>
  );
}
