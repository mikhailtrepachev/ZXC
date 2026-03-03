import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../auth/session";
import "./PageLayout.css";
import "./PaymentsPage.css";

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

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "--";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function transactionIsIncome(type) {
  if (typeof type === "string") {
    return type.toLowerCase() === "income";
  }

  return Number(type) === 0;
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

export default function PaymentsPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);

  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const accounts = useMemo(() => {
    return extractAccountList(profile);
  }, [profile]);

  const dailyLimit = Number(pick(profile, "dailyTransferLimit", "DailyTransferLimit")) || 0;
  const internetLimit = Number(pick(profile, "internetPaymentLimit", "InternetPaymentLimit")) || 0;

  const historyRows = useMemo(() => {
    return history.slice(0, 20).map((item) => {
      const incoming = transactionIsIncome(item.type);
      const numericAmount = Number(item.amount);
      const absolute = Number.isFinite(numericAmount) ? Math.abs(numericAmount) : 0;

      return {
        id: item.id,
        recipient: item.description?.trim() || item.counterpartyAccount || "Prevod",
        date: formatDate(item.date),
        amount: `${incoming ? "+" : "-"}${formatMoney(absolute)}`,
        incoming,
      };
    });
  }, [history]);

  const loadProfile = async () => {
    setProfileError("");
    setProfileLoading(true);

    try {
      const response = await fetch("/api/Accounts/info", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Nepodarilo se nacist profil.");
        setProfileError(message);
        setProfile(null);
        return;
      }

      const payload = await response.json().catch(() => null);
      setProfile(payload);
    } catch {
      setProfileError("Nepodarilo se nacist profil.");
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryError("");
    setHistoryLoading(true);

    try {
      const response = await fetch("/api/Transaction/history", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Nepodarilo se nacist historii plateb.");
        setHistoryError(message);
        setHistory([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setHistory(Array.isArray(payload) ? payload : []);
    } catch {
      setHistoryError("Nepodarilo se nacist historii plateb.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadHistory();
  }, []);

  const setTemplate = (value) => {
    setAmount(String(value));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    const normalizedToAccount = toAccountNumber.trim();
    const numericAmount = Number(amount);

    if (!/^\d{10,30}$/.test(normalizedToAccount)) {
      setSubmitError("Zadejte platne cislo uctu prijemce.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError("Castka musi byt kladne cislo.");
      return;
    }

    if (dailyLimit > 0 && numericAmount > dailyLimit) {
      setSubmitError(`Castka presahuje denni limit ${formatMoney(dailyLimit)}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Transaction/transfer", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          toAccountNumber: normalizedToAccount,
          amount: numericAmount,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Prevod se nepodaril.");
        setSubmitError(message);
        return;
      }

      setSubmitSuccess("Prevod byl uspesne odeslan.");
      setToAccountNumber("");
      setAmount("");
      await Promise.all([loadHistory(), loadProfile()]);
    } catch {
      setSubmitError("Prevod se nepodaril.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page payments-page">
      <div className="page__container">
        <h1 className="page__title">Platby</h1>
        <p className="page__subtitle">Prevod penez a historie transakci synchronizovana s backendem.</p>

        <div className="page__grid">
          <section className="page__panel">
            <h2 className="page__panelTitle">Novy prevod</h2>
            <form className="payments-page__form" onSubmit={handleSubmit}>
              <label>
                Cislo uctu prijemce
                <input
                  type="text"
                  value={toAccountNumber}
                  onChange={(event) => setToAccountNumber(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Napriklad 40817123456789012345"
                />
              </label>

              <label>
                Castka (Kc)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="1000"
                />
              </label>

              <button className="page__button payments-page__submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Odesilam..." : "Odeslat platbu"}
              </button>

              {submitError && <p className="payments-page__msg payments-page__msg--error">{submitError}</p>}
              {submitSuccess && <p className="payments-page__msg payments-page__msg--ok">{submitSuccess}</p>}
            </form>
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Limity a sablony</h2>

            {profileLoading && <p className="payments-page__hint">Nacitam limity...</p>}
            {!profileLoading && profileError && <p className="payments-page__msg payments-page__msg--error">{profileError}</p>}
            {!profileLoading && !profileError && (
              <div className="payments-page__limits">
                <p>Dennni limit prevodu: <strong>{formatMoney(dailyLimit)}</strong></p>
                <p>Limit internetovych plateb: <strong>{formatMoney(internetLimit)}</strong></p>
              </div>
            )}

            <div className="page__actions">
              <button className="page__chip" type="button" onClick={() => setTemplate(500)}>
                Sablona 500 Kc
              </button>
              <button className="page__chip" type="button" onClick={() => setTemplate(1000)}>
                Sablona 1000 Kc
              </button>
              <button className="page__chip" type="button" onClick={() => setTemplate(5000)}>
                Sablona 5000 Kc
              </button>
            </div>

            <div className="payments-page__accounts">
              <p>Moje ucty:</p>
              {accounts.length === 0 && <span>Zatim bez dostupnych uctu.</span>}
              {accounts.map((account) => (
                <span key={pick(account, "id", "Id")}>
                  {pick(account, "accountNumber", "AccountNumber")} ({pick(account, "currency", "Currency")})
                </span>
              ))}
            </div>
          </section>

          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Historie plateb</h2>

            {historyLoading && <p className="payments-page__hint">Nacitam historii...</p>}
            {!historyLoading && historyError && <p className="payments-page__msg payments-page__msg--error">{historyError}</p>}
            {!historyLoading && !historyError && historyRows.length === 0 && (
              <p className="payments-page__hint">Historie je zatim prazdna.</p>
            )}

            {!historyLoading && !historyError && historyRows.length > 0 && (
              <div className="page__table">
                {historyRows.map((payment) => (
                  <div className="page__row" key={payment.id}>
                    <span>{payment.recipient}</span>
                    <span>{payment.date}</span>
                    <span className={`page__amount ${payment.incoming ? "page__amount--in" : ""}`}>
                      {payment.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <button className="page__button" onClick={() => navigate("/accounts")}>
          Zpet na ucty
        </button>
      </div>
    </div>
  );
}
