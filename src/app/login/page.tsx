"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : "Could not connect to the backend server.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="auth-logo">Apna Wear</div>
        <div>
          <h1>Streetwear operations, in one place.</h1>
          <p>
            Next.js handles the frontend. Express and MongoDB handle the secure backend,
            users, roles, settings and future ERP calculations.
          </p>
        </div>
        <p>Phase 1 + 2 · Auth, products, purchases and inventory</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="muted">APNA WEAR ERP</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with an account created by the backend seed script.</p>

          <form className="form" onSubmit={handleSubmit}>
            {error ? <div className="error-box">{error}</div> : null}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                autoComplete="email"
                className="input"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@apnawear.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                autoComplete="current-password"
                className="input"
                id="password"
                maxLength={72}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            <button className="button" disabled={submitting || loading} type="submit">
              {submitting ? "Signing in..." : "Sign in to dashboard"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
