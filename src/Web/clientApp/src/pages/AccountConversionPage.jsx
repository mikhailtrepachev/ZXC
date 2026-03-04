import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAccessToken } from "../auth/session";
import "./PageLayout.css";
import "./AccountConversionPage.css";

function getAuthHeaders(includeJson = false) {
  const headers = {};
  const token = getAccessToken();

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function pick(obj, ...keys) {
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

function currencyCodeFromName(currencyName) {
  const normalized = String(currencyName || "").toLowerCase();

  if (normalized.includes("dollar") || normalized === "usd") {
    return "USD";
  }

  if (normalized.includes("euro") || normalized === "eur") {
    return "EUR";
  }

  return "CZK";
}

function formatMoney(value, currencyName = "CZK") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "--";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currencyCodeFromName(currencyName),
    maximumFractionDigits: 2,
  }).format(amount);
}

function extractAccountList(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const directCandidates = [
    payload.accounts,
    payload.Accounts,
    payload.clientAccounts,
    payload.ClientAccounts,
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
    if (first && typeof first === "object" && ("accountNumber" in first || "AccountNumber" in first)) {
      return value;
    }
  }

  return [];
}

function mapAccount(rawItem) {
  const accountNumber = String(pick(rawItem, "accountNumber", "AccountNumber") || "").trim();
  const balance = Number(pick(rawItem, "balance", "Balance")) || 0;
  const currency = String(pick(rawItem, "currency", "Currency") || "Koruna");
  const type = String(pick(rawItem, "type", "Type") || "Debet");
  const isFrozen = Boolean(pick(rawItem, "isFrozen", "IsFrozen"));

  return {
    accountNumber,
    balance,
    currency,
    type,
    isFrozen,
  };
}

async function readErrorMessage(response, fallbackMessage) {
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
  }

  const text = await response.text().catch(() => "");
  if (!text?.trim() || text.includes("<!DOCTYPE") || text.includes("<html")) {
    return fallbackMessage;
  }

  return text;
}

