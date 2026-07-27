"use client";

import { useEffect, useState, type FormEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import StatCard from "@/components/dashboard/stat-card";
import { apiFetch } from "@/lib/api";
import { formatCurrency, labelize } from "@/lib/format";
import type { ProfitLossReport } from "@/types";

type OrdersReport = {
  byStatus: Array<{ _id: string; orders: number; revenue: number; profit: number }>;
  bySource: Array<{ _id: string; orders: number; revenue: number }>;
  topCities: Array<{ _id: string; orders: number; revenue: number }>;
};

type CourierReport = {
  booked: number;
  delivered: number;
  rto: number;
  cod: number;
  unsettledCod: number;
  courierCharges: number;
  deliveryRate: number;
  rtoRate: number;
};

type GrowthPoint = {
  date: string;
  orders: number;
  revenue: number;
  cost: number;
  profit: number;
};

export default function ReportsPage() {
  const [range, setRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [profit, setProfit] = useState<ProfitLossReport | null>(null);
  const [orders, setOrders] = useState<OrdersReport | null>(null);
  const [courier, setCourier] = useState<CourierReport | null>(null);
  const [growthData, setGrowthData] = useState<GrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = `?from=${range.from}&to=${range.to}`;
      const [profitData, orderData, courierData, growthRes] = await Promise.all([
        apiFetch<{ success: true; report: ProfitLossReport }>(`/reports/profit-loss${query}`),
        apiFetch<{ success: true; report: OrdersReport }>(`/reports/orders${query}`),
        apiFetch<{ success: true; report: CourierReport }>(`/reports/courier${query}`),
        apiFetch<{ success: true; report: GrowthPoint[] }>(`/reports/growth-chart${query}`),
      ]);
      setProfit(profitData.report);
      setOrders(orderData.report);
      setCourier(courierData.report);

      // Clean up growthData: filter out long sequences of empty days so the graph remains ultra-clean
      const activeData = growthRes.report.filter((d, idx, arr) => {
        if (d.revenue > 0 || d.orders > 0 || d.cost > 0) return true;
        // Keep start, end, or days adjacent to sales
        const prevHas = arr[idx - 1] && (arr[idx - 1].revenue > 0 || arr[idx - 1].orders > 0);
        const nextHas = arr[idx + 1] && (arr[idx + 1].revenue > 0 || arr[idx + 1].orders > 0);
        return prevHas || nextHas || idx === 0 || idx === arr.length - 1;
      });

      setGrowthData(activeData.length ? activeData : growthRes.report);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  if (loading && !profit) return <LoadingScreen message="Generating reports..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Reports & Business Analytics</h1>
          <p className="muted">Company growth, profit & loss timeline, courier performance, and order sources.</p>
        </div>
        <form className="inline-filter" onSubmit={submit}>
          <input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          <button className="button">Apply</button>
        </form>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}

      <section className="stats-grid">
        <StatCard label="Delivered Revenue" note={`${profit?.deliveredOrders ?? 0} realized orders`} value={formatCurrency(profit?.deliveredRevenue ?? 0)} />
        <StatCard label="Gross Profit" note={`Direct cost ${formatCurrency(profit?.directOrderCost ?? 0)}`} value={formatCurrency(profit?.grossProfit ?? 0)} />
        <StatCard label="General + Ads" note="Period overhead" value={formatCurrency((profit?.generalExpenses ?? 0) + (profit?.advertisementSpend ?? 0))} />
        <StatCard label="Net Profit" note={`${profit?.returnCount ?? 0} returns/RTO`} value={formatCurrency(profit?.netProfit ?? 0)} />
      </section>

      {/* 🚀 SLEEK MODERN SAAS GROWTH & PROFIT CHART */}
      <ModernGrowthChart data={growthData} />

      <section className="content-grid">
        <article className="card card-padding">
          <h2 className="section-title">P&L breakdown</h2>
          <div className="calculation-list">
            <div>
              <span>Delivered revenue</span>
              <strong>{formatCurrency(profit?.deliveredRevenue ?? 0)}</strong>
            </div>
            <div>
              <span>Direct order cost</span>
              <strong>- {formatCurrency(profit?.directOrderCost ?? 0)}</strong>
            </div>
            <div>
              <span>Returned/RTO order cost</span>
              <strong>- {formatCurrency(profit?.failedOrderCost ?? 0)}</strong>
            </div>
            <div>
              <span>General expenses</span>
              <strong>- {formatCurrency(profit?.generalExpenses ?? 0)}</strong>
            </div>
            <div>
              <span>Advertisement spend</span>
              <strong>- {formatCurrency(profit?.advertisementSpend ?? 0)}</strong>
            </div>
            <div>
              <span>Customer refunds</span>
              <strong>- {formatCurrency(profit?.customerRefunds ?? 0)}</strong>
            </div>
            <div className="calculation-total">
              <span>Net profit</span>
              <strong>{formatCurrency(profit?.netProfit ?? 0)}</strong>
            </div>
          </div>
        </article>
        <aside className="card card-padding">
          <h2 className="section-title">Courier efficiency</h2>
          <div className="calculation-list">
            <div>
              <span>Booked</span>
              <strong>{courier?.booked ?? 0}</strong>
            </div>
            <div>
              <span>Delivered</span>
              <strong>{courier?.delivered ?? 0}</strong>
            </div>
            <div>
              <span>RTO</span>
              <strong>{courier?.rto ?? 0}</strong>
            </div>
            <div>
              <span>Delivery rate</span>
              <strong>{courier?.deliveryRate ?? 0}%</strong>
            </div>
            <div>
              <span>RTO rate</span>
              <strong>{courier?.rtoRate ?? 0}%</strong>
            </div>
            <div>
              <span>Unsettled COD</span>
              <strong>{formatCurrency(courier?.unsettledCod ?? 0)}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="content-grid">
        <article className="card">
          <div className="card-padding">
            <h2 className="section-title">Orders by status</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {orders?.byStatus.map((row) => (
                  <tr key={row._id}>
                    <td>{labelize(row._id)}</td>
                    <td>{row.orders}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                    <td>{formatCurrency(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card">
          <div className="card-padding">
            <h2 className="section-title">Orders by source</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {orders?.bySource.map((row) => (
                  <tr key={row._id}>
                    <td>{labelize(row._id)}</td>
                    <td>{row.orders}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="card users-table-card">
        <div className="card-padding">
          <h2 className="section-title">Top cities</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>City</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {orders?.topCities.map((row) => (
                <tr key={row._id}>
                  <td>{row._id || "Unknown"}</td>
                  <td>{row.orders}</td>
                  <td>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/**
 * 🚀 Sleek Modern SaaS Growth & Profit Chart
 */
function ModernGrowthChart({ data }: { data: GrowthPoint[] }) {
  const [activeMetric, setActiveMetric] = useState<"ALL" | "REVENUE" | "PROFIT" | "COST">("ALL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || !data.length) {
    return (
      <section className="card card-padding" style={{ marginBottom: "24px" }}>
        <div className="empty-state">No performance data available for this range.</div>
      </section>
    );
  }

  const width = 800;
  const height = 300;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 45;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.cost, Math.abs(d.profit)]), 1000);
  const steps = 4;
  const yTicks = Array.from({ length: steps + 1 }, (_, i) => Math.round((maxVal / steps) * i));

  const points = data.map((d, idx) => {
    const x = paddingLeft + (data.length === 1 ? chartW / 2 : (idx / (data.length - 1)) * chartW);
    const revY = paddingTop + chartH - (d.revenue / maxVal) * chartH;
    const costY = paddingTop + chartH - (d.cost / maxVal) * chartH;
    const profitY = paddingTop + chartH - (Math.max(0, d.profit) / maxVal) * chartH;
    return { ...d, x, revY, costY, profitY };
  });

  // Generate smooth cubic bezier path string
  function makeSmoothPath(pts: Array<{ x: number; y: number }>) {
    if (!pts.length) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }

  const revPts = points.map((p) => ({ x: p.x, y: p.revY }));
  const costPts = points.map((p) => ({ x: p.x, y: p.costY }));
  const profitPts = points.map((p) => ({ x: p.x, y: p.profitY }));

  const revLine = makeSmoothPath(revPts);
  const costLine = makeSmoothPath(costPts);
  const profitLine = makeSmoothPath(profitPts);

  // Gradient area paths
  const firstX = points[0]?.x ?? paddingLeft;
  const lastX = points[points.length - 1]?.x ?? width - paddingRight;
  const bottomY = paddingTop + chartH;

  const revArea = `${revLine} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  const profitArea = `${profitLine} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  const hoverItem = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <section className="card card-padding" style={{ marginBottom: "24px", position: "relative" }}>
      {/* Header & Metric Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
        <div>
          <h2 className="section-title" style={{ margin: 0, fontSize: "1.15rem" }}>
            ⚡ Financial Growth & Profit Analytics
          </h2>
          <p className="section-copy" style={{ margin: "2px 0 0 0" }}>
            Real-time performance trend across revenue, expenses, and net margins.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
          {(["ALL", "REVENUE", "PROFIT", "COST"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMetric(mode)}
              style={{
                border: "none",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer",
                backgroundColor: activeMetric === mode ? "#fff" : "transparent",
                color: activeMetric === mode ? "#0f172a" : "#64748b",
                boxShadow: activeMetric === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
              type="button"
            >
              {mode === "ALL" ? "📊 All Metrics" : mode === "REVENUE" ? "🟢 Revenue" : mode === "PROFIT" ? "🟣 Net Profit" : "🔴 Costs"}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Modern Chart */}
      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", minWidth: "650px", display: "block" }}>
          <defs>
            {/* Revenue Emerald Gradient */}
            <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Profit Indigo Gradient */}
            <linearGradient id="profitGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Subtle Grid Lines */}
          {yTicks.map((val) => {
            const y = paddingTop + chartH - (val / maxVal) * chartH;
            return (
              <g key={val}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="500">
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          {(activeMetric === "ALL" || activeMetric === "REVENUE") && <path d={revArea} fill="url(#revGrad)" />}
          {(activeMetric === "ALL" || activeMetric === "PROFIT") && <path d={profitArea} fill="url(#profitGrad)" />}

          {/* Curved Smooth Lines */}
          {(activeMetric === "ALL" || activeMetric === "REVENUE") && (
            <path d={revLine} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
          )}

          {(activeMetric === "ALL" || activeMetric === "COST") && (
            <path d={costLine} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          )}

          {(activeMetric === "ALL" || activeMetric === "PROFIT") && (
            <path d={profitLine} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
          )}

          {/* Active Hover Line Guide */}
          {hoverItem && (
            <line x1={hoverItem.x} y1={paddingTop} x2={hoverItem.x} y2={bottomY} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1.5" />
          )}

          {/* Interactive Glowing Node Circles */}
          {points.map((p, idx) => {
            const isHovered = hoverIndex === idx;

            return (
              <g
                key={p.date || idx}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Hit area for easy hover */}
                <rect x={p.x - 15} y={paddingTop} width={30} height={chartH} fill="transparent" />

                {/* Revenue Node */}
                {(activeMetric === "ALL" || activeMetric === "REVENUE") && (
                  <circle
                    cx={p.x}
                    cy={p.revY}
                    r={isHovered ? 7 : 4}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{ transition: "all 0.15s ease" }}
                  />
                )}

                {/* Profit Node */}
                {(activeMetric === "ALL" || activeMetric === "PROFIT") && (
                  <circle
                    cx={p.x}
                    cy={p.profitY}
                    r={isHovered ? 7 : 4}
                    fill="#6366f1"
                    stroke="#fff"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{ transition: "all 0.15s ease" }}
                  />
                )}

                {/* Cost Node */}
                {(activeMetric === "ALL" || activeMetric === "COST") && (
                  <circle
                    cx={p.x}
                    cy={p.costY}
                    r={isHovered ? 6 : 3.5}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ transition: "all 0.15s ease" }}
                  />
                )}

                {/* Clean X-Axis Date Labels (Only display labels periodically if dense) */}
                {idx % Math.ceil(points.length / 8) === 0 || idx === points.length - 1 ? (
                  <text x={p.x} y={bottomY + 22} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
                    {p.date.slice(5)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* 🌟 Modern Glassmorphism Hover Card Popup */}
        {hoverItem ? (
          <div
            style={{
              position: "absolute",
              top: "16px",
              right: "24px",
              backgroundColor: "rgba(15, 23, 42, 0.92)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              padding: "14px 18px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              fontSize: "0.85rem",
              zIndex: 30,
              minWidth: "180px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255, 255, 255, 0.15)", paddingBottom: "6px", marginBottom: "8px" }}>
              📅 {hoverItem.date}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#94a3b8" }}>Orders:</span>
              <strong>{hoverItem.orders}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#34d399" }}>🟢 Revenue:</span>
              <strong>{formatCurrency(hoverItem.revenue)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#f87171" }}>🔴 Direct Costs:</span>
              <strong>{formatCurrency(hoverItem.cost)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", paddingTop: "6px", borderTop: "1px stroke rgba(255,255,255,0.1)" }}>
              <span style={{ color: "#818cf8", fontWeight: "700" }}>🟣 Net Profit:</span>
              <strong style={{ color: hoverItem.profit >= 0 ? "#818cf8" : "#f87171" }}>{formatCurrency(hoverItem.profit)}</strong>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
