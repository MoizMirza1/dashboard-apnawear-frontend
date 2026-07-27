"use client";

import { useEffect, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, labelize } from "@/lib/format";
import type { MarketTrip, Order, PrintingJob } from "@/types";

const initialForm = { orderId: "", printerName: "", printingCost: 400, pickupCost: 0, sentAt: new Date().toISOString().slice(0, 10), dueAt: "", notes: "" };
const initialTripForm = { tripDate: new Date().toISOString().slice(0, 10), riderName: "Self / Rider", fuelExpense: 120, otherExpense: 0, selectedOrderIds: [] as string[], notes: "" };

export default function PrintingPage() {
  const [jobs, setJobs] = useState<PrintingJob[]>([]);
  const [trips, setTrips] = useState<MarketTrip[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [form, setForm] = useState(initialForm);
  const [tripForm, setTripForm] = useState(initialTripForm);
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
          pickupCost: Number(form.pickupCost) || 0,
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

  async function submitTrip(event: FormEvent) {
    event.preventDefault();
    if (!tripForm.selectedOrderIds.length) {
      setError("Please select at least 1 order for this market pickup trip!");
      return;
    }
    setSavingTrip(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ success: true; message: string }>("/market-trips", {
        method: "POST",
        body: JSON.stringify({
          tripDate: tripForm.tripDate,
          riderName: tripForm.riderName,
          fuelExpense: Number(tripForm.fuelExpense) || 0,
          otherExpense: Number(tripForm.otherExpense) || 0,
          orderIds: tripForm.selectedOrderIds,
          notes: tripForm.notes,
        }),
      });
      setMessage(result.message);
      setTripForm(initialTripForm);
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

  function toggleOrderForTrip(id: string) {
    setTripForm((curr) => {
      const exists = curr.selectedOrderIds.includes(id);
      const next = exists ? curr.selectedOrderIds.filter((oId) => oId !== id) : [...curr.selectedOrderIds, id];
      return { ...curr, selectedOrderIds: next };
    });
  }

  const activeOrdersForTrip = allOrders.filter((o) => !["CANCELLED", "COMPLETED", "RETURNED", "RTO"].includes(o.status));

  const totalFuel = (Number(tripForm.fuelExpense) || 0) + (Number(tripForm.otherExpense) || 0);
  const orderCount = tripForm.selectedOrderIds.length;
  const perOrderSplit = orderCount > 0 ? (totalFuel / orderCount).toFixed(2) : "0.00";

  if (loading) return <LoadingScreen message="Loading printing & market trips..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Printing Jobs & Market Trips</h1>
          <p className="muted">Log print jobs, create market pickup runs, and auto-split actual fuel expenses across orders.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <span className="badge">{jobs.length} PRINT JOBS</span>
          <span className="badge badge-partner">{trips.length} MARKET TRIPS</span>
        </div>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      <div className="split-layout">
        {/* 🛵 MARKET TRIP LOGGER CARD */}
        <article className="card card-padding" style={{ borderLeft: "4px solid #f97316" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 className="section-title" style={{ margin: 0 }}>🛵 Log Market Pickup Trip (Idea 1)</h2>
            <span className="badge" style={{ backgroundColor: "#f97316", color: "#fff" }}>AUTO-SPLIT FUEL</span>
          </div>
          <form className="form" onSubmit={submitTrip}>
            <div className="two-column-form">
              <div className="field">
                <label>Trip Date</label>
                <input className="input" type="date" value={tripForm.tripDate} onChange={(e) => setTripForm({ ...tripForm, tripDate: e.target.value })} />
              </div>
              <div className="field">
                <label>Rider / Carrier Name</label>
                <input className="input" value={tripForm.riderName} onChange={(e) => setTripForm({ ...tripForm, riderName: e.target.value })} />
              </div>
              <div className="field">
                <label>Fuel / Petrol Expense (Rs.)</label>
                <input className="input" min="0" type="number" value={tripForm.fuelExpense || ""} onChange={(e) => setTripForm({ ...tripForm, fuelExpense: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Other Trip Expenses (Rs.)</label>
                <input className="input" min="0" type="number" value={tripForm.otherExpense || ""} onChange={(e) => setTripForm({ ...tripForm, otherExpense: Number(e.target.value) })} />
              </div>
            </div>

            <div className="field top-gap">
              <label>Select Orders Picked Up on This Trip ({orderCount} selected)</label>
              <div style={{ maxHeight: "140px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px" }}>
                {activeOrdersForTrip.map((o) => (
                  <label key={o.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", cursor: "pointer", fontSize: "0.85rem" }}>
                    <input checked={tripForm.selectedOrderIds.includes(o.id)} type="checkbox" onChange={() => toggleOrderForTrip(o.id)} />
                    <strong>{o.orderNumber}</strong> · {o.customer.name} ({formatCurrency(o.revenue)})
                  </label>
                ))}
                {!activeOrdersForTrip.length ? <div className="muted" style={{ fontSize: "0.85rem" }}>No active orders available.</div> : null}
              </div>
            </div>

            {/* Split Preview Banner */}
            <div style={{ marginTop: "12px", backgroundColor: "#fff7ed", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ffedd5" }}>
              <span style={{ fontSize: "0.85rem", color: "#c2410c", fontWeight: "600" }}>
                ⚡ Auto-Split Calculation: Total Rs. {totalFuel} ÷ {orderCount} orders = <strong style={{ fontSize: "1rem" }}>Rs. {perOrderSplit}</strong> per order
              </span>
            </div>

            <div className="actions-row">
              <button className="button" disabled={savingTrip || !orderCount} style={{ backgroundColor: "#f97316", borderColor: "#f97316", color: "#fff" }}>
                {savingTrip ? "Logging..." : "🛵 Log Trip & Apply Split Pickup Fee"}
              </button>
            </div>
          </form>
        </article>

        {/* 🖨️ PRINT JOB FORM CARD */}
        <article className="card card-padding">
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
              <div className="field">
                <label>Sent Date</label>
                <input className="input" type="date" value={form.sentAt} onChange={(e) => setForm({ ...form, sentAt: e.target.value })} />
              </div>
              <div className="field">
                <label>Due Date</label>
                <input className="input" type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
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
          <h2 className="section-title">🛵 Logged Market Trips</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Trip #</th>
                <th>Date</th>
                <th>Rider</th>
                <th>Total Fuel Expense</th>
                <th>Orders Count</th>
                <th>Split Pickup Cost / Order</th>
                <th>Orders Included</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td className="code-text">{trip.tripNumber}</td>
                  <td>{formatDate(trip.tripDate)}</td>
                  <td>{trip.riderName}</td>
                  <td className="negative-text">
                    <strong>{formatCurrency(trip.totalTripCost)}</strong>
                  </td>
                  <td>
                    <span className="badge">{trip.orders.length} orders</span>
                  </td>
                  <td className="positive-text">
                    <strong>{formatCurrency(trip.perOrderPickupCost)} / order</strong>
                  </td>
                  <td>{trip.orders.map((o) => o.orderNumber).join(", ")}</td>
                </tr>
              ))}
              {!trips.length ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    No market trips logged yet.
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
                <th>Printing Cost</th>
                <th>Pickup Cost (Allocated)</th>
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
                  <td>{formatCurrency(job.printingCost)}</td>
                  <td>
                    <strong>{formatCurrency(job.pickupCost)}</strong>
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
                  <td className="empty-state" colSpan={7}>
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
