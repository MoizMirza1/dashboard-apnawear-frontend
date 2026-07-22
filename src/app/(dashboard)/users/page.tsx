"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch, ApiClientError } from "@/lib/api";
import type { ManagedUser, UserRole } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const response = await apiFetch<{ success: true; users: ManagedUser[] }>("/users");
      setUsers(response.users);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Users could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await apiFetch<{ success: true; message: string }>("/users", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          role: formData.get("role") as UserRole,
        }),
      });
      setSuccess(response.message);
      form.reset();
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "User could not be created.");
    }
  }

  async function toggleStatus(userId: string) {
    setWorkingId(userId);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch<{ success: true; message: string }>(`/users/${userId}/status`, {
        method: "PATCH",
      });
      setSuccess(response.message);
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "User status could not be changed.");
    } finally {
      setWorkingId(null);
    }
  }

  if (!users && !error) return <LoadingScreen message="Loading users..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Users & Roles</h1>
          <p className="muted">Admin controls accounts. Partner users receive operational access.</p>
        </div>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}
      {success ? <div className="success-box page-message">{success}</div> : null}

      <section className="card card-padding">
        <h2 className="section-title">Create account</h2>
        <p className="section-copy">Create only accounts required for people actively working in the business.</p>

        <form className="form" onSubmit={createUser}>
          <div className="two-column-form">
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input className="input" id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input className="input" id="email" name="email" required type="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Temporary password</label>
              <input className="input" id="password" maxLength={72} minLength={8} name="password" required type="password" />
            </div>
            <div className="field">
              <label htmlFor="role">Role</label>
              <select className="select" defaultValue="PARTNER" id="role" name="role">
                <option value="PARTNER">Partner</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className="actions-row">
            <button className="button" type="submit">Create user</button>
          </div>
        </form>
      </section>

      <section className="card users-table-card">
        <div className="card-padding">
          <h2 className="section-title">Current users</h2>
          <p className="section-copy">Deactivation blocks login without deleting audit history.</p>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong><div className="muted">{user.email}</div></td>
                  <td><span className={`badge ${user.role === "ADMIN" ? "badge-admin" : "badge-partner"}`}>{user.role}</span></td>
                  <td><span className={`badge ${user.isActive ? "badge-partner" : "badge-inactive"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-PK") : "Never"}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString("en-PK")}</td>
                  <td>
                    <button
                      className={`button ${user.isActive ? "button-danger" : "button-secondary"}`}
                      disabled={workingId === user.id}
                      onClick={() => void toggleStatus(user.id)}
                      type="button"
                    >
                      {workingId === user.id ? "Working..." : user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
