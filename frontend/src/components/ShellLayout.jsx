"use client";

import { usePathname, useRouter } from "next/navigation";
import Navbar from "./Navbar";
import { useAppData } from "./AppProvider";
import { useEffect, useState } from "react";

export default function ShellLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAppData();
  const hideNav = pathname === "/login";
  const [showNotice, setShowNotice] = useState(false);
  const [dismissedNotice, setDismissedNotice] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem("ecosync-slow-notice");
    if (!seen) {
      setShowNotice(true);
      const timer = window.setTimeout(() => {
        setShowNotice(false);
        window.localStorage.setItem("ecosync-slow-notice", "1");
      }, 8000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  if (!loading && !user && pathname !== "/login") {
    return null;
  }

  return (
    <>
      {showNotice && !dismissedNotice && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card__header">
            <strong>Heads up</strong>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setDismissedNotice(true);
                setShowNotice(false);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("ecosync-slow-notice", "1");
                }
              }}
            >
              Dismiss
            </button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            This website is hosted on free servers, so it may take time to load during login and other actions.
          </p>
        </div>
      )}
      {!hideNav && <Navbar />}
      {children}
    </>
  );
}
