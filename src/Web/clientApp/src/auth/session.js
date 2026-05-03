const AUTH_CHANGED_EVENT = "zxc-auth-changed";

let cachedSession = null;

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
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeRole(value) {
  return String(value || "").trim();
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

function normalizeSession(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const roles = Array.isArray(payload.roles)
    ? payload.roles
    : Array.isArray(payload.Roles)
      ? payload.Roles
      : [];

  return {
    isAuthenticated: Boolean(payload.isAuthenticated ?? payload.IsAuthenticated ?? true),
    userId: String(payload.userId ?? payload.UserId ?? payload.sub ?? ""),
    email: String(payload.email ?? payload.Email ?? payload.userName ?? payload.UserName ?? ""),
    roles: Array.from(new Set(roles.map(normalizeRole).filter(Boolean))),
  };
}

function sessionFromJwt(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }

  const rawRoles = [
    payload.role,
    payload.roles,
    payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
  ];
  const roles = rawRoles.flatMap((value) => (Array.isArray(value) ? value : [value])).map(normalizeRole).filter(Boolean);

  return normalizeSession({
    isAuthenticated: true,
    userId: payload.sub || "",
    email: payload.email || payload.unique_name || payload.name || "",
    roles,
  });
}

export function getAccessToken() {
  return null;
}

export function getCachedSession() {
  return cachedSession;
}

export async function fetchSession({ force = false } = {}) {
  if (cachedSession && !force) {
    return cachedSession;
  }

  try {
    const response = await fetch("/api/Clients/session", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const payload = await response.json().catch(() => null);
    cachedSession = normalizeSession(payload);
    return cachedSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  const hadSession = cachedSession !== null;
  cachedSession = null;
  if (hadSession) {
    notifyAuthChanged();
  }
}

export function persistSession(payload) {
  let parsed = payload;

  if (typeof payload === "string") {
    const trimmed = payload.trim();

    if (!trimmed) {
      return false;
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = null;
      }
    } else if (trimmed.split(".").length === 3) {
      parsed = sessionFromJwt(trimmed);
    }
  }

  const session = normalizeSession(parsed);
  if (!session?.isAuthenticated) {
    clearSession();
    return false;
  }

  cachedSession = session;
  notifyAuthChanged();
  return true;
}

export function getCurrentUserFromToken() {
  return cachedSession?.email || cachedSession?.userId || "";
}

export function getCurrentUserRoles() {
  return cachedSession?.roles || [];
}

export function hasRole(expectedRole) {
  const normalizedExpected = normalizeRole(expectedRole).toLowerCase();
  if (!normalizedExpected) {
    return false;
  }

  return getCurrentUserRoles().some((role) => role.toLowerCase() === normalizedExpected);
}

export function resolveUserDisplayNameByEmail(_email, fallback = "") {
  return String(fallback || "").trim();
}

export async function isAuthenticated() {
  const session = await fetchSession({ force: true });
  return Boolean(session?.isAuthenticated);
}

export async function logoutUser() {
  await fetch("/api/Clients/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);

  clearSession();
}

export { AUTH_CHANGED_EVENT };
