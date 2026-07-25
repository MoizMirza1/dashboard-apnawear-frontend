"use client";

import { FormEvent, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BusinessSettings, ProductDesign } from "@/types";

type ProductForm = {
  name: string;
  category: string;
  description: string;
  regularSellingPrice: number;
  dropShoulderSellingPrice: number;
  status: "ACTIVE" | "INACTIVE";
};

const blankForm: ProductForm = {
  name: "",
  category: "Streetwear",
  description: "",
  regularSellingPrice: 1300,
  dropShoulderSellingPrice: 1600,
  status: "ACTIVE",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductDesign[]>([]);
  const [form, setForm] = useState<ProductForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [productResponse, settingsResponse] = await Promise.all([
        apiFetch<{ success: true; products: ProductDesign[] }>("/products"),
        apiFetch<{ success: true; settings: BusinessSettings }>("/settings"),
      ]);
      setProducts(productResponse.products);
      if (!editingId) {
        setForm((current) => ({
          ...current,
          regularSellingPrice: settingsResponse.settings.defaultCosts.regularSellingPrice,
          dropShoulderSellingPrice: settingsResponse.settings.defaultCosts.dropShoulderSellingPrice,
        }));
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(blankForm);
  }

  function edit(product: ProductDesign) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      description: product.description,
      regularSellingPrice: product.regularSellingPrice,
      dropShoulderSellingPrice: product.dropShoulderSellingPrice,
      status: product.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const path = editingId ? `/products/${editingId}` : "/products";
      const response = await apiFetch<{ success: true; message: string }>(path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      setMessage(response.message);
      resetForm();
      await load();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen message="Loading product catalog..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Product Designs</h1>
          <p className="muted">Create each print design once, then reuse it in as many customer orders as needed.</p>
        </div>
        <span className="badge">{products.length} DESIGNS</span>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      <section className="card card-padding">
        <h2 className="section-title">{editingId ? "Edit design" : "Add a design"}</h2>
        <p className="section-copy">These are customer prices for the complete printed shirt—not the printing vendor cost. Printing cost is entered on the order.</p>
        <form className="form" onSubmit={submit}>
          <div className="form-grid-3">
            <div className="field">
              <label htmlFor="productName">Design name</label>
              <input className="input" id="productName" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <input className="input" id="category" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="productStatus">Status</label>
              <select className="select" id="productStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductForm["status"] })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="regularPrice">Complete Regular printed shirt price</label>
              <input className="input" id="regularPrice" min="0" required type="number" value={form.regularSellingPrice} onChange={(event) => setForm({ ...form, regularSellingPrice: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="dropPrice">Complete Drop Shoulder printed shirt price</label>
              <input className="input" id="dropPrice" min="0" required type="number" value={form.dropShoulderSellingPrice} onChange={(event) => setForm({ ...form, dropShoulderSellingPrice: Number(event.target.value) })} />
            </div>
            <div className="field field-span-3">
              <label htmlFor="description">Description / print notes</label>
              <textarea className="input textarea" id="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
          </div>
          <div className="actions-row gap-row">
            {editingId ? <button className="button button-secondary" type="button" onClick={resetForm}>Cancel edit</button> : null}
            <button className="button" disabled={saving} type="submit">{saving ? "Saving..." : editingId ? "Update design" : "Add design"}</button>
          </div>
        </form>
      </section>

      <section className="card users-table-card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Reusable Design</th><th>Regular Customer Price</th><th>Drop Shoulder Customer Price</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong><div className="table-subtext">{product.category}{product.description ? ` · ${product.description}` : ""}</div></td>
                  <td>{formatCurrency(product.regularSellingPrice)}</td>
                  <td>{formatCurrency(product.dropShoulderSellingPrice)}</td>
                  <td><span className={`badge ${product.status === "ACTIVE" ? "badge-partner" : "badge-inactive"}`}>{product.status}</span></td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td><button className="link-button" onClick={() => edit(product)} type="button">Edit</button></td>
                </tr>
              ))}
              {!products.length ? <tr><td className="empty-state" colSpan={6}>No product designs added yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
