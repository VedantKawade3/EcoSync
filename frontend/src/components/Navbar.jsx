"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NavLink } from "./NavLink";
import { useAppData } from "./AppProvider";
import { clearUser } from "../lib/user";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const { refreshData, user } = useAppData();
  const router = useRouter();
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    setOpen(false);
    clearUser();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    } else {
      router.push("/login");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <header className="nav">
      <div className="nav__brand">
        <span className="nav__logo">ES</span>
        <div>
          <p className="nav__title">EcoSync</p>
          <p className="nav__subtitle">Earn credits for good actions</p>
        </div>
      </div>
      <button className="nav__burger" onClick={() => setLinksOpen((p) => !p)}>
        ☰
      </button>
      <div className={`nav__links ${linksOpen ? "open" : ""}`}>
        <NavLink href="/">Home</NavLink>
        <NavLink href="/uploads">Uploads</NavLink>
        <NavLink href="/lost-found">Lost &amp; Found</NavLink>
        <NavLink href="/rewards">Rewards</NavLink>
        <div className="nav__menu">
          <button className="btn secondary nav__toggle" onClick={() => setOpen((p) => !p)}>
            Account
          </button>
          {open && (
            <div className="nav__dropdown" ref={dropdownRef}>
              <NavLink href="/profile" onClick={() => setOpen(false)}>
                Profile
              </NavLink>
              {user?.role === "admin" && (
                <NavLink href="/admin" onClick={() => setOpen(false)}>
                  Admin
                </NavLink>
              )}
              <NavLink href="/settings" onClick={() => setOpen(false)}>
                Settings
              </NavLink>
              <NavLink href="/login" onClick={() => setOpen(false)}>
                Login
              </NavLink>
              <button className="btn ghost nav__logout" type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;


