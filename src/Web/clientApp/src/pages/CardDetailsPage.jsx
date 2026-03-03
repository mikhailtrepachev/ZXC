import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAccessToken, resolveUserDisplayNameByEmail } from "../auth/session";
import "./CardDetailsPage.css";

const tabs = [
  { id: "transactions", label: "Historie transakci" },
  { id: "security", label: "Detaily karty" },
  { id: "limits", label: "Limity karty" },
  { id: "profile", label: "Profil karty" },
];

const CARD_LIMITS_STORAGE_KEY = "zxc_cards_limits";

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

function transactionIsIncome(type) {
  if (typeof type === "string") {
    return type.toLowerCase() === "income";
  }

  return Number(type) === 0;
}

function parseJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatMoney(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
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
  }).format(date);
}

function TransactionsTab({ items, isLoading }) {
  if (isLoading) {
    return (
      <section className="card-details-panel">
        <h2>Historie transakci</h2>
        <p className="card-details-state">Nacitam transakce...</p>
      </section>
    );
  }

  return (
    <section className="card-details-panel">
      <h2>Historie transakci</h2>
      {items.length === 0 && <p className="card-details-state">Pro tuto kartu zatim nejsou dostupne transakce.</p>}

      <div className="card-details-list">
        {items.map((tx) => (
          <article className="tx-row" key={tx.id}>
            <div>
              <p className="tx-merchant">{tx.merchant}</p>
              <p className="tx-date">{tx.date}</p>
            </div>
            <div className="tx-right">
              <p
                className={`tx-amount ${tx.amount.startsWith("+") ? "incoming" : "outgoing"}`}
              >
                {tx.amount}
              </p>
              <p className="tx-status">{tx.status}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InfoGrid({ title, items, emptyText }) {
  return (
    <section className="card-details-panel">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="card-details-state">{emptyText}</p>
      ) : (
        <div className="info-grid">
          {items.map((item) => (
            <article className="info-card" key={item.label}>
              <p className="info-label">{item.label}</p>
              <p className="info-value">{item.value}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LimitsTab({ limits }) {
  return (
    <section className="card-details-panel">
      <h2>Limity karty</h2>
      {limits.length === 0 && <p className="card-details-state">Data limitu nejsou k dispozici.</p>}

      <div className="limits-list">
        {limits.map((limit) => {
          const percent = Math.round((limit.used / limit.max) * 100);

          return (
            <article className="limit-card" key={limit.name}>
              <div className="limit-header">
                <p>{limit.name}</p>
                <p>
                  {formatMoney(limit.used)} / {formatMoney(limit.max)}
                </p>
              </div>
              <div
                className="limit-track"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function CardDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cardId } = useParams();
  const [activeTab, setActiveTab] = useState("transactions");
  const [card, setCard] = useState(null);
  const [profileEmail, setProfileEmail] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isCardLoading, setIsCardLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [error, setError] = useState("");

  const numericCardId = Number(cardId);

  useEffect(() => {
    let isMounted = true;
    const cardFromState = location.state?.card;

    if (cardFromState && Number(cardFromState.id) === numericCardId) {
      setCard(cardFromState);
    }

    async function loadCard() {
      if (!Number.isFinite(numericCardId) || numericCardId <= 0) {
        if (isMounted) {
          setError("Neplatne ID karty.");
          setIsCardLoading(false);
        }
        return;
      }

      setIsCardLoading(true);
      setError("");

      try {
        const [cardsResponse, profileResponse] = await Promise.all([
          fetch("/api/Cards/list", {
            method: "GET",
            credentials: "include",
            headers: getAuthHeaders(),
          }),
          fetch("/api/Accounts/info", {
            method: "GET",
            credentials: "include",
            headers: getAuthHeaders(),
          }),
        ]);

        let email = "";
        if (profileResponse.ok) {
          const profile = await profileResponse.json().catch(() => null);
          email = String(pick(profile, "email", "Email", "userName", "UserName") || "").trim();
        }

        if (isMounted) {
          setProfileEmail(email);
        }

        if (!cardsResponse.ok) {
          throw new Error("Nepodarilo se nacist seznam karet.");
        }

        const list = await cardsResponse.json().catch(() => []);
        const cards = Array.isArray(list) ? list : [];
        const selected = cards.find((item) => Number(item.id) === numericCardId) || null;

        if (!isMounted) {
          return;
        }

        if (!selected) {
          setError("Karta nebyla nalezena.");
          setCard(null);
          return;
        }

        setCard({
          ...selected,
          holderLabel: resolveUserDisplayNameByEmail(email, selected.holderName),
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setError("Nepodarilo se nacist detaily karty.");
      } finally {
        if (isMounted) {
          setIsCardLoading(false);
        }
      }
    }

    async function loadTransactions() {
      setIsTransactionsLoading(true);

      try {
        const response = await fetch("/api/Transaction/history", {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error();
        }

        const payload = await response.json().catch(() => []);
        const list = Array.isArray(payload) ? payload : [];

        if (!isMounted) {
          return;
        }

        const withCardId = list.filter((item) => Number(pick(item, "cardId", "CardId")) === numericCardId);
        setTransactions(withCardId.length > 0 ? withCardId : list);
      } catch {
        if (isMounted) {
          setTransactions([]);
        }
      } finally {
        if (isMounted) {
          setIsTransactionsLoading(false);
        }
      }
    }

    loadCard();
    loadTransactions();

    return () => {
      isMounted = false;
    };
  }, [location.state, numericCardId]);

  const transactionRows = useMemo(() => {
    return transactions.slice(0, 8).map((tx) => {
      const amount = Number(tx.amount);
      const isIncome = transactionIsIncome(tx.type);
      const absoluteAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;

      return {
        id: tx.id || `${tx.date}-${tx.description}`,
        merchant: tx.description?.trim() || tx.counterpartyAccount || "Kartova transakce",
        date: formatDate(tx.date),
        amount: `${isIncome ? "+" : "-"} ${formatMoney(absoluteAmount)}`,
        status: isIncome ? "Incoming" : "Completed",
      };
    });
  }, [transactions]);

  const cardDetails = useMemo(() => {
    if (!card) {
      return [];
    }

    return [
      { label: "Card number", value: card.maskedNumber || "--" },
      { label: "Valid to", value: card.expiryDate || "--" },
      { label: "CVC", value: "***" },
      { label: "Card holder", value: resolveUserDisplayNameByEmail(profileEmail, card.holderName || "--") },
    ];
  }, [card, profileEmail]);

  const cardProfile = useMemo(() => {
    if (!card) {
      return [];
    }

    return [
      { label: "Card type", value: card.isVirtual ? "Virtualni" : "Plastova" },
      { label: "Status", value: card.isActive ? "Aktivni" : "Blokovana bankou" },
      { label: "Card id", value: String(card.id) },
      { label: "Bank account", value: card.accountNumber || "--" },
    ];
  }, [card]);

  const cardLimits = useMemo(() => {
    if (!card) {
      return [];
    }

    const allLimits = parseJsonStorage(CARD_LIMITS_STORAGE_KEY, {});
    const localLimit = Number(allLimits?.[card.id]);
    const outgoingSpent = transactions.reduce((sum, tx) => {
      const amount = Number(tx.amount);
      const isIncome = transactionIsIncome(tx.type);
      if (!Number.isFinite(amount) || isIncome) {
        return sum;
      }

      return sum + Math.abs(amount);
    }, 0);

    const max = Number.isFinite(localLimit) && localLimit > 0 ? localLimit : 50000;

    return [
      {
        name: "Lokalni denni limit",
        used: Math.min(outgoingSpent, max),
        max,
      },
    ];
  }, [card, transactions]);

  const panel = useMemo(() => {
    if (activeTab === "transactions") {
      return <TransactionsTab items={transactionRows} isLoading={isTransactionsLoading} />;
    }

    if (activeTab === "security") {
      return <InfoGrid title="Detaily karty" items={cardDetails} emptyText="Data karty nejsou k dispozici." />;
    }

    if (activeTab === "limits") {
      return <LimitsTab limits={cardLimits} />;
    }

    return <InfoGrid title="Profil karty" items={cardProfile} emptyText="Data profilu nejsou k dispozici." />;
  }, [activeTab, cardDetails, cardLimits, cardProfile, isTransactionsLoading, transactionRows]);

  return (
    <main className="card-details-page">
      <div className="card-details-toolbar">
        <button className="card-details-back" type="button" onClick={() => navigate("/accounts")}>
          Zpet na ucty
        </button>
      </div>

      <div className="card-details-shell">
        <aside className="card-sidebar">
          <article className="bank-card-preview" aria-label="Card preview">
            <p className="chip" />
            <p className="preview-name">{card?.isVirtual ? "Virtualni karta" : "Hlavni karta"}</p>
            <p className="preview-number">{card?.maskedNumber || "**** **** **** ****"}</p>
            <p className="preview-holder">
              {card ? resolveUserDisplayNameByEmail(profileEmail, card.holderName || "--") : "--"}
            </p>
          </article>

          <nav aria-label="Card sections" className="card-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`card-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="card-main-content">
          {isCardLoading && <p className="card-details-state">Nacitam kartu...</p>}
          {!isCardLoading && error && <p className="card-details-state card-details-state--error">{error}</p>}
          {!isCardLoading && !error && panel}
        </section>
      </div>
    </main>
  );
}
