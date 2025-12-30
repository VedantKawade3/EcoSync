"use client";

import { useState } from "react";
import LostFoundForm from "../../components/LostFoundForm";
import LostFoundFeed from "../../components/LostFoundFeed";
import { useAppData } from "../../components/AppProvider";

export default function LostFoundPage() {
  const { user, lostItems, refreshData, loading } = useAppData();
  const [query, setQuery] = useState("");

  if (loading || !user) {
    return (
      <div className="loading">
        <p>{loading ? "Loading lost & found..." : "Please log in to continue."}</p>
      </div>
    );
  }

  const filtered = (lostItems || []).filter((item) =>
    [item.title, item.description, item.location, item.user_email]
      .filter(Boolean)
      .some((val) => val.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <>
      <section className="section split">
        <LostFoundForm user={user} onCreated={refreshData} />
        <div className="card subtle">
          <h3>How it works</h3>
          <p className="muted">
            Report valuables you find with a brief description and contact. Returning items builds
            trust; credits are reserved for verified cleanup uploads.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="section__header">
          <h2>All reports</h2>
          <p className="muted">Browse current lost &amp; found posts.</p>
          <input
            type="text"
            placeholder="Search items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 220, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>
        <LostFoundFeed items={filtered} />
      </section>
    </>
  );
}
