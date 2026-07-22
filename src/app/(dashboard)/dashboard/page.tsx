"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import StatCard from "@/components/dashboard/stat-card";
import { apiFetch } from "@/lib/api";
import { formatCurrency, labelize } from "@/lib/format";
import type { CashBalance, GarmentVariant, PartnerSummary, ProfitLossReport } from "@/types";

type DashboardSummary = {
  businessName: string; activeUsers: number; activeProducts: number; activeSuppliers: number; purchaseBatches: number;
  orders: { total: number; pending: number; shipped: number; delivered: number; returned: number; byStatus: Record<string, number> };
  printingOpen: number; pendingCod: number; returnsThisMonth: number; expensesThisMonth: number; activeCampaigns: number;
  stockUnits: number; reservedStockUnits: number; stockValue: number; lowStockCount: number; lowStockVariants: GarmentVariant[];
  month: ProfitLossReport; partnerSummary: PartnerSummary; cashBalances: CashBalance[]; readiness: Record<string, boolean>;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null); const [error, setError] = useState("");
  useEffect(() => { apiFetch<{ success: true; summary: DashboardSummary }>("/dashboard/summary").then((data) => setSummary(data.summary)).catch((e: Error) => setError(e.message)); }, []);
  if (!summary && !error) return <LoadingScreen message="Loading final ERP dashboard..." />;
  const liquid = summary?.cashBalances.filter((item) => item.account !== "COURIER_RECEIVABLE").reduce((sum, item) => sum + item.balance, 0) ?? 0;
  return <main className="page"><div className="page-header"><div><h1>{summary?.businessName ?? "Apna Wear"} ERP</h1><p className="muted">Inventory, orders, delivery, expenses, profit and partner settlement in one system.</p></div><span className="badge badge-partner">FINAL ERP</span></div>{error ? <div className="error-box">{error}</div> : null}
    <section className="stats-grid"><StatCard label="Monthly Revenue" value={formatCurrency(summary?.month.deliveredRevenue ?? 0)} note={`${summary?.month.deliveredOrders ?? 0} delivered orders`} /><StatCard label="Monthly Net Profit" value={formatCurrency(summary?.month.netProfit ?? 0)} note={`Expenses ${formatCurrency(summary?.expensesThisMonth ?? 0)}`} /><StatCard label="Available Stock" value={String(summary?.stockUnits ?? 0)} note={`${summary?.reservedStockUnits ?? 0} reserved · ${summary?.lowStockCount ?? 0} low`} /><StatCard label="Pending COD" value={formatCurrency(summary?.pendingCod ?? 0)} note={`Liquid balance ${formatCurrency(liquid)}`} /></section>
    <section className="stats-grid top-gap"><StatCard label="Total Orders" value={String(summary?.orders.total ?? 0)} note={`${summary?.orders.pending ?? 0} in process`} /><StatCard label="Open Printing" value={String(summary?.printingOpen ?? 0)} note="Pending / in progress" /><StatCard label="Stock Value" value={formatCurrency(summary?.stockValue ?? 0)} note={`${summary?.purchaseBatches ?? 0} purchase batches`} /><StatCard label="Returns This Month" value={String(summary?.returnsThisMonth ?? 0)} note={`${summary?.activeCampaigns ?? 0} active campaigns`} /></section>
    <section className="content-grid"><article className="card card-padding"><h2 className="section-title">Order pipeline</h2><div className="kpi-list">{Object.entries(summary?.orders.byStatus ?? {}).sort((a,b) => b[1]-a[1]).map(([status,count]) => <div className="kpi-row" key={status}><span>{labelize(status)}</span><span className="badge">{count}</span></div>)}</div></article><article className="card card-padding"><h2 className="section-title">Partner settlement</h2><div className="kpi-list"><div className="kpi-row"><span>Partner A</span><strong className={(summary?.partnerSummary.partnerA.settlementBalance ?? 0) >= 0 ? "positive-text" : "negative-text"}>{formatCurrency(summary?.partnerSummary.partnerA.settlementBalance ?? 0)}</strong></div><div className="kpi-row"><span>Partner B</span><strong className={(summary?.partnerSummary.partnerB.settlementBalance ?? 0) >= 0 ? "positive-text" : "negative-text"}>{formatCurrency(summary?.partnerSummary.partnerB.settlementBalance ?? 0)}</strong></div><div className="kpi-row"><span>Total partner funding</span><strong>{formatCurrency(summary?.partnerSummary.totalFunding ?? 0)}</strong></div></div><h2 className="section-title top-gap">Low stock</h2>{summary?.lowStockVariants.map((item) => <div className="kpi-row" key={item.id}><span>{item.sku}</span><span className="badge badge-warning">{item.availableQty}</span></div>)}</article></section>
  </main>;
}
