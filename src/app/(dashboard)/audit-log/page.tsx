"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import type { AuditLog } from "@/types";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ success: true; logs: AuditLog[] }>("/audit-logs?limit=100")
      .then((response) => setLogs(response.logs))
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  if (!logs && !error) return <LoadingScreen message="Loading audit log..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p className="muted">The latest 100 security and configuration events are shown here.</p>
        </div>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}

      <section className="card">
        {logs?.length === 0 ? (
          <div className="empty-state">No audit events yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Actor</th><th>Action</th><th>Entity</th><th>Description</th></tr>
              </thead>
              <tbody>
                {logs?.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString("en-PK")}</td>
                    <td><strong>{log.actorName}</strong><div className="muted">{log.actorEmail}</div></td>
                    <td><span className="badge">{log.action}</span></td>
                    <td className="code-text">{log.entityType}{log.entityId ? ` / ${log.entityId}` : ""}</td>
                    <td>{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
