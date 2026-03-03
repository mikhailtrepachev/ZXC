const ACCESS_TOKEN_KEY = "zxc_access_token";
const REFRESH_TOKEN_KEY = "zxc_refresh_token";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function persistSession(payload) {
  if (!payload?.accessToken) {
    return false;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);

  if (payload.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  }

  return true;
}

export async function isAuthenticated() {
  const token = getAccessToken();
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch("/api/Users/manage/info", {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
