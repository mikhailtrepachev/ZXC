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

function mapAccountForTransfer(rawItem) {
  const accountNumber = String(
    pick(rawItem, "accountNumber", "AccountNumber") || "",
  ).trim();
  const currency = String(pick(rawItem, "currency", "Currency") || "CZK");
  const type = String(pick(rawItem, "type", "Type") || "");
  const isFrozen = Boolean(pick(rawItem, "isFrozen", "IsFrozen"));
  const balance = Number(pick(rawItem, "balance", "Balance"));

  return {
    id: String(pick(rawItem, "id", "Id") || accountNumber),
    accountNumber,
    currency,
    type,
    isFrozen,
    balance: Number.isFinite(balance) ? balance : 0,
  };
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
    if (
      first &&
      typeof first === "object" &&
      ("accountNumber" in first || "AccountNumber" in first)
    ) {
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

  const [fromAccountNumber, setFromAccountNumber] = useState("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const accounts = useMemo(() => {
    const rawAccounts = extractAccountList(profile);
    if (!Array.isArray(rawAccounts)) {
      return [];
    }

    return rawAccounts
      .map(mapAccountForTransfer)
      .filter((account) => Boolean(account.accountNumber));
  }, [profile]);

  const activeAccounts = useMemo(() => {
    return accounts.filter((account) => !account.isFrozen);
  }, [accounts]);

  const dailyLimit =
    Number(pick(profile, "dailyTransferLimit", "DailyTransferLimit")) || 0;
  const internetLimit =
    Number(pick(profile, "internetPaymentLimit", "InternetPaymentLimit")) || 0;

  const historyRows = useMemo(() => {
    return history.slice(0, 20).map((item) => {
      const incoming = transactionIsIncome(item.type);
      const numericAmount = Number(item.amount);
      const absolute = Number.isFinite(numericAmount)
        ? Math.abs(numericAmount)
        : 0;

      return {
        id: item.id,
        recipient:
          item.description?.trim() || item.counterpartyAccount || "Prevod",
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
        const message = await readErrorMessage(
          response,
          "Nepodařilo se načíst profil.",
        );
        setProfileError(message);
        setProfile(null);
        return;
      }

      const payload = await response.json().catch(() => null);
      setProfile(payload);
    } catch {
      setProfileError("Nepodařilo se načíst profil.");
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
        const message = await readErrorMessage(
          response,
          "Nepodařilo se načíst historii plateb.",
        );
        setHistoryError(message);
        setHistory([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setHistory(Array.isArray(payload) ? payload : []);
    } catch {
      setHistoryError("Nepodařilo se načíst historii plateb.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadHistory();
  }, []);

  useEffect(() => {
    if (activeAccounts.length === 0) {
      setFromAccountNumber("");
      return;
    }

    if (
      !activeAccounts.some(
        (account) => account.accountNumber === fromAccountNumber,
      )
    ) {
      setFromAccountNumber(activeAccounts[0].accountNumber);
    }
  }, [activeAccounts, fromAccountNumber]);

  useEffect(() => {
    if (!fromAccountNumber) {
      return;
    }

    if (toAccountNumber !== fromAccountNumber) {
      return;
    }

    const fallbackReceiver =
      activeAccounts.find(
        (account) => account.accountNumber !== fromAccountNumber,
      )?.accountNumber || "";
    setToAccountNumber(fallbackReceiver);
  }, [fromAccountNumber, toAccountNumber, activeAccounts]);

  useEffect(() => {
    if (toAccountNumber || !fromAccountNumber) {
      return;
    }

    const initialReceiver =
      activeAccounts.find(
        (account) => account.accountNumber !== fromAccountNumber,
      )?.accountNumber || "";
    if (initialReceiver) {
      setToAccountNumber(initialReceiver);
    }
  }, [toAccountNumber, fromAccountNumber, activeAccounts]);

  const setTemplate = (value) => {
    setAmount(String(value));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    const normalizedFromAccount = fromAccountNumber.trim();
    const normalizedToAccount = toAccountNumber.trim();
    const numericAmount = Number(amount);
    const senderAccount = activeAccounts.find(
      (account) => account.accountNumber === normalizedFromAccount,
    );

    if (!/^\d{10,30}$/.test(normalizedFromAccount)) {
      setSubmitError("Vyberte platný účet odesílatele.");
      return;
    }

    if (!senderAccount) {
      setSubmitError("Vybraný účet odesílatele není dostupný.");
      return;
    }

    if (!/^\d{10,30}$/.test(normalizedToAccount)) {
      setSubmitError("Zadejte platné číslo účtu příjemce.");
      return;
    }

    if (normalizedFromAccount === normalizedToAccount) {
      setSubmitError("Nelze provést převod na stejný účet.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError("Částka musí být kladné číslo.");
      return;
    }

    if (numericAmount > senderAccount.balance) {
      setSubmitError("Nedostatek prostředků na vybraném účtu.");
      return;
    }

    if (dailyLimit > 0 && numericAmount > dailyLimit) {
      setSubmitError(
        `Částka přesahuje denní limit ${formatMoney(dailyLimit)}.`,
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Transaction/transfer", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          fromAccountNumber: normalizedFromAccount,
          toAccountNumber: normalizedToAccount,
          amount: numericAmount,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "Převod se nepodařil.",
        );
        setSubmitError(message);
        return;
      }

      setSubmitSuccess("Převod byl úspěšně odeslán.");
      const suggestedReceiver =
        activeAccounts.find(
          (account) => account.accountNumber !== normalizedFromAccount,
        )?.accountNumber || "";
      setToAccountNumber(suggestedReceiver);
      setAmount("");
      await Promise.all([loadHistory(), loadProfile()]);
    } catch {
      setSubmitError("Převod se nepodařil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page payments-page">
      <div className="page__container">
        <h1 className="page__title">Platby</h1>
        <p className="page__subtitle">
          Převod peněz a historie transakcí synchronizovány s backendem.
        </p>

        <div className="page__grid">
          <section className="page__panel">
            <h2 className="page__panelTitle">Nový převod</h2>
            <form className="payments-page__form" onSubmit={handleSubmit}>
              <label>
                Z účtu
                <select
                  value={fromAccountNumber}
                  onChange={(event) => setFromAccountNumber(event.target.value)}
                  disabled={activeAccounts.length === 0}
                >
                  {activeAccounts.length === 0 && (
                    <option value="">Bez dostupného účtu</option>
                  )}
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.accountNumber} (
                      {formatMoney(account.balance, account.currency)} -{" "}
                      {account.currency})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Číslo účtu příjemce
                <input
                  type="text"
                  value={toAccountNumber}
                  onChange={(event) =>
                    setToAccountNumber(event.target.value.replace(/[^\d]/g, ""))
                  }
                  placeholder="Napriklad 40817123456789012345"
                  list="payments-page-my-accounts"
                />
              </label>
              <datalist id="payments-page-my-accounts">
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountNumber} />
                ))}
              </datalist>

              <label>
                Částka (Kč)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="1000"
                />
              </label>

              <button
                className="page__button payments-page__submit"
                type="submit"
                disabled={isSubmitting || activeAccounts.length === 0}
              >
                {isSubmitting ? "Odesilam..." : "Odeslat platbu"}
              </button>

              {submitError && (
                <p className="payments-page__msg payments-page__msg--error">
                  {submitError}
                </p>
              )}
              {submitSuccess && (
                <p className="payments-page__msg payments-page__msg--ok">
                  {submitSuccess}
                </p>
              )}
            </form>
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Limity a šablony</h2>

            {profileLoading && (
              <p className="payments-page__hint">Načítám limity...</p>
            )}
            {!profileLoading && profileError && (
              <p className="payments-page__msg payments-page__msg--error">
                {profileError}
              </p>
            )}
            {!profileLoading && !profileError && (
              <div className="payments-page__limits">
                <p>
                  Denní limit převodu:{" "}
                  <strong>{formatMoney(dailyLimit)}</strong>
                </p>
                <p>
                  Limit internetových plateb:{" "}
                  <strong>{formatMoney(internetLimit)}</strong>
                </p>
              </div>
            )}

            <div className="page__actions">
              <button
                className="page__chip"
                type="button"
                onClick={() => setTemplate(500)}
              >
                Šablona 500 Kc
              </button>
              <button
                className="page__chip"
                type="button"
                onClick={() => setTemplate(1000)}
              >
                Šablona 1000 Kc
              </button>
              <button
                className="page__chip"
                type="button"
                onClick={() => setTemplate(5000)}
              >
                Šablona 5000 Kc
              </button>
            </div>

            <div className="payments-page__accounts">
              <p>Moje účty:</p>
              {accounts.length === 0 && <span>Zatím bez dostupných účtů.</span>}
              {accounts.map((account) => (
                <span key={account.id}>
                  {account.accountNumber} ({account.currency}) -{" "}
                  {formatMoney(account.balance, account.currency)}
                </span>
              ))}
            </div>
          </section>

          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Historie plateb</h2>

            {historyLoading && (
              <p className="payments-page__hint">Načítám historii...</p>
            )}
            {!historyLoading && historyError && (
              <p className="payments-page__msg payments-page__msg--error">
                {historyError}
              </p>
            )}
            {!historyLoading && !historyError && historyRows.length === 0 && (
              <p className="payments-page__hint">Historie je zatím prázdná.</p>
            )}

            {!historyLoading && !historyError && historyRows.length > 0 && (
              <div className="page__table">
                {historyRows.map((payment) => (
                  <div className="page__row" key={payment.id}>
                    <span>{payment.recipient}</span>
                    <span>{payment.date}</span>
                    <span
                      className={`page__amount ${payment.incoming ? "page__amount--in" : ""}`}
                    >
                      {payment.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <button className="page__button" onClick={() => navigate("/accounts")}>
          Zpět na účty
        </button>
      </div>
    </div>
  );
}
