"use client";

import { useAppData } from "./AppProvider";

export default function TopLoader() {
  const { loading } = useAppData();
  return loading ? <div className="top-loader" aria-hidden="true" /> : null;
}
