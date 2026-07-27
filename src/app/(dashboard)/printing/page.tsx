"use client";

import { useEffect, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { MarketTrip, Order, PrintingJob } from "@/types";

const initialForm = { orderId: "", printerName: "In-House Printer", printingCost: 400, sentAt: new Date().toISOString().slice(0, 10), dueAt: "", notes: "" };

export default function PrintingPage() {
  const [jobs, setJobs] = useState<PrintingJob[]>([]);
  const [trips, setTrips] = useState<MarketTrip[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [jobData, orderData, tripData] = await Promise.all([
        apiFetch<{ success: true; jobs: PrintingJob[] }>("/printing-jobs"),
        apiFetch<{ success: true; orders: Order[] }>("/orders?limit=200"),
        apiFetch<{ success: true; trips: MarketTrip[] }>("/market-trips").catch(() => ({ success: true, trips: [] })),
      ]);
      setJobs(jobData.jobs);
      setAllOrders(orderData.orders);
      setTrips(tripData.trips);

      const eligible = orderData.orders.filter((order) => ["DRAFT", "STOCK_RESERVED", "CONFIRMED"].includes(order.status) && !jobData.jobs.some((job) => job.order.id === order.id));
      setForm((current) => ({ ...current, orderId: current.orderId || eligible[0]?.id || "" }));
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitJob(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ success: true; message: string }>("/printing-jobs", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          printingCost: Number(form.printingCost) || 0,
          pickupCost: 0,
          sentAt: form.sentAt || undefined,
          dueAt: form.dueAt || undefined,
        }),
      });
      setMessage(result.message);
      setForm(initialForm);
      await load();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApply50RsTrip() {
    if (!selectedOrderIds.length) {
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
          orderIds: selectedOrderIds,
          notes: `Fixed 50 RS trip split across ${selectedOrderIds.length} orders`,
        }),
      });
      setMessage(result.message);
      setSelectedOrderIds([]);
      await load();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSavingTrip(false);
    }
  }

  async function update(id: string, status: PrintingJob["status"]) {
    try {
      const result = await apiFetch<{ success: true; message: string }>(`/printing-jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage(result.message);
      await load();
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  function toggleOrderSelect(id: string) {
    setSelectedOrderIds((curr) => (curr.includes(id) ? curr.filter((oId) => oId !== id) : [...curr, id]));
  }

  function toggleSelectAllForTrip() {
    const activeIds = activeOrdersForTrip.map((o) => o.id);
    if (selectedOrderIds.length === activeIds.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(activeIds);
    }
  }

  const activeOrdersForTrip = allOrders.filter((o) => !["CANCELLED", "COMPLETED", "RETURNED", "RTO"].includes(o.status));
  const count = selectedOrderIds.length;
  const splitCostText = count > 0 ? (50 / count).toFixed(2) : "50.00";

  if (loading) return <LoadingScreen message="Loading printing & market trips..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Printing Jobs & Fixed 50 RS Pickup Trip Allocator</h1>
          <p className="muted">Select orders using checkboxes and click the single button to split 50 RS pickup cost equally.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <span className="badge">{jobs.length} PRINT JOBS</span>
          <span className="badge badge-partner">{trips.length} MARKET TRIPS</span>
        </div>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      {/* 🛵 SINGLE-BUTTON 50 RS PICKUP TRIP ALLOCATOR */}
      <section className="card card-padding" style={{ marginBottom: "20px", borderLeft: "4px solid #f97316", backgroundColor: "rgba(249, 115, 22, 0.03)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <h2 className="section-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🛵 50 RS Market Pickup Trip Allocator</span>
              <span className="badge" style={{ backgroundColor: "#f97316", color: "#fff" }}>FIXED 50 RS</span>
            </h2>
            <p className="section-copy" style={{ margin: "4px 0 0 0" }}>
              Select orders below with checkboxes to split 50 RS fuel cost equally (e.g. 50 RS ÷ {count || 1} = Rs. {splitCostText} per order).
            </p>
          </div>
          <button
            className="button"
            disabled={savingTrip || !count}
            onClick={handleApply50RsTrip}
            style={{ backgroundColor: "#f97316", borderColor: "#f97316", color: "#fff", fontSize: "0.95rem", padding: "10px 20px" }}
            type="button"
          >
            {savingTrip ? "Applying..." : `🛵 Apply 50 RS Pickup Trip (${count} Orders Selected)`}
          </button>
        </div>

        {/* Checkbox Order Selector Table */}
        <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "8px", backgroundColor: "#fff", padding: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginBottom: "6px", fontSize: "0.85rem", fontWeight: "700" }}>
            <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <input checked={selectedOrderIds.length === activeOrdersForTrip.length && activeOrdersForTrip.length > 0} type="checkbox" onChange={toggleSelectAllForTrip} />
              <span>Select All Orders for Pickup Trip</span>
            </label>
            <span style={{ color: "#c2410c" }}>Current Split: Rs. {splitCostText} / order</span>
          </div>

          {activeOrdersForTrip.map((o) => (
            <label key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", cursor: "pointer", fontSize: "0.875rem", borderRadius: "4px", backgroundColor: selectedOrderIds.includes(o.id) ? "#fff7ed" : "transparent" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input checked={selectedOrderIds.includes(o.id)} type="checkbox" onChange={() => toggleOrderSelect(o.id)} />
                <strong>{o.orderNumber}</strong> — {o.customer.name} ({o.customer.city})
              </span>
              <span className="badge">{labelize(o.status)}</span>
            </label>
          ))}
          {!activeOrdersForTrip.length ? <div className="muted" style={{ padding: "12px", textAlign: "center" }}>No active orders available for pickup.</div> : null}
        </div>
      </section>

      <div className="split-layout">
        {/* 🖨️ PRINT JOB FORM CARD */}
        <article className="card card-padding" style={{ flex: 1 }}>
          <h2 className="section-title">🖨️ Create Individual Printing Job</h2>
          <form className="form" onSubmit={submitJob}>
            <div className="field">
              <label>Order</label>
              <select className="select" required value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}>
                <option value="">Select order</option>
                {allOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} · {order.customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="two-column-form">
              <div className="field">
                <label>Printer / Vendor</label>
                <input className="input" required value={form.printerName} onChange={(e) => setForm({ ...form, printerName: e.target.value })} />
              </div>
              <div className="field">
                <label>Printing Cost Total (Rs.)</label>
                <input className="input" min="0" type="number" value={form.printingCost || ""} onChange={(e) => setForm({ ...form, printingCost: Number(e.target.value) })} />
              </div>
            </div>
            <div className="actions-row">
              <button className="button" disabled={saving || !allOrders.length}>
                {saving ? "Creating..." : "Create Job"}
              </button>
            </div>
          </form>
        </article>
      </div>

      {/* 🛵 MARKET TRIPS HISTORY TABLE */}
      <section className="card users-table-card top-gap">
        <div className="card-padding">
          <h2 className="section-title">🛵 Logged 50 RS Pickup Trips</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Trip #</th>
                <th>Date</th>
                <th>Trip Expense</th>
                <th>Orders Count</th>
                <th>Value Added Per Order</th>
                <th>Orders Included</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td className="code-text">{trip.tripNumber}</td>
                  <td>{formatDate(trip.tripDate)}</td>
                  <td className="negative-text">
                    <strong>{formatCurrency(trip.totalTripCost)}</strong>
                  </td>
                  <td>
                    <span className="badge">{trip.orders.length} orders</span>
                  </td>
                  <td className="positive-text">
                    <strong>{formatCurrency(trip.perOrderPickupCost)} added per order</strong>
                  </td>
                  <td>{trip.orders.map((o) => o.orderNumber).join(", ")}</td>
                </tr>
              ))}
              {!trips.length ? (
                <tr>
                  <td className="empty-state" colSpan={6}>
                    No market trips logged yet. Select orders above to log a 50 RS trip!
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* PRINTING JOBS TABLE */}
      <section className="card users-table-card top-gap">
        <div className="card-padding">
          <h2 className="section-title">🖨️ Printing Jobs List</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Order</th>
                <th>Printer</th>
                <th>Printing Cost (Incl. Pickup)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="code-text">{job.jobNumber}</td>
                  <td>
                    <strong>{job.order.orderNumber}</strong>
                    <div className="table-subtext">{job.order.customer.name}</div>
                  </td>
                  <td>{job.printerName}</td>
                  <td>
                    <strong>{formatCurrency(job.printingCost + (job.pickupCost || 0))}</strong>
                  </td>
                  <td>
                    <span className="badge">{labelize(job.status)}</span>
                  </td>
                  <td>
                    <select className="select compact-select" value={job.status} onChange={(e) => void update(job.id, e.target.value as PrintingJob["status"])}>
                      {["PENDING", "SENT", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!jobs.length ? (
                <tr>
                  <td className="empty-state" colSpan={6}>
                    No printing jobs yet.
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
