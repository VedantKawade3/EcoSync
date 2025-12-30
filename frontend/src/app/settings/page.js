"use client";

import { useState } from "react";
import { useAppData } from "../../components/AppProvider";
import { updateUserSettings } from "../../lib/api";
import { getOrCreateUser } from "../../lib/user";

export default function SettingsPage() {
  const { refreshData, loading, settings, user } = useAppData();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const offlineMode =
    (process.env.NEXT_PUBLIC_OFFLINE_MODE || "false").toString().toLowerCase() === "true";
  const currentUser = user || getOrCreateUser();

  const [username, setUsername] = useState(settings?.username || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (loading) {
    return (
      <div className="loading">
        <p>Loading settings...</p>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (!currentUser) throw new Error("No user found");
      await updateUserSettings(currentUser.uid, { username, theme: "dark" });
      await refreshData();
      setMessage("Settings saved");
    } catch (err) {
      setError(err.message || "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section">
      <div className="section__header">
        <h2>User Settings</h2>
        <p className="muted">Session info and connection details.</p>
      </div>

      <form className="grid" onSubmit={handleSave}>
        <div className="card">
          <p className="muted">Username (college roll)</p>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your roll number"
            required
          />
          <p className="muted">Used on your profile and posts.</p>
        </div>

        <div className="card subtle">
          <p className="muted">Mode</p>
          <p className="stat-number">{offlineMode ? "Offline (mock data)" : "Online"}</p>
          <p className="muted">
            {/* Admin-only environment details are available at /admin. */}
          </p>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          {error && <p className="error">{error}</p>}
          {message && <p className="muted">{message}</p>}
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
