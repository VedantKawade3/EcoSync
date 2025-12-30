"use client";

export const getOrCreateUser = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("ecosync-user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveUser = (user) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("ecosync-user", JSON.stringify(user));
};

export const clearUser = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("ecosync-user");
};

export const getAuthHeaders = () => {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem("ecosync-user");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      return { Authorization: `Bearer ${parsed.token}` };
    }
  } catch (e) {
    return {};
  }
  return {};
};
