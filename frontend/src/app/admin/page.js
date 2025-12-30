"use client";

import { useEffect, useState } from "react";
import { useAppData } from "../../components/AppProvider";
import { listUsers, fetchPosts, fetchLostItems, deletePost, approvePost, rejectPost, deleteLostItem } from "../../lib/api";

export default function AdminPage() {
  const { user, loading } = useAppData();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ posts: 0, lost: 0 });
  const [posts, setPosts] = useState([]);
  const [lost, setLost] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAll = async () => {
    setError("");
    try {
      const [u, p, l] = await Promise.all([listUsers(), fetchPosts(), fetchLostItems()]);
      setUsers(u.items || []);
      setPosts(p.items || []);
      setLost(l.items || []);
      setStats({ posts: p.items?.length || 0, lost: l.items?.length || 0 });
    } catch (err) {
      setError(err.message || "Failed to load admin data");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <p>Loading admin...</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <section className="section">
        <div className="card">
          <p className="muted">Admin only</p>
        </div>
      </section>
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const offlineMode =
    (process.env.NEXT_PUBLIC_OFFLINE_MODE || "false").toString().toLowerCase() === "true";

  return (
    <section className="section">
      <div className="section__header">
        <h2>Admin Panel</h2>
        <p className="muted">System oversight for EcoSync.</p>
      </div>
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}
      <div className="grid">
        <div className="card">
          <p className="muted">Mode</p>
          <p className="stat-number">{offlineMode ? "Offline (mock)" : "Online"}</p>
          <p className="muted">
            If Gemini shows offline, set `OFFLINE_MODE=false`, ensure `GEMINI_API_KEY` is set, and restart backend.
          </p>
        </div>
        <div className="card">
          <p className="muted">Backend URL</p>
          <p className="stat-number">{backendUrl}</p>
          <p className="muted">Configure via NEXT_PUBLIC_BACKEND_URL.</p>
        </div>
        <div className="card">
          <p className="muted">Content</p>
          <p className="stat-number">{stats.posts} posts</p>
          <p className="muted">{stats.lost} lost &amp; found</p>
        </div>
        <div className="card">
          <p className="muted">Users</p>
          <p className="stat-number">{users.length}</p>
          <p className="muted">Admins can audit accounts.</p>
        </div>
      </div>

      <div className="section__header" style={{ marginTop: 24 }}>
        <h3>User directory</h3>
        <p className="muted">View roles and usernames.</p>
      </div>
      <div className="card">
        <div className="grid">
          {users.map((u) => (
            <div key={u.id} className="card subtle">
              <p className="muted">Email</p>
              <p className="stat-number" style={{ wordBreak: "break-all" }}>
                {u.email}
              </p>
              <p className="muted">Username: {u.username || "N/A"}</p>
              <p className="muted">Role: {u.role}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card subtle" style={{ marginTop: 16 }}>
        <p className="muted">Admin defaults</p>
        <p>Email: admin@ecosync.local</p>
        <p>Password: Admin@123</p>
      </div>

      <div className="section__header" style={{ marginTop: 24 }}>
        <h3>Moderate posts</h3>
        <p className="muted">Delete irrelevant or abusive submissions.</p>
      </div>
      <div className="card">
        <div className="grid">
          {posts.map((p) => (
            <div key={p.id} className="card subtle">
              <p className="muted">{p.created_at ? new Date(p.created_at).toLocaleString() : ""}</p>
              <p className="card__title" style={{ marginTop: 4 }}>{p.caption}</p>
              <p className="muted">User: {p.user_email || p.user_id}</p>
              <p className="muted">Status: {p.status}</p>
              {p.review_notes && <p className="muted">Notes: {p.review_notes}</p>}
              <div className="cta-row" style={{ marginTop: 8, gap: 8 }}>
                {p.status === "pending" && (
                  <button
                    className="btn primary"
                    type="button"
                    onClick={async () => {
                      try {
                        const credits = prompt("Credits to award?", p.credits_awarded?.toString() || "10");
                        const notes = prompt("Review notes?", "Approved by admin");
                        await approvePost(p.id, parseInt(credits || "0", 10), notes || "");
                        setMessage("Post approved");
                        await loadAll();
                      } catch (err) {
                        setError(err.message || "Approve failed");
                      }
                    }}
                  >
                    Approve
                  </button>
                )}
                <button
                  className="btn ghost"
                  type="button"
                  onClick={async () => {
                    try {
                      const reason = prompt("Reason for rejection?", "Rejected by admin");
                      await rejectPost(p.id, reason || "");
                      setMessage("Post rejected");
                      await loadAll();
                    } catch (err) {
                      setError(err.message || "Reject failed");
                    }
                  }}
                >
                  Reject
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={async () => {
                    try {
                      await deletePost(p.id);
                      setMessage("Post deleted");
                      await loadAll();
                    } catch (err) {
                      setError(err.message || "Delete failed");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section__header" style={{ marginTop: 24 }}>
        <h3>Lost &amp; Found moderation</h3>
        <p className="muted">Delete reported items when resolved.</p>
      </div>
      <div className="card">
        <div className="grid">
          {lost.map((item) => (
            <div key={item.id} className="card subtle">
              <p className="muted">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</p>
              <p className="card__title" style={{ marginTop: 4 }}>{item.title}</p>
              <p className="muted">{item.description}</p>
              <p className="muted">Reporter: {item.user_email || item.user_id}</p>
              <p className="muted">Status: {item.status}</p>
              <div className="cta-row" style={{ marginTop: 8 }}>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteLostItem(item.id);
                      setMessage("Lost & found entry deleted");
                      await loadAll();
                    } catch (err) {
                      setError(err.message || "Delete failed");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
