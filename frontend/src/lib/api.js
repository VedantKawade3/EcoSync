const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const handleResponse = async (res) => {
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Request failed");
  }
  return res.json();
};

const authHeaders = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("ecosync-user");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      return { Authorization: `Bearer ${parsed.token}` };
    }
  } catch (e) {
    return {};
  }
  return {};
};

export const fetchPosts = async () => {
  const res = await fetch(`${API_BASE}/posts`, { cache: "no-store", headers: { ...authHeaders() } });
  return handleResponse(res);
};

export const createPost = async (payload) => {
  const res = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const fetchLostItems = async () => {
  const res = await fetch(`${API_BASE}/lost-found`, { cache: "no-store", headers: { ...authHeaders() } });
  return handleResponse(res);
};

export const createLostItem = async (payload) => {
  const res = await fetch(`${API_BASE}/lost-found`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const getUserCredits = async (userId) => {
  const res = await fetch(`${API_BASE}/rewards/users/${userId}`, { cache: "no-store", headers: { ...authHeaders() } });
  return handleResponse(res);
};

export const getUserSettings = async (userId) => {
  const res = await fetch(`${API_BASE}/users/${userId}/settings`, { cache: "no-store", headers: { ...authHeaders() } });
  return handleResponse(res);
};

export const updateUserSettings = async (userId, payload) => {
  const res = await fetch(`${API_BASE}/users/${userId}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const signup = async (payload) => {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const login = async (payload) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const listUsers = async () => {
  const res = await fetch(`${API_BASE}/auth/users`, { cache: "no-store", headers: { ...authHeaders() } });
  return handleResponse(res);
};

export const deletePost = async (postId) => {
  const res = await fetch(`${API_BASE}/posts/${postId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to delete post");
  }
  return true;
};

export const approvePost = async (postId, credits = 10, review_notes = "") => {
  const params = new URLSearchParams();
  params.append("credits", credits);
  if (review_notes) params.append("review_notes", review_notes);
  const res = await fetch(`${API_BASE}/posts/${postId}/approve?${params.toString()}`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
};

export const rejectPost = async (postId, reason = "") => {
  const params = new URLSearchParams();
  if (reason) params.append("reason", reason);
  const res = await fetch(`${API_BASE}/posts/${postId}/reject?${params.toString()}`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
};

export const deleteLostItem = async (itemId) => {
  const res = await fetch(`${API_BASE}/lost-found/${itemId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to delete lost & found item");
  }
  return true;
};

export const redeemCredits = async (payload) => {
  const res = await fetch(`${API_BASE}/rewards/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const getAiTip = async (prompt) => {
  const res = await fetch(`${API_BASE}/ai/tips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  return handleResponse(res);
};

export { API_BASE };
