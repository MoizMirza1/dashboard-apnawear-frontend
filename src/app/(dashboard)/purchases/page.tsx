"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { GarmentVariant, PurchaseBatch, Supplier } from "@/types";

type PurchaseLine = {
  key: string;
  variantId: string;
  quantity: number;
  unitPurchaseCost: number;
};

type PurchaseForm = {
  supplierId: string;
  items: PurchaseLine[];
  transportCost: number;
  otherCost: number;
  receivedAt: string;
  invoiceReference: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);

function lineKey(): string {
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newLine(variant?: GarmentVariant): PurchaseLine {
  return {
    key: lineKey(),
    variantId: variant?.id ?? "",
    quantity: 1,
    unitPurchaseCost: variant?.defaultUnitCost ?? 400,
  };
}

function initialForm(): PurchaseForm {
  return {
    supplierId: "",
    items: [newLine()],
    transportCost: 0,
    otherCost: 0,
    receivedAt: today,
    invoiceReference: "",
    notes: "",
  };
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseBatch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variants, setVariants] = useState<GarmentVariant[]>([]);
  const [form, setForm] = useState<PurchaseForm>(() => initialForm());
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
      setForm((current) => ({
        ...current,
        supplierId: current.supplierId || supplierResponse.suppliers[0]?.id || "",
        items: current.items.map((item, index) => {
          if (item.variantId) return item;
          const variant = variantResponse.variants[index] ?? variantResponse.variants[0];
          return {
            ...item,
            variantId: variant?.id ?? "",
            unitPurchaseCost: variant?.defaultUnitCost ?? item.unitPurchaseCost,
          };
        }),
      }));
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    const totalQuantity = form.items.reduce((sum, item) => sum + Math.max(item.quantity, 0), 0);
    const shirtCost = form.items.reduce(
      (sum, item) => sum + Math.max(item.quantity, 0) * Math.max(item.unitPurchaseCost, 0),
      0,
    );
    const sharedCost = form.transportCost + form.otherCost;
    const totalCost = shirtCost + sharedCost;
    const sharedCostPerShirt = totalQuantity > 0 ? sharedCost / totalQuantity : 0;

    return {
      totalQuantity,
      shirtCost,
      sharedCost,
      totalCost,
      sharedCostPerShirt,
    };
  }, [form]);

  const purchaseGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        purchaseNumber: string;
        supplier: PurchaseBatch["supplier"];
        invoiceReference: string;
        receivedAt: string;
        createdAt: string;
        items: PurchaseBatch[];
        totalUnits: number;
        transportCost: number;
        otherCost: number;
        totalCost: number;
      }
    >();

    for (const purchase of purchases) {
      const purchaseNumber = purchase.purchaseNumber || purchase.batchNumber;
      const existing = groups.get(purchaseNumber);
      if (existing) {
        existing.items.push(purchase);
        existing.totalUnits += purchase.quantity;
        existing.transportCost += purchase.transportCost;
        existing.otherCost += purchase.otherCost;
        existing.totalCost += purchase.totalCost;
      } else {
        groups.set(purchaseNumber, {
          purchaseNumber,
          supplier: purchase.supplier,
          invoiceReference: purchase.invoiceReference,
          receivedAt: purchase.receivedAt,
          createdAt: purchase.createdAt,
          items: [purchase],
          totalUnits: purchase.quantity,
          transportCost: purchase.transportCost,
          otherCost: purchase.otherCost,
          totalCost: purchase.totalCost,
        });
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [purchases]);

  function updateLine(key: string, patch: Partial<PurchaseLine>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  }

  function selectVariant(key: string, variantId: string) {
    const variant = variants.find((item) => item.id === variantId);
    updateLine(key, {
      variantId,
      unitPurchaseCost: variant?.defaultUnitCost ?? 0,
    });
  }

  function addLine() {
    const usedIds = new Set(form.items.map((item) => item.variantId));
    const nextVariant = variants.find((variant) => !usedIds.has(variant.id)) ?? variants[0];
    setForm((current) => ({ ...current, items: [...current.items, newLine(nextVariant)] }));
  }

  function removeLine(key: string) {
    setForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.key !== key) : current.items,
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch<{ success: true; message: string; purchaseNumber: string }>(
        "/purchases",
        {
          method: "POST",
          body: JSON.stringify({
            supplierId: form.supplierId,
            items: form.items.map(({ variantId, quantity, unitPurchaseCost }) => ({
              variantId,
              quantity,
              unitPurchaseCost,
            })),
            transportCost: form.transportCost,
            otherCost: form.otherCost,
            receivedAt: form.receivedAt,
            invoiceReference: form.invoiceReference,
            notes: form.notes,
          }),
        },
      );
      setMessage(`${response.message} Reference: ${response.purchaseNumber}`);
      setForm({
        ...initialForm(),
        supplierId: form.supplierId,
        items: [newLine(variants[0])],
      });
      await load();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen message="Loading purchases..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Stock Purchases</h1>
          <p className="muted">Record all sizes and colours bought from one supplier in a single purchase.</p>
        </div>
        <span className="badge">{purchaseGroups.length} PURCHASES</span>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      {!suppliers.length ? (
        <div className="notice-box page-message">
          Add an active supplier first. <Link className="inline-text-link" href="/suppliers">Manage suppliers</Link>
        </div>
      ) : null}
      {!variants.length ? <div className="notice-box page-message">Add an active blank-shirt variant before recording a purchase.</div> : null}

      <section className="split-layout">
        <article className="card card-padding">
          <div className="section-heading-row">
            <div>
              <h2 className="section-title">Receive supplier purchase</h2>
              <p className="section-copy">Example: 4 Black Large and 2 Black Medium can be entered together below.</p>
            </div>
            <Link className="button button-secondary compact-button" href="/suppliers">Suppliers</Link>
          </div>

          <form className="form" onSubmit={submit}>
            <div className="two-column-form">
              <div className="field">
                <label htmlFor="purchaseSupplier">Supplier</label>
                <select
                  className="select"
                  id="purchaseSupplier"
                  required
                  value={form.supplierId}
                  onChange={(event) => setForm({ ...form, supplierId: event.target.value })}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="receivedAt">Purchase/received date</label>
                <input className="input" id="receivedAt" required type="date" value={form.receivedAt} onChange={(event) => setForm({ ...form, receivedAt: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="invoiceReference">Invoice/reference <span className="optional-label">(optional)</span></label>
                <input className="input" id="invoiceReference" placeholder="Supplier invoice or your own note, e.g. AD-001" value={form.invoiceReference} onChange={(event) => setForm({ ...form, invoiceReference: event.target.value })} />
                <small className="field-help">Leave blank when the supplier did not provide an invoice.</small>
              </div>
              <div className="field">
                <label htmlFor="transportCost">Total transport cost (PKR)</label>
                <input className="input" id="transportCost" min="0" type="number" value={form.transportCost} onChange={(event) => setForm({ ...form, transportCost: Number(event.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="otherCost">Other shared purchase cost (PKR)</label>
                <input className="input" id="otherCost" min="0" type="number" value={form.otherCost} onChange={(event) => setForm({ ...form, otherCost: Number(event.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="purchaseNotes">Notes <span className="optional-label">(optional)</span></label>
                <input className="input" id="purchaseNotes" placeholder="Any purchase note" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </div>
            </div>

            <div className="purchase-items-section">
              <div className="section-heading-row">
                <div>
                  <h3>Shirts in this purchase</h3>
                  <p className="section-copy">Add one row for each size, colour or shirt type.</p>
                </div>
                <button className="button button-secondary compact-button" disabled={!variants.length} onClick={addLine} type="button">+ Add shirt</button>
              </div>

              <div className="purchase-item-list">
                {form.items.map((item, index) => {
                  const usedIds = new Set(form.items.filter((line) => line.key !== item.key).map((line) => line.variantId));
                  const lineSharedCost = totals.totalQuantity > 0
                    ? totals.sharedCostPerShirt * item.quantity
                    : 0;
                  const lineTotal = item.quantity * item.unitPurchaseCost + lineSharedCost;
                  const landedUnitCost = item.quantity > 0 ? lineTotal / item.quantity : 0;

                  return (
                    <div className="purchase-item-row" key={item.key}>
                      <div className="purchase-line-number">{index + 1}</div>
                      <div className="field purchase-variant-field">
                        <label htmlFor={`purchaseVariant-${item.key}`}>Blank shirt</label>
                        <select
                          className="select"
                          id={`purchaseVariant-${item.key}`}
                          required
                          value={item.variantId}
                          onChange={(event) => selectVariant(item.key, event.target.value)}
                        >
                          <option value="">Select variant</option>
                          {variants
                            .filter((variant) => variant.id === item.variantId || !usedIds.has(variant.id))
                            .map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.sku} · {labelize(variant.garmentType)} · {variant.color} {variant.size}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`purchaseQty-${item.key}`}>Quantity</label>
                        <input className="input" id={`purchaseQty-${item.key}`} min="1" required type="number" value={item.quantity || ""} onChange={(event) => updateLine(item.key, { quantity: Number(event.target.value) })} />
                      </div>
                      <div className="field">
                        <label htmlFor={`purchaseUnitCost-${item.key}`}>Cost per shirt</label>
                        <input className="input" id={`purchaseUnitCost-${item.key}`} min="0" required type="number" value={item.unitPurchaseCost || ""} onChange={(event) => updateLine(item.key, { unitPurchaseCost: Number(event.target.value) })} />
                      </div>
                      <div className="purchase-line-total">
                        <span>Estimated landed/unit</span>
                        <strong>{formatCurrency(landedUnitCost)}</strong>
                      </div>
                      <button
                        aria-label={`Remove shirt row ${index + 1}`}
                        className="remove-line-button"
                        disabled={form.items.length === 1}
                        onClick={() => removeLine(item.key)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="actions-row">
              <button className="button" disabled={saving || !suppliers.length || !variants.length} type="submit">
                {saving ? "Receiving..." : `Receive ${totals.totalQuantity || 0} shirts`}
              </button>
            </div>
          </form>
        </article>

        <aside className="card card-padding calculation-card">
          <h2 className="section-title">Purchase summary</h2>
          <div className="calculation-list">
            <div><span>Different shirt variants</span><strong>{form.items.length}</strong></div>
            <div><span>Total shirts</span><strong>{totals.totalQuantity}</strong></div>
            <div><span>Blank-shirt cost</span><strong>{formatCurrency(totals.shirtCost)}</strong></div>
            <div><span>Transport</span><strong>{formatCurrency(form.transportCost)}</strong></div>
            <div><span>Other cost</span><strong>{formatCurrency(form.otherCost)}</strong></div>
            <div className="calculation-total"><span>Total purchase cost</span><strong>{formatCurrency(totals.totalCost)}</strong></div>
            <div className="landed-highlight"><span>Shared cost per shirt</span><strong>{formatCurrency(totals.sharedCostPerShirt)}</strong></div>
          </div>
          <p className="section-copy top-gap">Transport and other shared costs are distributed by quantity across all shirts in this purchase.</p>
        </aside>
      </section>

      <section className="card users-table-card">
        <div className="table-wrap">
          <table className="table purchase-history-table">
            <thead>
              <tr>
                <th>Purchase</th>
                <th>Supplier</th>
                <th>Shirts</th>
                <th>Total Qty</th>
                <th>Shared Charges</th>
                <th>Total</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {purchaseGroups.map((group) => (
                <tr key={group.purchaseNumber}>
                  <td className="code-text">
                    <strong>{group.purchaseNumber}</strong>
                    <div className="table-subtext">{group.invoiceReference || "No invoice/reference"}</div>
                  </td>
                  <td>{group.supplier.name}</td>
                  <td>
                    <div className="purchase-history-items">
                      {group.items.map((purchase) => (
                        <div key={purchase.id}>
                          <strong>{purchase.variant.sku}</strong> × {purchase.quantity}
                          <span>{purchase.variant.color} {purchase.variant.size} · Base {formatCurrency(purchase.unitPurchaseCost)} · Landed {formatCurrency(purchase.landedUnitCost)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td><strong>{group.totalUnits}</strong></td>
                  <td>
                    {formatCurrency(group.transportCost + group.otherCost)}
                    <div className="table-subtext">Transport {formatCurrency(group.transportCost)}</div>
                  </td>
                  <td><strong>{formatCurrency(group.totalCost)}</strong></td>
                  <td>{formatDate(group.receivedAt)}</td>
                </tr>
              ))}
              {!purchaseGroups.length ? <tr><td className="empty-state" colSpan={7}>No stock purchases recorded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
