import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAccessToken, getLocalCardPin, resolveUserDisplayNameByEmail } from "../auth/session";
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

function formatCountdown(secondsLeft) {
  const safe = Math.max(0, Number(secondsLeft) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordChecking, setIsPasswordChecking] = useState(false);
  const [revealUntil, setRevealUntil] = useState(0);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const numericCardId = Number(cardId);
  const isSensitiveVisible = revealUntil > nowTs;
  const secondsLeft = Math.max(0, Math.ceil((revealUntil - nowTs) / 1000));

  useEffect(() => {
    if (!isSensitiveVisible) {
      return;
    }

    const timerId = setInterval(() => {
      setNowTs(Date.now());
    }, 250);

    return () => {
      clearInterval(timerId);
    };
  }, [isSensitiveVisible]);

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

    const fullCardNumber = String(pick(card, "cardNumber", "CardNumber", "fullNumber", "FullNumber") || "").trim();
    const localPin = getLocalCardPin(card.id);

    return [
      { label: "Card number", value: isSensitiveVisible && fullCardNumber ? fullCardNumber : card.maskedNumber || "--" },
      { label: "Valid to", value: card.expiryDate || "--" },
      { label: "CVC", value: isSensitiveVisible ? card.cvv || "--" : "***" },
      { label: "PIN", value: isSensitiveVisible ? localPin || "Neni ulozen na klientu" : "****" },
      { label: "Card holder", value: resolveUserDisplayNameByEmail(profileEmail, card.holderName || "--") },
    ];
  }, [card, isSensitiveVisible, profileEmail]);

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
      return (
        <section className="card-details-panel">
          <div className="card-details-head">
            <h2>Detaily karty</h2>
            <button className="card-details-revealBtn" type="button" onClick={() => setIsPasswordModalOpen(true)}>
              {isSensitiveVisible ? "Detaily otevreny" : "Pokazat detaily"}
            </button>
          </div>

          {!isSensitiveVisible && (
            <p className="card-details-state">
              Citlive udaje jsou skryte. Kliknete na tlacitko a overte heslo.
            </p>
          )}

          {isSensitiveVisible && (
            <p className="card-details-state card-details-state--ok">
              Citlive udaje jsou dostupne: {formatCountdown(secondsLeft)}
            </p>
          )}

          {isSensitiveVisible && !String(pick(card, "cardNumber", "CardNumber", "fullNumber", "FullNumber") || "").trim() && (
            <p className="card-details-state">
              Backend vraci pouze maskovane cislo karty, proto plne cislo neni k dispozici.
            </p>
          )}

          {cardDetails.length === 0 ? (
            <p className="card-details-state">Data karty nejsou k dispozici.</p>
          ) : (
            <div className="info-grid">
              {cardDetails.map((item) => (
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

    if (activeTab === "limits") {
      return <LimitsTab limits={cardLimits} />;
    }

    return <InfoGrid title="Profil karty" items={cardProfile} emptyText="Data profilu nejsou k dispozici." />;
  }, [activeTab, card, cardDetails, cardLimits, cardProfile, isSensitiveVisible, isTransactionsLoading, secondsLeft, transactionRows]);

  const closePasswordModal = () => {
    if (isPasswordChecking) {
      return;
    }

    setIsPasswordModalOpen(false);
    setPasswordInput("");
    setPasswordError("");
  };

  const handleVerifyPassword = async () => {
    setPasswordError("");

    const password = passwordInput.trim();
    if (!password) {
      setPasswordError("Zadejte heslo.");
      return;
    }

    if (!profileEmail) {
      setPasswordError("Nepodarilo se zjistit e-mail uzivatele.");
      return;
    }

    setIsPasswordChecking(true);

    try {
      const response = await fetch("/api/Clients/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profileEmail,
          password,
        }),
      });

      if (!response.ok) {
        setPasswordError("Nespravne heslo.");
        return;
      }

      setRevealUntil(Date.now() + 60_000);
      setNowTs(Date.now());
      setIsPasswordModalOpen(false);
      setPasswordInput("");
      setPasswordError("");
    } catch {
      setPasswordError("Overeni hesla se nezdarilo.");
    } finally {
      setIsPasswordChecking(false);
    }
  };

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

      {isPasswordModalOpen && (
        <div className="card-details-modalBackdrop" role="presentation" onClick={closePasswordModal}>
          <div
            className="card-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-reveal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="card-reveal-title">Potvrzeni hesla</h2>
            <p className="card-details-modalHint">Pro zobrazeni detailu karty zadejte heslo od uctu.</p>

            <label className="card-details-modalField">
              <span>Heslo</span>
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Zadejte heslo"
                autoFocus
              />
            </label>

            {passwordError && <p className="card-details-modalError">{passwordError}</p>}

            <div className="card-details-modalActions">
              <button type="button" className="card-details-modalBtn card-details-modalBtn--ghost" onClick={closePasswordModal} disabled={isPasswordChecking}>
                Zrusit
              </button>
              <button type="button" className="card-details-modalBtn card-details-modalBtn--primary" onClick={handleVerifyPassword} disabled={isPasswordChecking}>
                {isPasswordChecking ? "Overuji..." : "Potvrdit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
