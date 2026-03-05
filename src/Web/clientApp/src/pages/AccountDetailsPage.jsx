import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAccessToken } from "../auth/session";
import "./PageLayout.css";
import "./AccountDetailsPage.css";

function getAuthHeaders() {
  const headers = {};
  const token = getAccessToken();

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

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

export default function AccountDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accountNumber } = useParams();

  const normalizedAccountNumber = decodeURIComponent(accountNumber || "").trim();

  const [account, setAccount] = useState(() => {
    const fromState = location.state?.account;
    if (!fromState) {
      return null;
    }

    const stateAccountNumber = String(fromState.accountNumber || "").trim();
    if (stateAccountNumber !== normalizedAccountNumber) {
      return null;
    }

    return fromState;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");

  const loadData = async () => {
    setError("");
    setIsLoading(true);

    if (!normalizedAccountNumber) {
      setError("Neplatné číslo účtu.");
      setAccount(null);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      const [profileResponse, transactionsResponse] = await Promise.all([
        fetch("/api/Accounts/info", {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch("/api/Transaction/history", {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        }),
      ]);

      if (!profileResponse.ok) {
        const message = await readErrorMessage(profileResponse, "Nepodařilo se načíst účet.");
        setError(message);
        setAccount(null);
        setTransactions([]);
        return;
      }

      const profilePayload = await profileResponse.json().catch(() => null);
      const rawAccounts = extractAccountList(profilePayload);
      const mappedAccounts = Array.isArray(rawAccounts) ? rawAccounts.map(mapAccount) : [];
      const selected = mappedAccounts.find(
        (item) => String(item.accountNumber || "").trim() === normalizedAccountNumber,
      );

      if (!selected) {
        setError("Účet nebyl nalezen.");
        setAccount(null);
        setTransactions([]);
        return;
      }

      setAccount(selected);

      if (!transactionsResponse.ok) {
        const message = await readErrorMessage(transactionsResponse, "Nepodařilo se načíst historii transakcí.");
        setError(message);
        setTransactions([]);
        return;
      }

      const transactionsPayload = await transactionsResponse.json().catch(() => []);
      setTransactions(Array.isArray(transactionsPayload) ? transactionsPayload : []);
    } catch {
      setError("Nepodařilo se načíst detail účtu.");
      setAccount(null);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [normalizedAccountNumber]);

  const transactionRows = useMemo(() => {
    if (!normalizedAccountNumber) {
      return [];
    }

    return transactions
      .filter((item) => {
        const from = String(pick(item, "fromAccountNumber", "FromAccountNumber") || "").trim();
        const to = String(pick(item, "toAccountNumber", "ToAccountNumber") || "").trim();

        if (from || to) {
          return from === normalizedAccountNumber || to === normalizedAccountNumber;
        }

        return true;
      })
      .slice(0, 80)
      .map((item) => {
        const from = String(pick(item, "fromAccountNumber", "FromAccountNumber") || "").trim();
        const to = String(pick(item, "toAccountNumber", "ToAccountNumber") || "").trim();
        const amount = Number(item.amount);
        const safeAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;
        const incoming = to === normalizedAccountNumber;

        const counterparty = incoming ? from || item.counterpartyAccount : to || item.counterpartyAccount;

        return {
          id: item.id || `${item.date}-${item.description}`,
          date: formatDate(item.date),
          counterparty: counterparty || "--",
          description: item.description || "Transakce",
          amount: `${incoming ? "+" : "-"}${formatMoney(safeAmount, account?.currency || "CZK")}`,
          incoming,
        };
      });
  }, [transactions, normalizedAccountNumber, account?.currency]);

  const handleExportPdf = async () => {
    setExportError("");
    setExportMessage("");

    if (transactionRows.length === 0) {
      setExportError("Pro tento účet není co exportovat.");
      return;
    }

    setIsExportingPdf(true);

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const marginX = 34;
      const pageHeight = doc.internal.pageSize.getHeight();
      const cols = [
        { key: "date", label: "Datum", width: 118 },
        { key: "counterparty", label: "Protiúčet", width: 142 },
        { key: "description", label: "Popis", width: 220 },
        { key: "amount", label: "Částka", width: 80, align: "right" },
      ];

      let y = 42;

      const drawTableHeader = () => {
        let x = marginX;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);

        for (const col of cols) {
          doc.setDrawColor(204, 204, 204);
          doc.rect(x, y, col.width, 22);
          doc.text(col.label, x + 6, y + 15);
          x += col.width;
        }

        y += 22;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Výpis z účtu", marginX, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Číslo účtu: ${account?.accountNumber || normalizedAccountNumber || "--"}`, marginX, y);
      y += 14;
      doc.text(`Vygenerovano: ${formatTimestamp(new Date())}`, marginX, y);
      y += 20;

      drawTableHeader();

      const rows = transactionRows.slice(0, 200);

      for (const row of rows) {
        const preparedCells = cols.map((col) => {
          const value = String(row[col.key] ?? "");
          return doc.splitTextToSize(value, col.width - 10);
        });

        const lineCount = Math.max(...preparedCells.map((lines) => Math.max(lines.length, 1)));
        const rowHeight = lineCount * 12 + 10;

        if (y + rowHeight > pageHeight - 34) {
          doc.addPage();
          y = 42;
          drawTableHeader();
        }

        let x = marginX;

        preparedCells.forEach((lines, index) => {
          const col = cols[index];

          doc.setDrawColor(225, 225, 225);
          doc.rect(x, y, col.width, rowHeight);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);

          lines.forEach((line, lineIndex) => {
            const textY = y + 14 + lineIndex * 12;
            if (col.align === "right") {
              doc.text(line, x + col.width - 6, textY, { align: "right" });
            } else {
              doc.text(line, x + 5, textY);
            }
          });

          x += col.width;
        });

        y += rowHeight;
      }

      const safeAccount = String(account?.accountNumber || normalizedAccountNumber || "ucet").replace(/[^\w-]/g, "");
      const dateStamp = new Date().toISOString().slice(0, 10);
      doc.save(`vypis-${safeAccount}-${dateStamp}.pdf`);
      setExportMessage("PDF bylo vygenerováno.");
    } catch {
      setExportError("Export do PDF se nepodařil.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="page account-details-page">
      <div className="page__container account-details-page__container">
        <div className="account-details-page__head">
          <div>
            <h1 className="page__title">Detail účtu</h1>
            <p className="page__subtitle">{account?.accountNumber || normalizedAccountNumber || "--"}</p>
          </div>

          <div className="page__actions">
            <button
              className="page__chip"
              type="button"
              onClick={() => navigate(`/payments?from=${encodeURIComponent(normalizedAccountNumber)}`)}
              disabled={!account}
            >
              Převod
            </button>
            <button
              className="page__chip"
              type="button"
              onClick={() => navigate(`/accounts/${encodeURIComponent(normalizedAccountNumber)}/conversion`)}
              disabled={!account}
            >
              Konverze
            </button>
            <button className="page__chip" type="button" onClick={loadData} disabled={isLoading}>
              Obnovit
            </button>
          </div>
        </div>

        {isLoading && <p className="account-details-page__state">Načítám data účtu...</p>}
        {!isLoading && error && <p className="account-details-page__state account-details-page__state--error">{error}</p>}

        {!isLoading && !error && account && (
          <div className="page__grid">
            <section className="page__panel">
              <h2 className="page__panelTitle">Přehled účtu</h2>
              <div className="account-details-page__metrics">
                <p>
                  Zůstatek:
                  <strong>{formatMoney(account.balance, account.currency)}</strong>
                </p>
                <p>
                  Měna:
                  <strong>{currencyCodeFromName(account.currency)}</strong>
                </p>
                <p>
                  Typ:
                  <strong>{account.type || "--"}</strong>
                </p>
                <p>
                  Stav:
                  <strong>{account.isFrozen ? "Zablokovaný" : "Aktivní"}</strong>
                </p>
              </div>
            </section>

            <section className="page__panel account-details-page__exportPanel">
              <h2 className="page__panelTitle">Dokumenty</h2>
              <div className="account-export">
                <div className="account-export__group">
                  <p className="account-export__label">Export:</p>
                  <ul className="account-export__list">
                    <li>
                      <button
                        type="button"
                        className="account-export__option account-export__option--pdf is-active"
                        onClick={handleExportPdf}
                        disabled={isExportingPdf}
                      >
                        {isExportingPdf ? "Generuji PDF..." : "PDF"}
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              {exportError && <p className="account-details-page__state account-details-page__state--error">{exportError}</p>}
              {exportMessage && <p className="account-details-page__state account-details-page__state--ok">{exportMessage}</p>}
            </section>

            <section className="page__panel page__panel--full">
              <h2 className="page__panelTitle">Historie transakcí</h2>

              {transactionRows.length === 0 && (
                <p className="account-details-page__state">Pro tento účet zatím nejsou dostupné transakce.</p>
              )}

              {transactionRows.length > 0 && (
                <div className="page__table">
                  {transactionRows.map((item) => (
                    <div className="page__row" key={item.id}>
                      <span>
                        <strong>{item.counterparty}</strong>
                        <br />
                        {item.description}
                      </span>
                      <span>{item.date}</span>
                      <span className={`page__amount ${item.incoming ? "page__amount--in" : ""}`}>{item.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <button className="page__button" type="button" onClick={() => navigate("/accounts")}>
          Zpět na účty
        </button>
      </div>
    </div>
  );
}
