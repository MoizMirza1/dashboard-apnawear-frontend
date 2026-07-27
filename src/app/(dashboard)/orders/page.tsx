"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { AdCampaign, GarmentVariant, Order, ProductDesign } from "@/types";

const todayDefaults = {
  customerName: "",
  phone: "",
  whatsapp: "",
  city: "",
  address: "",
  source: "INSTAGRAM_ORGANIC",
  instagramUsername: "",
  productDesignId: "",
  designName: "",
  garmentVariantId: "",
  quantity: 1,
  unitSellingPrice: "" as number | string,
  printingCost: "",
  perShirtPrintingCost: 400,
  printingPickup: 50,
  deliveryCharged: "" as number | string,
  discount: "" as number | string,
  advancePayment: "" as number | string,
  advanceAccount: "EASYPAISA",
  adCampaignId: "",
  reserveStock: true,
};

type FormState = typeof todayDefaults;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductDesign[]>([]);
  const [variants, setVariants] = useState<GarmentVariant[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [form, setForm] = useState<FormState>(todayDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Automation & Trip state
  const [chatText, setChatText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [quickFulfillingId, setQuickFulfillingId] = useState<string | null>(null);

  // 🛵 Market Trip Widget State on Right Column
  const [tripOrderIds, setTripOrderIds] = useState<string[]>([]);
  const [savingTrip, setSavingTrip] = useState(false);

  async function load() {
    try {
      const [orderData, productData, variantData, campaignData, settingsData, jobData] = await Promise.all([
        apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200"),
        apiFetch<{ success: true; products: ProductDesign[] }>("/products?status=ACTIVE"),
        apiFetch<{ success: true; variants: GarmentVariant[] }>("/inventory/variants?active=true"),
        apiFetch<{ success: true; campaigns: AdCampaign[] }>("/ad-campaigns"),
        apiFetch<{ success: true; settings: any }>("/settings").catch(() => null),
        apiFetch<{ success: true; jobs: any[] }>("/printing-jobs").catch(() => ({ success: true, jobs: [] })),
      ]);

      const firstJob = jobData?.jobs?.[0];
      const latestJobCost = firstJob ? ((firstJob.printingCost || 0) + (firstJob.pickupCost || 0)) : null;
      const defaultPrinting = latestJobCost && latestJobCost > 0 ? latestJobCost : (settingsData?.settings?.defaultCosts?.defaultPrintingCost || 450);
      const defaultPickup = settingsData?.settings?.defaultCosts?.printingPickup ?? 50;

      setOrders(orderData.orders);
      setProducts(productData.products);
      setVariants(variantData.variants);
      setCampaigns(campaignData.campaigns);
      setForm((current) => ({
        ...current,
        perShirtPrintingCost: defaultPrinting,
        printingPickup: defaultPickup,
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

  const selectedVariant = variants.find((item) => item.id === form.garmentVariantId);
  const selectedProduct = products.find((item) => item.id === form.productDesignId);

  const projected = useMemo(() => {
    const qty = Number(form.quantity) || 1;
    const revenue = (Number(form.unitSellingPrice) || 0) * qty + (Number(form.deliveryCharged) || 0) - (Number(form.discount) || 0);
    const stockCost = (selectedVariant?.effectiveUnitCost ?? 560) * qty;
    const printCost = form.printingCost !== "" ? Number(form.printingCost) : 0;
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayOrdersCount = orders.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return localStr === todayLocal && o.status !== "CANCELLED";
    }).length + 1;
    const pickupCost = Number((50 / Math.max(1, todayOrdersCount)).toFixed(2));
    const courierCost = 300;
    const flyerCost = 20;
    const totalCosts = stockCost + printCost + pickupCost + courierCost + flyerCost;
    const netProfit = revenue - totalCosts;
    return {
      revenue,
      stockCost,
      printCost,
      pickupCost,
      todayOrdersCount,
      courierCost,
      flyerCost,
      totalCosts,
      netProfit,
    };
  }, [form, selectedVariant, orders]);

  function updateQuantity(newQty: number) {
    const qty = Math.max(1, newQty);
    setForm((current) => ({
      ...current,
      quantity: qty,
    }));
  }

  async function parseChatText() {
    if (!chatText.trim()) return;
    setParsing(true);
    setError("");
    try {
      const res = await apiFetch<{ success: true; parsed: any }>("/orders/parse-text", {
        method: "POST",
        body: JSON.stringify({ text: chatText }),
      });
      const p = res.parsed;
      const matchingVariant = variants.find((v) =>
        p.size ? v.size.toLowerCase() === p.size.toLowerCase() || v.sku.toLowerCase().includes(p.size.toLowerCase()) : false
      );
      const parsedQty = p.quantity || 1;
      const parsedPrice = p.unitSellingPrice || 1300;
      const isInclusiveTotal = p.unitSellingPrice === 1300 || p.codAmount === 0 || (p.advancePayment + p.codAmount === 1300);
      const deliveryFee = isInclusiveTotal ? 0 : 300;

      setForm((current) => ({
        ...current,
        customerName: p.name || current.customerName,
        phone: p.phone || current.phone,
        whatsapp: p.phone || current.whatsapp || current.phone,
        city: p.city || current.city,
        address: p.address || current.address,
        designName: p.designName || current.designName || "Custom Graphic Print",
        garmentVariantId: matchingVariant?.id || current.garmentVariantId,
        quantity: parsedQty,
        unitSellingPrice: parsedPrice,
        advancePayment: p.advancePayment ?? current.advancePayment,
        advanceAccount: "EASYPAISA",
        deliveryCharged: deliveryFee,
      }));
      setMessage("📋 Chat message parsed & form auto-filled! Please enter Printing Cost Total to complete order.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleQuickFulfill(orderId: string) {
    setQuickFulfillingId(orderId);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<{ success: true; message: string }>("/orders/quick-fulfill", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });
      setMessage(res.message);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQuickFulfillingId(null);
    }
  }

  async function handleApply50RsTrip() {
    if (!tripOrderIds.length) {
      setError("Please select at least 1 order using the checkboxes to apply the 50 RS pickup trip!");
      return;
    }
    setSavingTrip(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ success: true; message: string }>("/market-trips", {
        method: "POST",
        body: JSON.stringify({
          tripDate: new Date().toISOString().slice(0, 10),
          riderName: "Market Trip Rider",
          fuelExpense: 50,
          otherExpense: 0,
          orderIds: tripOrderIds,
          notes: `Fixed 50 RS trip split across ${tripOrderIds.length} orders`,
        }),
      });
      setMessage(result.message);
      setTripOrderIds([]);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingTrip(false);
    }
  }

  function toggleTripOrderSelect(id: string) {
    setTripOrderIds((curr) => (curr.includes(id) ? curr.filter((oId) => oId !== id) : [...curr, id]));
  }

  function toggleSelectAllTripOrders() {
    const activeIds = activeTripOrders.map((o) => o.id);
    if (tripOrderIds.length === activeIds.length) {
      setTripOrderIds([]);
    } else {
      setTripOrderIds(activeIds);
    }
  }

  const activeTripOrders = orders.filter((o) => !["CANCELLED", "COMPLETED", "RETURNED", "RTO"].includes(o.status));
  const tripCount = tripOrderIds.length;
  const tripSplitCostText = tripCount > 0 ? (50 / tripCount).toFixed(2) : "50.00";

  function toggleSelectAll() {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  }

  function toggleSelectOrder(id: string) {
    setSelectedOrderIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleBulkStatusUpdate(targetStatus: string) {
    if (!selectedOrderIds.length) return;
    setBulkProcessing(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<{ success: true; message: string }>("/orders/bulk-status", {
        method: "POST",
        body: JSON.stringify({ orderIds: selectedOrderIds, targetStatus }),
      });
      setMessage(res.message);
      setSelectedOrderIds([]);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkProcessing(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const requestedQty = Number(form.quantity) || 1;
    if (!selectedVariant || selectedVariant.availableQty < requestedQty) {
      setError(`Cannot create order: Blank shirt SKU ${selectedVariant?.sku || 'selected'} is OUT OF STOCK (${selectedVariant?.availableQty ?? 0} available, ${requestedQty} requested). Please receive stock in Purchases before creating orders.`);
      return;
    }

    if (!form.printingCost || Number(form.printingCost) <= 0) {
      setError("Printing Cost Total is required! Please enter the printing cost (e.g. 370 or 400) before creating the order.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        customer: {
          name: form.customerName,
          phone: form.phone,
          whatsapp: form.whatsapp || form.phone,
          city: form.city,
          address: form.address,
          instagramUsername: form.instagramUsername,
          notes: "",
        },
        source: form.source,
        adCampaignId: form.adCampaignId,
        items: [
          {
            productDesignId: form.productDesignId,
            designName: form.designName || "Custom Graphic Print",
            garmentVariantId: form.garmentVariantId,
            quantity: Number(form.quantity) || 1,
            unitSellingPrice: form.unitSellingPrice !== "" ? Number(form.unitSellingPrice) : 1300,
            printingCost: Number(form.printingCost) || 0,
          },
        ],
        deliveryCharged: form.deliveryCharged !== "" ? Number(form.deliveryCharged) : 300,
        discount: Number(form.discount) || 0,
        advancePayment: Number(form.advancePayment) || 0,
        advanceAccount: form.advanceAccount,
        costs: {
          inventory: projected.stockCost,
          printingPickup: projected.pickupCost,
          courier: projected.courierCost,
          flyer: projected.flyerCost,
        },
        reserveStock: form.reserveStock,
      };
      const result = await apiFetch<{ success: true; message: string }>("/orders", { method: "POST", body: JSON.stringify(payload) });
      setMessage(result.message);
      setForm((current) => ({ ...todayDefaults, productDesignId: current.productDesignId, garmentVariantId: current.garmentVariantId }));
      await load();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(orderId: string, status: string) {
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ success: true; message: string }>(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, note: "Updated from orders list." }),
      });
      setMessage(result.message);
      await load();
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  if (loading) return <LoadingScreen message="Loading orders..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Orders & Automated Fulfillment</h1>
          <p className="muted">Create orders with custom designs, reserve FIFO stock, paste WhatsApp chats, and quick-fulfill orders in 1 click.</p>
        </div>
        <span className="badge">{orders.length} ORDERS</span>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      {/* 📋 EXPRESS SMART CHAT ORDER PARSER BAR */}
      <section className="card card-padding" style={{ marginBottom: "20px", borderLeft: "4px solid #10b981", backgroundColor: "rgba(16, 185, 129, 0.03)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <span>📋 Express Order Creator — Paste Customer Chat</span>
            <span className="badge" style={{ backgroundColor: "#10b981", color: "#fff" }}>AI PARSER</span>
          </h2>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <textarea
            className="input textarea"
            placeholder="Paste raw WhatsApp or Instagram customer order chat message here... (e.g. Name: Wasiq, Product: Tokyo Ghoul Tee, Size: Large, City: Lahore, Tee Price: 1300, Contact: +92 347 4289240)"
            rows={3}
            style={{ flex: 1, minWidth: "300px" }}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
          />
          <button className="button" disabled={parsing || !chatText.trim()} onClick={parseChatText} style={{ backgroundColor: "#10b981", borderColor: "#10b981", color: "#fff", height: "fit-content" }} type="button">
            {parsing ? "Parsing..." : "📋 Parse & Auto-Fill Form"}
          </button>
        </div>
      </section>

      <section className="split-layout">
        <article className="card card-padding">
          <h2 className="section-title">New order</h2>
          <form className="form" onSubmit={submit}>
            <div className="form-grid-3">
              <div className="field">
                <label>Customer name</label>
                <input className="input" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </div>
              <div className="field">
                <label>Phone / Contact</label>
                <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value, whatsapp: form.whatsapp || e.target.value })} />
              </div>
              <div className="field">
                <label>WhatsApp</label>
                <input className="input" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>
              <div className="field">
                <label>City</label>
                <input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="field">
                <label>Source</label>
                <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {["INSTAGRAM_ORGANIC", "INSTAGRAM_ADS", "FACEBOOK", "WHATSAPP", "WEBSITE", "RETURNING_CUSTOMER", "REFERENCE", "OTHER"].map((item) => (
                    <option key={item} value={item}>
                      {labelize(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Instagram username</label>
                <input className="input" value={form.instagramUsername} onChange={(e) => setForm({ ...form, instagramUsername: e.target.value })} />
              </div>
              <div className="field field-span-3">
                <label>Address</label>
                <textarea className="input textarea" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              {/* CUSTOM TEXT DESIGN FIELD */}
              <div className="field field-span-2">
                <label>Design Name (Custom Print)</label>
                <input className="input" placeholder="e.g. Tokyo Ghoul Graphic Tee" required value={form.designName} onChange={(e) => setForm({ ...form, designName: e.target.value })} />
              </div>
              <div className="field">
                <label>Blank shirt SKU</label>
                <select className="select" required value={form.garmentVariantId} onChange={(e) => setForm({ ...form, garmentVariantId: e.target.value })}>
                  <option value="">Select SKU</option>
                  {variants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.availableQty} available
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantity</label>
                <input className="input" min="1" type="number" value={form.quantity || ""} onChange={(e) => updateQuantity(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Customer Selling Price (Tee Price charged to customer)</label>
                <input className="input" placeholder="e.g. 1300" min="0" type="number" value={form.unitSellingPrice} onChange={(e) => setForm({ ...form, unitSellingPrice: e.target.value })} />
              </div>
              <div className="field">
                <label style={{ color: "#dc2626", fontWeight: "700" }}>Printing Cost Total (Rs.) * REQUIRED</label>
                <input
                  className="input"
                  placeholder="Enter printing cost (e.g. 370 or 400)"
                  min="1"
                  required
                  type="number"
                  value={form.printingCost}
                  onChange={(e) => setForm({ ...form, printingCost: e.target.value })}
                  style={{ borderColor: !form.printingCost ? "#f87171" : undefined }}
                />
              </div>
              <div className="field">
                <label>Delivery Charged (Rs.)</label>
                <input className="input" placeholder="Leave This Box Empty If There is No Delivery Charges" min="0" type="number" value={form.deliveryCharged} onChange={(e) => setForm({ ...form, deliveryCharged: e.target.value })} />
              </div>
              <div className="field">
                <label>Discount</label>
                <input className="input" placeholder="e.g. 0" min="0" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
              </div>
              <div className="field">
                <label>Advance payment (Rs.)</label>
                <input className="input" placeholder="e.g. 0" min="0" type="number" value={form.advancePayment} onChange={(e) => setForm({ ...form, advancePayment: e.target.value })} />
              </div>
              <div className="field">
                <label>Advance Received Into Wallet</label>
                <select className="select" value={form.advanceAccount} onChange={(e) => setForm({ ...form, advanceAccount: e.target.value })}>
                  <option value="EASYPAISA">EasyPaisa</option>
                  <option value="JAZZCASH">JazzCash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div className="field">
                <label>Ad campaign</label>
                <select className="select" value={form.adCampaignId} onChange={(e) => setForm({ ...form, adCampaignId: e.target.value })}>
                  <option value="">None</option>
                  {campaigns.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field checkbox-field">
                <label>
                  <input checked={form.reserveStock} type="checkbox" onChange={(e) => setForm({ ...form, reserveStock: e.target.checked })} /> Reserve stock now
                </label>
              </div>
            </div>
            <div className="actions-row">
              <button
                className="button"
                disabled={saving || !variants.length || (selectedVariant ? selectedVariant.availableQty < (Number(form.quantity) || 1) : false)}
                style={{
                  backgroundColor: selectedVariant && selectedVariant.availableQty < (Number(form.quantity) || 1) ? "#ef4444" : undefined,
                  borderColor: selectedVariant && selectedVariant.availableQty < (Number(form.quantity) || 1) ? "#ef4444" : undefined,
                }}
              >
                {saving
                  ? "Creating..."
                  : selectedVariant && selectedVariant.availableQty < (Number(form.quantity) || 1)
                  ? "⛔ Out of Stock (Disabled)"
                  : "Create order"}
              </button>
            </div>
          </form>
        </article>

        {/* RIGHT COLUMN: ORDER PREVIEW + 🛵 50 RS MARKET PICKUP TRIP ALLOCATOR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "96px", height: "fit-content" }}>
          <aside className="card card-padding calculation-card" style={{ position: "static" }}>
            <h2 className="section-title">Order preview</h2>
            <div className="calculation-list">
              <div>
                <span>Design</span>
                <strong>{form.designName ? form.designName : "—"}</strong>
              </div>
              <div>
                <span>SKU</span>
                <strong>{selectedVariant ? selectedVariant.sku : "—"}</strong>
              </div>
              <div>
                <span>Available stock</span>
                {selectedVariant ? (
                  selectedVariant.availableQty < (Number(form.quantity) || 1) ? (
                    <strong className="negative-text" style={{ fontWeight: "700" }}>
                      {selectedVariant.availableQty} ❌ OUT OF STOCK
                    </strong>
                  ) : (
                    <strong>{selectedVariant.availableQty} available</strong>
                  )
                ) : (
                  <strong>—</strong>
                )}
              </div>
              <div>
                <span>Expected Revenue</span>
                <strong>{form.unitSellingPrice !== "" ? formatCurrency(projected.revenue) : "—"}</strong>
              </div>

              <div style={{ paddingTop: "10px", marginTop: "4px", borderTop: "1px solid #e2e8f0", fontWeight: "700", fontSize: "0.8rem", color: "#475569", letterSpacing: "0.03em" }}>
                EXPENSE BREAKDOWN:
              </div>

              <div>
                <span>• Blank Shirt Cost</span>
                <strong>{selectedVariant ? formatCurrency(projected.stockCost) : "—"}</strong>
              </div>
              <div>
                <span>• Printing Cost</span>
                <strong>{form.printingCost ? formatCurrency(projected.printCost) : "⚠️ Enter printing cost"}</strong>
              </div>
              <div>
                <span>• Pickup Fee (Auto-split ⚡)</span>
                <strong>
                  {formatCurrency(projected.pickupCost)}{" "}
                  <small style={{ fontWeight: "normal", color: "#64748b" }}>(50 RS ÷ {projected.todayOrdersCount})</small>
                </strong>
              </div>
              <div>
                <span>• Courier Delivery Expense</span>
                <strong>{formatCurrency(projected.courierCost)}</strong>
              </div>
              <div>
                <span>• Flyer & Packaging Slip</span>
                <strong>{formatCurrency(projected.flyerCost)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", marginTop: "4px", borderTop: "1px dashed #cbd5e1", fontWeight: "600", fontSize: "0.85rem" }}>
                <span>Total Direct Expenses</span>
                <strong className="negative-text">
                  {selectedVariant && form.printingCost !== "" ? formatCurrency(projected.totalCosts) : "—"}
                </strong>
              </div>

              <div className="calculation-total" style={{ borderTop: "2px solid #e2e8f0", paddingTop: "8px", marginTop: "8px" }}>
                <span>Expected Net Profit</span>
                {form.unitSellingPrice !== "" && form.printingCost !== "" && selectedVariant ? (
                  <strong className={projected.netProfit >= 0 ? "positive-text" : "negative-text"} style={{ fontSize: "1.15rem" }}>
                    {formatCurrency(projected.netProfit)}
                  </strong>
                ) : (
                  <strong className="muted" style={{ fontSize: "0.85rem", fontWeight: "normal" }}>
                    — (Fill order details above)
                  </strong>
                )}
              </div>
            </div>
          </aside>

          {/* 🛵 50 RS MARKET PICKUP TRIP ALLOCATOR CARD (RIGHT SIDE BOTTOM UNDER PREVIEW) */}
          <article className="card card-padding" style={{ borderLeft: "4px solid #f97316", backgroundColor: "rgba(249, 115, 22, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <h2 className="section-title" style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🛵 50 RS Pickup Trip Allocator</span>
              </h2>
              <span className="badge" style={{ backgroundColor: "#f97316", color: "#fff", fontSize: "0.7rem" }}>FIXED 50 RS</span>
            </div>
            <p className="section-copy" style={{ margin: "0 0 10px 0", fontSize: "0.8rem", color: "#64748b" }}>
              Select orders below to split 50 RS fuel cost equally (e.g. 50 RS ÷ {tripCount || 1} = Rs. {tripSplitCostText} / order).
            </p>

            <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "8px", backgroundColor: "#fff", padding: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px", marginBottom: "4px", fontSize: "0.75rem", fontWeight: "700" }}>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  <input checked={tripOrderIds.length === activeTripOrders.length && activeTripOrders.length > 0} type="checkbox" onChange={toggleSelectAllTripOrders} />
                  <span>Select All ({activeTripOrders.length})</span>
                </label>
                <span style={{ color: "#c2410c" }}>{tripOrderIds.length} Selected</span>
              </div>

              {activeTripOrders.map((o) => (
                <label key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", cursor: "pointer", fontSize: "0.8rem", borderRadius: "4px", backgroundColor: tripOrderIds.includes(o.id) ? "#fff7ed" : "transparent" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input checked={tripOrderIds.includes(o.id)} type="checkbox" onChange={() => toggleTripOrderSelect(o.id)} />
                    <strong>{o.orderNumber}</strong>
                  </span>
                  <span style={{ fontSize: "0.75rem", color: o.costs?.printingPickup ? "#16a34a" : "#64748b", fontWeight: o.costs?.printingPickup ? "600" : "normal" }}>
                    {o.costs?.printingPickup ? `✅ Pickup Rs. ${o.costs.printingPickup}` : o.customer.name.split(" ")[0]}
                  </span>
                </label>
              ))}
              {!activeTripOrders.length ? <div className="muted" style={{ padding: "8px", textAlign: "center", fontSize: "0.8rem" }}>No active orders available.</div> : null}
            </div>

            <button
              className="button"
              disabled={savingTrip || !tripOrderIds.length}
              onClick={handleApply50RsTrip}
              style={{ backgroundColor: "#f97316", borderColor: "#f97316", color: "#fff", fontSize: "0.85rem", width: "100%", marginTop: "10px" }}
              type="button"
            >
              {savingTrip ? "Applying..." : `🛵 Apply 50 RS Trip (${tripOrderIds.length} Orders Selected)`}
            </button>
          </article>
        </div>
      </section>

      {/* BULK SELECTION TOOLBAR */}
      {selectedOrderIds.length > 0 ? (
        <section className="card card-padding" style={{ marginBottom: "16px", backgroundColor: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <strong>{selectedOrderIds.length} Orders Selected</strong>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem" }}>Advance Selected Stage:</span>
            {["STOCK_RESERVED", "SENT_FOR_PRINTING", "PRINTING_COMPLETED", "READY_TO_PACK", "SHIPPED"].map((st) => (
              <button key={st} className="button button-secondary compact-button" disabled={bulkProcessing} onClick={() => void handleBulkStatusUpdate(st)} type="button">
                {labelize(st)}
              </button>
            ))}
            <button className="button compact-button" onClick={() => setSelectedOrderIds([])} type="button">
              Clear
            </button>
          </div>
        </section>
      ) : null}

      <section className="card users-table-card">
        <div className="table-wrap">
          <table className="table order-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input checked={selectedOrderIds.length === orders.length && orders.length > 0} type="checkbox" onChange={toggleSelectAll} />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Items / Custom Design</th>
                <th>Revenue</th>
                <th>Direct cost</th>
                <th>Profit</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <input checked={selectedOrderIds.includes(order.id)} type="checkbox" onChange={() => toggleSelectOrder(order.id)} />
                  </td>
                  <td>
                    <Link className="link-button code-text" href={`/orders/${order.id}`}>
                      {order.orderNumber}
                    </Link>
                    <div className="table-subtext">{labelize(order.source)}</div>
                  </td>
                  <td>
                    <strong>{order.customer.name}</strong>
                    <div className="table-subtext">
                      {order.customer.phone} · {order.customer.city}
                    </div>
                  </td>
                  <td>{order.items.map((item) => `${item.designName} / ${item.sku} ×${item.quantity}`).join(", ")}</td>
                  <td>{formatCurrency(order.revenue)}</td>
                  <td>{formatCurrency(order.directCost)}</td>
                  <td className={(order.profit ?? 0) >= 0 ? "positive-text" : "negative-text"}>
                    <strong>{formatCurrency(order.profit ?? 0)}</strong>
                  </td>
                  <td>
                    <span className="badge">{labelize(order.status)}</span>
                  </td>
                  <td>{labelize(order.paymentStatus)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="button compact-button"
                        disabled={quickFulfillingId === order.id || ["SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"].includes(order.status)}
                        onClick={() => void handleQuickFulfill(order.id)}
                        style={{ backgroundColor: "#3b82f6", borderColor: "#3b82f6", color: "#fff" }}
                        type="button"
                      >
                        {quickFulfillingId === order.id ? "Fulfilling..." : "⚡ Fulfill"}
                      </button>
                      <select className="select compact-select" value={order.status} onChange={(e) => void setStatus(order.id, e.target.value)}>
                        {["DRAFT", "CONFIRMED", "STOCK_RESERVED", "SENT_FOR_PRINTING", "PRINTING_COMPLETED", "READY_TO_PACK", "SHIPPED", "DELIVERED", "COD_PENDING", "COMPLETED", "RTO", "RETURNED", "CANCELLED"].map((item) => (
                          <option key={item} value={item}>
                            {labelize(item)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length ? (
                <tr>
                  <td className="empty-state" colSpan={10}>
                    No orders yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
