"use client";

import { useState } from "react";
import { redeemCredits } from "../lib/api";

const RewardsPanel = ({ user, credits, onRedeemed }) => {
  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState("College event discount");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!user) return setError("Sign in failed.");
    setLoading(true);
    setError("");
    try {
      await redeemCredits({ user_id: user.uid, amount: Number(amount), note });
      onRedeemed?.();
    } catch (err) {
      setError(err.message || "Redeem failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" id="rewards">
      <div className="card__header">
        <h3>Your rewards</h3>
        <p className="muted">Use credits for event discounts. Shopping coming soon.</p>
      </div>
      <div className="credits">
        <p className="stat-number">{credits}</p>
        <p className="stat-label">Credits available</p>
      </div>
      <form className="form" onSubmit={handleRedeem}>
        <label>
          Amount to redeem
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Note
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Processing..." : "Redeem"}
        </button>
      </form>
    </div>
  );
};

export default RewardsPanel;

