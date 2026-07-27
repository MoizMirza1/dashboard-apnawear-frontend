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
  unitSellingPrice: 1300,
  printingCost: "",
  perShirtPrintingCost: 400,
  printingPickup: 50,
  deliveryCharged: 300,
  discount: 0,
  advancePayment: 0,
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

  // Automation state
  const [chatText, setChatText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [quickFulfillingId, setQuickFulfillingId] = useState<string | null>(null);

  async function load() {
    try {
      const [orderData, productData, variantData, campaignData, settingsData] = await Promise.all([
        apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200"),
        apiFetch<{ success: true; products: ProductDesign[] }>("/products?status=ACTIVE"),
        apiFetch<{ success: true; variants: GarmentVariant[] }>("/inventory/variants?active=true"),
        apiFetch<{ success: true; campaigns: AdCampaign[] }>("/ad-campaigns"),
        apiFetch<{ success: true; settings: any }>("/settings").catch(() => null),
      ]);

      const defaultPrinting = settingsData?.settings?.defaultCosts?.defaultPrintingCost ?? 400;
      const defaultCourier = settingsData?.settings?.defaultCosts?.courier ?? 300;
      const defaultPickup = settingsData?.settings?.defaultCosts?.printingPickup ?? 50;

      setOrders(orderData.orders);
      setProducts(productData.products);
      setVariants(variantData.variants);
      setCampaigns(campaignData.campaigns);
      setForm((current) => {
        const product = productData.products.find((item) => item.id === current.productDesignId) ?? productData.products[0];
        const variant = variantData.variants.find((item) => item.id === current.garmentVariantId) ?? variantData.variants[0];
        const price = variant?.garmentType === "DROP_SHOULDER" ? product?.dropShoulderSellingPrice : product?.regularSellingPrice;
        return {
          ...current,
          productDesignId: product?.id ?? "",
          designName: current.designName || product?.name || "Custom Graphic Print",
          garmentVariantId: variant?.id ?? "",
          unitSellingPrice: price ?? current.unitSellingPrice,
          deliveryCharged: defaultCourier,
          perShirtPrintingCost: defaultPrinting,
          printingPickup: defaultPickup,
          printingCost: current.printingCost,
        };
      });
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
    const stockCost = (selectedVariant?.effectiveUnitCost ?? 400) * qty;
    const printCost = Number(form.printingCost) || 0;
    const pickupCost = Number(form.printingPickup) ?? 50;
    const courierCost = 300;
    const flyerCost = 20;
    const totalCosts = stockCost + printCost + pickupCost + courierCost + flyerCost;
    const netProfit = revenue - totalCosts;
    return {
      revenue,
      stockCost,
      printCost,
      pickupCost,
      courierCost,
      flyerCost,
      totalCosts,
      netProfit,
    };
  }, [form, selectedVariant]);

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
            unitSellingPrice: Number(form.unitSellingPrice) || 0,
            printingCost: Number(form.printingCost) || 0,
          },
        ],
        deliveryCharged: Number(form.deliveryCharged) || 300,
        discount: Number(form.discount) || 0,
        advancePayment: Number(form.advancePayment) || 0,
        advanceAccount: form.advanceAccount,
        costs: {
          printingPickup: Number(form.printingPickup) ?? 50,
        },
        reserveStock: form.reserveStock,
      };
      const result = await apiFetch<{ success: true; message: string }>("/orders", { method: "POST", body: JSON.stringify(payload) });
      setMessage(result.message);
      setForm((current) => ({ ...todayDefaults, productDesignId: current.productDesignId, garmentVariantId: current.garmentVariantId, unitSellingPrice: current.unitSellingPrice, deliveryCharged: 300 }));
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
                <input className="input" placeholder="e.g. 1300 (Tee Price from customer message)" min="0" type="number" value={form.unitSellingPrice || ""} onChange={(e) => setForm({ ...form, unitSellingPrice: Number(e.target.value) })} />
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
                <label>Printing Pickup Fee (Rs.)</label>
                <input
                  className="input"
                  placeholder="e.g. 50 (or 25 if 1 trip covers 2 orders)"
                  min="0"
                  type="number"
                  value={form.printingPickup}
                  onChange={(e) => setForm({ ...form, printingPickup: Number(e.target.value) })}
                />
                <small className="field-help" style={{ color: "#64748b", fontSize: "0.75rem" }}>
                  Tip: If 1 pickup trip collects 2 prints, set Rs. 25 on each order (or 0 for shared pickup).
                </small>
              </div>
              <div className="field">
                <label>Delivery Charged (Fixed Rs. 300)</label>
                <input className="input" min="0" type="number" value={form.deliveryCharged ?? 300} onChange={(e) => setForm({ ...form, deliveryCharged: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Discount</label>
                <input className="input" min="0" type="number" value={form.discount || ""} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Advance payment (Rs.)</label>
                <input className="input" min="0" type="number" value={form.advancePayment || ""} onChange={(e) => setForm({ ...form, advancePayment: Number(e.target.value) })} />
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
              <button className="button" disabled={saving || !variants.length}>
                {saving ? "Creating..." : "Create order"}
              </button>
            </div>
          </form>
        </article>
        <aside className="card card-padding calculation-card">
          <h2 className="section-title">Order preview</h2>
          <div className="calculation-list">
            <div>
              <span>Design</span>
              <strong>{form.designName || selectedProduct?.name || "Custom Graphic"}</strong>
            </div>
            <div>
              <span>SKU</span>
              <strong>{selectedVariant?.sku ?? "—"}</strong>
            </div>
            <div>
              <span>Available stock</span>
              <strong>{selectedVariant?.availableQty ?? 0}</strong>
            </div>
            <div>
              <span>Blank shirt cost</span>
              <strong>{formatCurrency(projected.stockCost)}</strong>
            </div>
            <div>
              <span>Printing cost</span>
              <strong>{projected.printCost ? formatCurrency(projected.printCost) : "⚠️ Enter printing cost"}</strong>
            </div>
            <div>
              <span>Printing pickup fee</span>
              <strong>{formatCurrency(projected.pickupCost)}</strong>
            </div>
            <div>
              <span>Delivery cost</span>
              <strong>{formatCurrency(projected.courierCost)}</strong>
            </div>
            <div>
              <span>Expected revenue</span>
              <strong>{formatCurrency(projected.revenue)}</strong>
            </div>
            <div className="calculation-total" style={{ borderTop: "2px solid #e2e8f0", paddingTop: "8px", marginTop: "8px" }}>
              <span>Expected Net Profit</span>
              <strong className={projected.netProfit >= 0 ? "positive-text" : "negative-text"} style={{ fontSize: "1.15rem" }}>
                {formatCurrency(projected.netProfit)}
              </strong>
            </div>
          </div>
        </aside>
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
                  <td className={order.profitAfterAds >= 0 ? "positive-text" : "negative-text"}>
                    <strong>{formatCurrency(order.profitAfterAds)}</strong>
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
