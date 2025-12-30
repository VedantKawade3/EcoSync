"use client";

import { useAppData } from "../../components/AppProvider";

export default function ProfilePage() {
  const { user, credits, posts, lostItems, loading, settings } = useAppData();

  if (loading || !user) {
    return (
      <div className="loading">
        <p>{loading ? "Loading profile..." : "Please log in to continue."}</p>
      </div>
    );
  }

  return (
    <section className="section">
      <div className="section__header">
        <h2>Profile</h2>
        <p className="muted">Your EcoSync footprint.</p>
      </div>
      <div className="grid">
        <div className="card">
          <p className="muted">User ID</p>
          <p className="stat-number" style={{ wordBreak: "break-all" }}>
            {user?.uid || "Anonymous"}
          </p>
          <p className="muted">Email: {user?.email || "N/A"}</p>
          <p className="muted">Role: {user?.role || "user"}</p>
        </div>
        <div className="card">
          <p className="muted">Username (roll)</p>
          <p className="stat-number">{settings?.username || "Not set"}</p>
          <p className="muted">Set in Settings to your college roll number.</p>
        </div>
        <div className="card">
          <p className="muted">Credits</p>
          <p className="stat-number">{credits}</p>
          <p className="muted">Available balance</p>
        </div>
        <div className="card">
          <p className="muted">Cleanup uploads</p>
          <p className="stat-number">{posts?.length || 0}</p>
          <p className="muted">Posts submitted</p>
        </div>
        <div className="card">
          <p className="muted">Lost &amp; Found</p>
          <p className="stat-number">{lostItems?.length || 0}</p>
          <p className="muted">Reports created</p>
        </div>
      </div>
    </section>
  );
}
