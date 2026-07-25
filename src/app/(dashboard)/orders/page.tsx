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
  garmentVariantId: "",
  quantity: 1,
  unitSellingPrice: 1300,
  printingCost: 400,
  deliveryCharged: 0,
  discount: 0,
  advancePayment: 0,
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

  async function load() {
    try {
      const [orderData, productData, variantData, campaignData] = await Promise.all([
        apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200"),
        apiFetch<{ success: true; products: ProductDesign[] }>("/products?status=ACTIVE"),
        apiFetch<{ success: true; variants: GarmentVariant[] }>("/inventory/variants?active=true"),
        apiFetch<{ success: true; campaigns: AdCampaign[] }>("/ad-campaigns"),
      ]);
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
          garmentVariantId: variant?.id ?? "",
          unitSellingPrice: price ?? current.unitSellingPrice,
        };
      });
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selectedVariant = variants.find((item) => item.id === form.garmentVariantId);
  const selectedProduct = products.find((item) => item.id === form.productDesignId);
  const projected = useMemo(() => ({
    revenue: (Number(form.unitSellingPrice) || 0) * (Number(form.quantity) || 0) + (Number(form.deliveryCharged) || 0) - (Number(form.discount) || 0),
    stockCost: (selectedVariant?.effectiveUnitCost ?? 0) * (Number(form.quantity) || 0),
  }), [form, selectedVariant]);

  function updateSelection(productId: string, variantId = form.garmentVariantId) {
    const product = products.find((item) => item.id === productId);
    const variant = variants.find((item) => item.id === variantId);
    const price = variant?.garmentType === "DROP_SHOULDER" ? product?.dropShoulderSellingPrice : product?.regularSellingPrice;
    setForm((current) => ({ ...current, productDesignId: productId, garmentVariantId: variantId, unitSellingPrice: price ?? current.unitSellingPrice }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = {
        customer: {
          name: form.customerName,
          phone: form.phone,
          whatsapp: form.whatsapp,
          city: form.city,
          address: form.address,
          instagramUsername: form.instagramUsername,
          notes: "",
        },
        source: form.source,
        adCampaignId: form.adCampaignId,
        items: [{
          productDesignId: form.productDesignId,
          garmentVariantId: form.garmentVariantId,
          quantity: Number(form.quantity) || 1,
          unitSellingPrice: Number(form.unitSellingPrice) || 0,
          printingCost: Number(form.printingCost) || 0,
        }],
        deliveryCharged: Number(form.deliveryCharged) || 0,
        discount: Number(form.discount) || 0,
        advancePayment: Number(form.advancePayment) || 0,
        reserveStock: form.reserveStock,
      };
      const result = await apiFetch<{ success: true; message: string }>("/orders", { method: "POST", body: JSON.stringify(payload) });
      setMessage(result.message);
      setForm((current) => ({ ...todayDefaults, productDesignId: current.productDesignId, garmentVariantId: current.garmentVariantId, unitSellingPrice: current.unitSellingPrice }));
      await load();
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setSaving(false); }
  }

  async function setStatus(orderId: string, status: string) {
    setError(""); setMessage("");
    try {
      const result = await apiFetch<{ success: true; message: string }>(`/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status, note: "Updated from orders list." }) });
      setMessage(result.message); await load();
    } catch (requestError) { setError((requestError as Error).message); }
  }

  if (loading) return <LoadingScreen message="Loading orders..." />;

  return <main className="page">
    <div className="page-header"><div><h1>Orders</h1><p className="muted">Create orders, reserve FIFO stock and monitor actual order profit.</p></div><span className="badge">{orders.length} ORDERS</span></div>
    {error ? <div className="error-box page-message">{error}</div> : null}
    {message ? <div className="success-box page-message">{message}</div> : null}

    <section className="split-layout">
      <article className="card card-padding">
        <h2 className="section-title">New order</h2>
        <form className="form" onSubmit={submit}>
          <div className="form-grid-3">
            <div className="field"><label>Customer name</label><input className="input" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>WhatsApp</label><input className="input" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="field"><label>City</label><input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="field"><label>Source</label><select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{["INSTAGRAM_ORGANIC","INSTAGRAM_ADS","FACEBOOK","WHATSAPP","WEBSITE","RETURNING_CUSTOMER","REFERENCE","OTHER"].map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></div>
            <div className="field"><label>Instagram username</label><input className="input" value={form.instagramUsername} onChange={(e) => setForm({ ...form, instagramUsername: e.target.value })} /></div>
            <div className="field field-span-3"><label>Address</label><textarea className="input textarea" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="field"><label>Design</label><select className="select" required value={form.productDesignId} onChange={(e) => updateSelection(e.target.value)}><option value="">Select</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="field"><label>Blank shirt SKU</label><select className="select" required value={form.garmentVariantId} onChange={(e) => updateSelection(form.productDesignId, e.target.value)}><option value="">Select</option>{variants.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.availableQty} available</option>)}</select></div>
            <div className="field"><label>Quantity</label><input className="input" min="1" type="number" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div className="field"><label>Selling price / shirt</label><input className="input" min="0" type="number" value={form.unitSellingPrice || ""} onChange={(e) => setForm({ ...form, unitSellingPrice: Number(e.target.value) })} /></div>
            <div className="field"><label>Printing cost total</label><input className="input" min="0" type="number" value={form.printingCost || ""} onChange={(e) => setForm({ ...form, printingCost: Number(e.target.value) })} /></div>
            <div className="field"><label>Delivery charged to customer</label><input className="input" min="0" type="number" value={form.deliveryCharged || ""} onChange={(e) => setForm({ ...form, deliveryCharged: Number(e.target.value) })} /></div>
            <div className="field"><label>Discount</label><input className="input" min="0" type="number" value={form.discount || ""} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} /></div>
            <div className="field"><label>Advance payment</label><input className="input" min="0" type="number" value={form.advancePayment || ""} onChange={(e) => setForm({ ...form, advancePayment: Number(e.target.value) })} /></div>
            <div className="field"><label>Ad campaign</label><select className="select" value={form.adCampaignId} onChange={(e) => setForm({ ...form, adCampaignId: e.target.value })}><option value="">None</option>{campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="field checkbox-field"><label><input checked={form.reserveStock} type="checkbox" onChange={(e) => setForm({ ...form, reserveStock: e.target.checked })} /> Reserve stock now</label></div>
          </div>
          <div className="actions-row"><button className="button" disabled={saving || !products.length || !variants.length}>{saving ? "Creating..." : "Create order"}</button></div>
        </form>
      </article>
      <aside className="card card-padding calculation-card">
        <h2 className="section-title">Order preview</h2>
        <div className="calculation-list">
          <div><span>Design</span><strong>{selectedProduct?.name ?? "—"}</strong></div>
          <div><span>SKU</span><strong>{selectedVariant?.sku ?? "—"}</strong></div>
          <div><span>Available stock</span><strong>{selectedVariant?.availableQty ?? 0}</strong></div>
          <div><span>Estimated blank cost</span><strong>{formatCurrency(projected.stockCost)}</strong></div>
          <div className="calculation-total"><span>Expected revenue</span><strong>{formatCurrency(projected.revenue)}</strong></div>
        </div>
      </aside>
    </section>

    <section className="card users-table-card"><div className="table-wrap"><table className="table order-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Revenue</th><th>Direct cost</th><th>Profit</th><th>Status</th><th>Payment</th><th>Created</th><th>Action</th></tr></thead><tbody>
      {orders.map((order) => <tr key={order.id}>
        <td><Link className="link-button code-text" href={`/orders/${order.id}`}>{order.orderNumber}</Link><div className="table-subtext">{labelize(order.source)}</div></td>
        <td><strong>{order.customer.name}</strong><div className="table-subtext">{order.customer.phone} · {order.customer.city}</div></td>
        <td>{order.items.map((item) => `${item.designName} / ${item.sku} ×${item.quantity}`).join(", ")}</td>
        <td>{formatCurrency(order.revenue)}</td><td>{formatCurrency(order.directCost)}</td><td className={order.profitAfterAds >= 0 ? "positive-text" : "negative-text"}><strong>{formatCurrency(order.profitAfterAds)}</strong></td>
        <td><span className="badge">{labelize(order.status)}</span></td><td>{labelize(order.paymentStatus)}</td><td>{formatDate(order.createdAt)}</td>
        <td><select className="select compact-select" value={order.status} onChange={(e) => void setStatus(order.id, e.target.value)}>{["DRAFT","CONFIRMED","STOCK_RESERVED","SENT_FOR_PRINTING","PRINTING_COMPLETED","READY_TO_PACK","SHIPPED","DELIVERED","COD_PENDING","COMPLETED","RTO","RETURNED","CANCELLED"].map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></td>
      </tr>)}
      {!orders.length ? <tr><td className="empty-state" colSpan={10}>No orders yet.</td></tr> : null}
    </tbody></table></div></section>
  </main>;
}
