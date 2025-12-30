"use client";

import RewardsPanel from "../../components/RewardsPanel";
import { useAppData } from "../../components/AppProvider";

export default function RewardsPage() {
  const { user, credits, refreshData, loading } = useAppData();

  if (loading || !user) {
    return (
      <div className="loading">
        <p>{loading ? "Loading rewards..." : "Please log in to continue."}</p>
      </div>
    );
  }

  return (
    <section className="section">
      <div className="section__header">
        <h2>Redeem credits</h2>
        <p className="muted">Use your balance for event discounts. Shopping perks coming soon.</p>
      </div>
      <RewardsPanel user={user} credits={credits} onRedeemed={refreshData} />
    </section>
  );
}
