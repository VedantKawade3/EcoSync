"use client";

import { usePathname, useRouter } from "next/navigation";
import Navbar from "./Navbar";
import { useAppData } from "./AppProvider";
import { useEffect } from "react";

export default function ShellLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAppData();
  const hideNav = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  if (!loading && !user && pathname !== "/login") {
    return null;
  }

  return (
    <>
      {!hideNav && <Navbar />}
      {children}
    </>
  );
}
