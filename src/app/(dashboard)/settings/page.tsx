"use client";

import { FormEvent, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiClientError } from "@/lib/api";
import type { BusinessSettings } from "@/types";

type FormValues = {
  businessName: string;
  partnerAPercent: number;
  partnerBPercent: number;
  regularBlankCost: number;
  dropShoulderBlankCost: number;
  regularSellingPrice: number;
  dropShoulderSellingPrice: number;
  courier: number;
  flyer: number;
  flyerLabel: number;
  printingPickup: number;
};

function toFormValues(settings: BusinessSettings): FormValues {
  return {
    businessName: settings.businessName,
    partnerAPercent: settings.ownership.partnerAPercent,
    partnerBPercent: settings.ownership.partnerBPercent,
    ...settings.defaultCosts,
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN";
  const [values, setValues] = useState<FormValues | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ success: true; settings: BusinessSettings }>("/settings")
      .then((response) => setValues(toFormValues(response.settings)))
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  function setNumber(name: keyof FormValues, value: string) {
    setValues((current) => current ? { ...current, [name]: Number(value) } : current);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || !canEdit) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await apiFetch<{ success: true; message: string; settings: BusinessSettings }>(
        "/settings",
        { method: "PATCH", body: JSON.stringify(values) },
      );
      setValues(toFormValues(response.settings));
      setSuccess(response.message);
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!values && !error) return <LoadingScreen message="Loading business settings..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Business Settings</h1>
          <p className="muted">Configure ownership and default values used across the ERP.</p>
        </div>
      </div>

      <section className="card card-padding">
        {error ? <div className="error-box">{error}</div> : null}
        {success ? <div className="success-box">{success}</div> : null}
        {!canEdit ? <div className="notice-box">Partner accounts can view settings but only Admin can edit them.</div> : null}

        {values ? (
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <h3>Business identity</h3>
              <p className="section-copy">These values will appear on dashboards, reports and invoices.</p>
              <div className="two-column-form">
                <div className="field">
                  <label htmlFor="businessName">Business name</label>
                  <input
                    className="input"
                    disabled={!canEdit}
                    id="businessName"
                    onChange={(event) => setValues({ ...values, businessName: event.target.value })}
                    required
                    value={values.businessName}
                  />
                </div>
                <div className="field">
                  <label htmlFor="currency">Currency</label>
                  <input className="input" disabled id="currency" value="PKR" readOnly />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Ownership split</h3>
              <p className="section-copy">The two percentages must total exactly 100.</p>
              <div className="two-column-form">
                <NumberField label="Partner A share (%)" name="partnerAPercent" value={values.partnerAPercent} disabled={!canEdit} onChange={setNumber} max={100} suffix="%" />
                <NumberField label="Partner B share (%)" name="partnerBPercent" value={values.partnerBPercent} disabled={!canEdit} onChange={setNumber} max={100} suffix="%" />
              </div>
            </div>

            <div className="form-section">
              <h3>Default order values</h3>
              <p className="section-copy">These are starting values. Actual order costs remain editable later.</p>
              <div className="two-column-form">
                <NumberField label="Regular blank-shirt cost" name="regularBlankCost" value={values.regularBlankCost} disabled={!canEdit} onChange={setNumber} />
                <NumberField label="Drop Shoulder blank cost" name="dropShoulderBlankCost" value={values.dropShoulderBlankCost} disabled={!canEdit} onChange={setNumber} />
                <NumberField label="Regular selling price" name="regularSellingPrice" value={values.regularSellingPrice} disabled={!canEdit} onChange={setNumber} />
                <NumberField label="Drop Shoulder selling price" name="dropShoulderSellingPrice" value={values.dropShoulderSellingPrice} disabled={!canEdit} onChange={setNumber} />
                <NumberField label="Courier default" name="courier" value={values.courier} disabled={!canEdit} onChange={setNumber} />
                <NumberField label="Flyer cost" name="flyer" value={values.flyer} disabled={!canEdit} onChange={setNumber} />
                <NumberField label="Flyer label cost" name="flyerLabel" value={values.flyerLabel} disabled={!canEdit} onChange={setNumber} />
                <NumberField label="Printing pickup default" name="printingPickup" value={values.printingPickup} disabled={!canEdit} onChange={setNumber} />
              </div>
            </div>

            {canEdit ? (
              <div className="actions-row">
                <button className="button" disabled={saving} type="submit">
                  {saving ? "Saving..." : "Save settings"}
                </button>
              </div>
            ) : null}
          </form>
        ) : null}
      </section>
    </main>
  );
}

function NumberField({
  label,
  name,
  value,
  disabled,
  max,
  onChange,
  suffix = "PKR",
}: {
  label: string;
  name: keyof FormValues;
  value: number;
  disabled: boolean;
  max?: number;
  onChange: (name: keyof FormValues, value: string) => void;
  suffix?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label} ({suffix})</label>
      <input
        className="input"
        disabled={disabled}
        id={name}
        max={max}
        min="0"
        onChange={(event) => onChange(name, event.target.value)}
        required
        step="0.01"
        type="number"
        value={value}
      />
    </div>
  );
}
