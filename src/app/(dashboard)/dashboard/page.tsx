"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import StatCard from "@/components/dashboard/stat-card";
import { apiFetch } from "@/lib/api";
import { formatCurrency, labelize } from "@/lib/format";
import type { CashBalance, GarmentVariant, PartnerSummary, ProfitLossReport } from "@/types";

type DashboardSummary = {
  businessName: string;
  activeUsers: number;
  activeProducts: number;
  activeSuppliers: number;
  purchaseBatches: number;
  orders: { total: number; pending: number; shipped: number; delivered: number; returned: number; byStatus: Record<string, number> };
  printingOpen: number;
  pendingCod: number;
  returnsThisMonth: number;
  expensesThisMonth: number;
  activeCampaigns: number;
  stockUnits: number;
  reservedStockUnits: number;
  stockValue: number;
  lowStockCount: number;
  lowStockVariants: GarmentVariant[];
  month: ProfitLossReport;
  partnerSummary: PartnerSummary;
  cashBalances: CashBalance[];
  readiness: Record<string, boolean>;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [autoMessage, setAutoMessage] = useState("");
  const [runningAuto, setRunningAuto] = useState(false);

  async function loadSummary() {
    try {
      const data = await apiFetch<{ success: true; summary: DashboardSummary }>("/dashboard/summary");
      setSummary(data.summary);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  async function runAutoReserve() {
    setRunningAuto(true);
    setAutoMessage("");
    setError("");
    try {
      const res = await apiFetch<{ success: true; message: string }>("/orders/auto-reserve-all", { method: "POST" });
      setAutoMessage(res.message);
      await loadSummary();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningAuto(false);
    }
  }

  if (!summary && !error) return <LoadingScreen message="Loading final ERP dashboard..." />;
  const liquid = summary?.cashBalances.filter((item) => item.account !== "COURIER_RECEIVABLE").reduce((sum, item) => sum + item.balance, 0) ?? 0;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>{summary?.businessName ?? "Apna Wear"} ERP</h1>
          <p className="muted">Inventory, orders, delivery, expenses, profit and partner settlement in one system.</p>
        </div>
        <span className="badge badge-partner">FINAL ERP</span>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {autoMessage ? <div className="success-box page-message">{autoMessage}</div> : null}

      {/* ⚡ SMART AUTOMATION BAR */}
      <section className="card card-padding" style={{ marginBottom: "20px", borderLeft: "4px solid #3b82f6", backgroundColor: "rgba(59, 130, 246, 0.03)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <span>⚡ One-Click ERP Automation Hub</span>
              <span className="badge" style={{ backgroundColor: "#3b82f6", color: "#fff" }}>AUTOMATED</span>
            </h2>
            <p className="section-copy" style={{ margin: "4px 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              Run batch operations across stock reservation, fulfillment, and COD reconciliation with zero manual effort.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="button" disabled={runningAuto} onClick={runAutoReserve} style={{ backgroundColor: "#3b82f6", borderColor: "#3b82f6", color: "#fff" }}>
              {runningAuto ? "Reserving..." : "⚡ Reserve All Pending Stock"}
            </button>
            <a className="button button-secondary" href="/orders">
              📋 Express Order Creator
            </a>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Monthly Revenue" note={`${summary?.month.deliveredOrders ?? 0} delivered orders`} value={formatCurrency(summary?.month.deliveredRevenue ?? 0)} />
        <StatCard label="Monthly Net Profit" note={`Expenses ${formatCurrency(summary?.expensesThisMonth ?? 0)}`} value={formatCurrency(summary?.month.netProfit ?? 0)} />
        <StatCard label="Available Stock" note={`${summary?.reservedStockUnits ?? 0} reserved · ${summary?.lowStockCount ?? 0} low`} value={String(summary?.stockUnits ?? 0)} />
        <StatCard label="Pending COD" note={`Liquid balance ${formatCurrency(liquid)}`} value={formatCurrency(summary?.pendingCod ?? 0)} />
      </section>
      <section className="stats-grid top-gap">
        <StatCard label="Total Orders" note={`${summary?.orders.pending ?? 0} in process`} value={String(summary?.orders.total ?? 0)} />
        <StatCard label="Open Printing" note="Pending / in progress" value={String(summary?.printingOpen ?? 0)} />
        <StatCard label="Stock Value" note={`${summary?.purchaseBatches ?? 0} purchase batches`} value={formatCurrency(summary?.stockValue ?? 0)} />
        <StatCard label="Returns This Month" note={`${summary?.activeCampaigns ?? 0} active campaigns`} value={String(summary?.returnsThisMonth ?? 0)} />
      </section>
      <section className="content-grid">
        <article className="card card-padding">
          <h2 className="section-title">Order pipeline</h2>
          <div className="kpi-list">
            {Object.entries(summary?.orders.byStatus ?? {})
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <div className="kpi-row" key={status}>
                  <span>{labelize(status)}</span>
                  <span className="badge">{count}</span>
                </div>
              ))}
          </div>
        </article>
        <article className="card card-padding">
          <h2 className="section-title">Partner settlement</h2>
          <div className="kpi-list">
            <div className="kpi-row">
              <span>Partner A</span>
              <strong className={(summary?.partnerSummary.partnerA.settlementBalance ?? 0) >= 0 ? "positive-text" : "negative-text"}>
                {formatCurrency(summary?.partnerSummary.partnerA.settlementBalance ?? 0)}
              </strong>
            </div>
            <div className="kpi-row">
              <span>Partner B</span>
              <strong className={(summary?.partnerSummary.partnerB.settlementBalance ?? 0) >= 0 ? "positive-text" : "negative-text"}>
                {formatCurrency(summary?.partnerSummary.partnerB.settlementBalance ?? 0)}
              </strong>
            </div>
            <div className="kpi-row">
              <span>Total partner funding</span>
              <strong>{formatCurrency(summary?.partnerSummary.totalFunding ?? 0)}</strong>
            </div>
          </div>
          <h2 className="section-title top-gap">Low stock</h2>
          {summary?.lowStockVariants.map((item) => (
            <div className="kpi-row" key={item.id}>
              <span>{item.sku}</span>
              <span className="badge badge-warning">{item.availableQty}</span>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