export default function AccountConversionPage() {
  const navigate = useNavigate();
  const { accountNumber } = useParams();

  const normalizedFromAccountNumber = decodeURIComponent(accountNumber || "").trim();

  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("Konverze mezi vlastnimi ucty");

  const [estimate, setEstimate] = useState(null);
  const [estimateError, setEstimateError] = useState("");
  const [isEstimateLoading, setIsEstimateLoading] = useState(false);

  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourceAccount = useMemo(() => {
    return accounts.find((item) => item.accountNumber === normalizedFromAccountNumber) || null;
  }, [accounts, normalizedFromAccountNumber]);

  const targetAccounts = useMemo(() => {
    return accounts.filter(
      (item) => item.accountNumber !== normalizedFromAccountNumber && !item.isFrozen,
    );
  }, [accounts, normalizedFromAccountNumber]);

  const loadAccounts = async () => {
    setLoadError("");
    setIsLoading(true);

    if (!normalizedFromAccountNumber) {
      setLoadError("Neplatne cislo zdrojoveho uctu.");
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/Accounts/info", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const messageText = await readErrorMessage(response, "Nepodarilo se nacist ucty.");
        setLoadError(messageText);
        setAccounts([]);
        return;
      }

      const payload = await response.json().catch(() => null);
      const list = extractAccountList(payload);
      const mapped = Array.isArray(list) ? list.map(mapAccount) : [];
      setAccounts(mapped);
    } catch {
      setLoadError("Nepodarilo se nacist ucty.");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [normalizedFromAccountNumber]);

  useEffect(() => {
    if (!targetAccounts.some((item) => item.accountNumber === toAccountNumber)) {
      setToAccountNumber(targetAccounts[0]?.accountNumber || "");
    }
  }, [targetAccounts, toAccountNumber]);

  useEffect(() => {
    const numericAmount = Number(amount);
    if (!sourceAccount || !toAccountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setEstimate(null);
      setEstimateError("");
      return;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(async () => {
      setIsEstimateLoading(true);
      setEstimateError("");

      try {
        const response = await fetch("/api/Transaction/conversion-estimate", {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            fromAccountNumber: sourceAccount.accountNumber,
            toAccountNumber,
            amount: numericAmount,
          }),
        });

        if (!response.ok) {
          const messageText = await readErrorMessage(response, "Nepodarilo se spocitat konverzi.");
          if (!isCancelled) {
            setEstimate(null);
            setEstimateError(messageText);
          }
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!isCancelled) {
          setEstimate(payload && typeof payload === "object" ? payload : null);
        }
      } catch {
        if (!isCancelled) {
          setEstimate(null);
          setEstimateError("Nepodarilo se spocitat konverzi.");
        }
      } finally {
        if (!isCancelled) {
          setIsEstimateLoading(false);
        }
      }
    }, 280);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [amount, sourceAccount, toAccountNumber]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!sourceAccount) {
      setSubmitError("Zdrojovy ucet nebyl nalezen.");
      return;
    }

    const target = targetAccounts.find((item) => item.accountNumber === toAccountNumber) || null;
    if (!target) {
      setSubmitError("Vyberte cilovy ucet.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError("Zadejte kladnou castku.");
      return;
    }

    if (numericAmount > sourceAccount.balance) {
      setSubmitError("Nedostatek prostredku na zdrojovem uctu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Transaction/transfer", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          fromAccountNumber: sourceAccount.accountNumber,
          toAccountNumber: target.accountNumber,
          amount: numericAmount,
          message: String(message || "").trim(),
        }),
      });

      if (!response.ok) {
        const messageText = await readErrorMessage(response, "Konverzi se nepodarilo provest.");
        setSubmitError(messageText);
        return;
      }

      setSubmitSuccess("Konverze byla uspesne provedena.");
      setAmount("");
      await loadAccounts();
    } catch {
      setSubmitError("Konverzi se nepodarilo provest.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page account-conversion-page">
      <div className="page__container account-conversion-page__container">
        <h1 className="page__title">Konverze mezi ucty</h1>
        <p className="page__subtitle">
          Prevod mezi vasimi ucty s orientacnim vypoctem castky, ktera prijde na cilovy ucet.
        </p>

        {isLoading && <p className="account-conversion-page__state">Nacitam ucty...</p>}
        {!isLoading && loadError && (
          <p className="account-conversion-page__state account-conversion-page__state--error">{loadError}</p>
        )}

        {!isLoading && !loadError && sourceAccount && (
          <form className="account-conversion-page__form" onSubmit={handleSubmit}>
            <div className="page__grid">
              <section className="page__panel">
                <h2 className="page__panelTitle">Zdrojovy ucet</h2>
                <p className="account-conversion-page__value">{sourceAccount.accountNumber}</p>
                <p className="account-conversion-page__muted">
                  Zustatek: {formatMoney(sourceAccount.balance, sourceAccount.currency)}
                </p>
                <p className="account-conversion-page__muted">
                  Mena: {currencyCodeFromName(sourceAccount.currency)}
                </p>
              </section>

              <section className="page__panel">
                <h2 className="page__panelTitle">Cilovy ucet</h2>
                <label className="account-conversion-page__field">
                  <span>Na jaky ucet</span>
                  <select value={toAccountNumber} onChange={(event) => setToAccountNumber(event.target.value)}>
                    {targetAccounts.length === 0 && <option value="">Bez dostupneho uctu</option>}
                    {targetAccounts.map((item) => (
                      <option key={item.accountNumber} value={item.accountNumber}>
                        {item.accountNumber} ({currencyCodeFromName(item.currency)})
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="page__panel page__panel--full">
                <h2 className="page__panelTitle">Parametry konverze</h2>
                <div className="account-conversion-page__fieldsGrid">
                  <label className="account-conversion-page__field">
                    <span>Castka k prevodu</span>
                    <div className="account-conversion-page__amountWrap">
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="Napriklad 1000"
                      />
                      <strong>{currencyCodeFromName(sourceAccount.currency)}</strong>
                    </div>
                  </label>

                  <label className="account-conversion-page__field">
                    <span>Na cilovy ucet prijde</span>
                    <input
                      type="text"
                      readOnly
                      value={
                        estimate
                          ? formatMoney(estimate.amountTo, estimate.toCurrency)
                          : isEstimateLoading
                            ? "Pocitam..."
                            : "--"
                      }
                    />
                  </label>
                </div>

                {estimate && (
                  <p className="account-conversion-page__hint">
                    Kurz: 1 {currencyCodeFromName(estimate.fromCurrency)} = {estimate.conversionRate}{" "}
                    {currencyCodeFromName(estimate.toCurrency)}
                  </p>
                )}
                {estimateError && (
                  <p className="account-conversion-page__state account-conversion-page__state--error">
                    {estimateError}
                  </p>
                )}

                <label className="account-conversion-page__field">
                  <span>Zprava k prevodu (nepovinne)</span>
                  <input
                    type="text"
                    maxLength={140}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </label>
              </section>
            </div>

            {submitError && (
              <p className="account-conversion-page__state account-conversion-page__state--error">{submitError}</p>
            )}
            {submitSuccess && (
              <p className="account-conversion-page__state account-conversion-page__state--ok">{submitSuccess}</p>
            )}

            <div className="account-conversion-page__actions">
              <button className="page__button" type="submit" disabled={isSubmitting || targetAccounts.length === 0}>
                {isSubmitting ? "Provadim..." : "Provest konverzi"}
              </button>
              <button
                className="page__chip"
                type="button"
                onClick={() => navigate(`/accounts/${encodeURIComponent(normalizedFromAccountNumber)}`)}
              >
                Zpet na detail uctu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
