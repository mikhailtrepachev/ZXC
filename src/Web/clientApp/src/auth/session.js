const ACCESS_TOKEN_KEY = "zxc_access_token";
const REFRESH_TOKEN_KEY = "zxc_refresh_token";

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function persistSession(payload) {
  let accessToken = "";
  let refreshToken = "";

  if (typeof payload === "string") {
    accessToken = payload;
  } else if (payload && typeof payload === "object") {
    accessToken = payload.accessToken || payload.token || "";
    refreshToken = payload.refreshToken || "";
  }

  if (!accessToken) {
    return false;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  return true;
}

export function getCurrentUserFromToken() {
  const token = getAccessToken();
  const payload = decodeJwtPayload(token);

  if (!payload) {
    return "";
  }

  return payload.email || payload.unique_name || payload.name || payload.sub || "";
}

export async function isAuthenticated() {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch("/api/Accounts/info", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function logoutUser() {
  clearSession();
}
