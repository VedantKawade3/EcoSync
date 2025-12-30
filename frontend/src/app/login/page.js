"use client";

import { useAppData } from "../../components/AppProvider";
import { useState } from "react";
import { saveUser, clearUser, getOrCreateUser } from "../../lib/user";
import { login, signup } from "../../lib/api";
import Link from "next/link";

export default function LoginPage() {
  const { user, refreshData, loading } = useAppData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (loading) {
    return (
      <div className="loading">
        <p>Loading login...</p>
      </div>
    );
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await login({ email, password });
      const newUser = { uid: res.id, email: res.email, username: res.username, role: res.role, token: res.token };
      saveUser(newUser);
      await refreshData();
      window.location.href = "/";
    } catch (err) {
      const msg = err.message || "Login failed";
      // If user not found, move to signup mode automatically
      if (msg.toLowerCase().includes("not found")) {
        setMode("signup");
        setMessage("Account not found. Please create an account.");
        setError("");
      } else {
        setError(msg);
      }
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await signup({ email, password, username: username || "roll-number" });
      setMessage("Account created. Please log in.");
      setMode("login");
    } catch (err) {
      setError(err.message || "Signup failed");
    }
  };

  const handleSignOut = async () => {
    clearUser();
    await refreshData();
    window.location.href = "/login";
  };

  const current = user || getOrCreateUser();

  return (
    <section className="section">
      <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 4 }}>{mode === "login" ? "Login" : "Create account"}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Use Gmail or student.mes.ac.in. {/*Admin email: <strong>admin@ecosync.local</strong>*/}
        </p>
        <div className="cta-row" style={{ marginBottom: 12 }}>
          <button className={`btn ${mode === "login" ? "primary" : "ghost"}`} onClick={() => setMode("login")}>
            Login
          </button>
          <button className={`btn ${mode === "signup" ? "primary" : "ghost"}`} onClick={() => setMode("signup")}>
            Create account
          </button>
        </div>
        <form className="form" onSubmit={mode === "login" ? handleLogin : handleSignup}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com or you@student.mes.ac.in"
              required
            />
          </label>
          {mode === "signup" && (
            <label>
              Username (roll number)
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Roll number"
                required
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p className="muted">{message}</p>}
          <button className="btn primary" type="submit">
            {mode === "login" ? "Login" : "Sign up"}
          </button>
        </form>
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Current user</p>
          <p className="stat-number" style={{ margin: 0 }}>{current?.uid || "Not signed in"}</p>
          <p className="muted">{current?.email || "No email"}</p>
          <p className="muted">Role: {current?.role || "user"}</p>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Or continue with</p>
          <button className="btn ghost" type="button" disabled>
            Google (coming soon)
          </button>
        </div>
      </div>
    </section>
  );
}
