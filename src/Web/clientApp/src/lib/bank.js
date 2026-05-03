export function getAuthHeaders(includeJson = false) {
  const headers = {};

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

export function pick(obj, ...keys) {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }

  return undefined;
}

export async function readErrorMessage(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);

    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }

    if (payload?.detail) {
      return payload.detail;
    }

    if (payload?.title) {
      return payload.title;
    }

    if (payload?.errors && typeof payload.errors === "object") {
      const firstKey = Object.keys(payload.errors)[0];
      const firstError = payload.errors[firstKey]?.[0];

      if (firstError) {
        return firstError;
      }
    }
  }

  const text = await response.text().catch(() => "");
  if (!text?.trim() || text.includes("<!DOCTYPE") || text.includes("<html")) {
    return fallbackMessage;
  }

  return text;
}

export function currencyCodeFromName(currencyName) {
  const normalized = String(currencyName || "").toLowerCase();

  if (normalized.includes("dollar") || normalized === "usd") {
    return "USD";
  }

  if (normalized.includes("euro") || normalized === "eur") {
    return "EUR";
  }

  return "CZK";
}

export function formatMoney(value, currencyName = "CZK", maximumFractionDigits = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "--";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currencyCodeFromName(currencyName),
    maximumFractionDigits,
  }).format(amount);
}

export function formatDate(value, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function extractAccountList(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const directCandidates = [
    payload.accounts,
    payload.Accounts,
    payload.clientAccounts,
    payload.ClientAccounts,
    payload.bankAccounts,
    payload.BankAccounts,
  ];

  for (const value of directCandidates) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(payload)) {
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }

    const first = value[0];
    if (
      first &&
      typeof first === "object" &&
      ("accountNumber" in first ||
        "AccountNumber" in first ||
        "isFrozen" in first ||
        "IsFrozen" in first)
    ) {
      return value;
    }
  }

  return [];
}

export function mapAccount(rawItem) {
  const accountNumber = String(pick(rawItem, "accountNumber", "AccountNumber") || "").trim();
  const balance = Number(pick(rawItem, "balance", "Balance")) || 0;
  const currency = String(pick(rawItem, "currency", "Currency") || "Koruna");
  const type = String(pick(rawItem, "type", "Type") || "Debet");
  const isFrozen = Boolean(pick(rawItem, "isFrozen", "IsFrozen"));
  const id = Number(pick(rawItem, "id", "Id", "accountId", "AccountId"));
  const normalizedCurrency = currency.toLowerCase();

  return {
    id: Number.isFinite(id) ? id : accountNumber || Math.random(),
    accountNumber,
    balance,
    currency,
    type,
    isFrozen,
    currencyCode: currencyCodeFromName(currency),
    label:
      type.toLowerCase() === "investment"
        ? "Investment account"
        : normalizedCurrency.includes("euro")
          ? "EUR account"
          : normalizedCurrency.includes("dollar")
            ? "USD account"
            : "Current account",
  };
}

export function transactionIsIncome(type) {
  if (typeof type === "string") {
    return type.toLowerCase() === "income";
  }

  return Number(type) === 0;
}

export function classForStatus(status) {
  if (status === "error") {
    return "border-destructive/40 bg-destructive/5 text-destructive";
  }

  if (status === "ok") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-border bg-card text-muted-foreground";
}
