import { useEffect, useMemo, useState } from "react";
import { getAccessToken, resolveUserDisplayNameByEmail } from "../auth/session";
import "./AccountsPage.css";

const quickActions = [
  { id: "phone", title: "Platba na telefon", icon: "T" },
  { id: "iban", title: "Platba na ucet", icon: "U" },
  { id: "mobile", title: "Dobit kredit", icon: "M" },
  { id: "scan", title: "Naskenovat slozenku", icon: "S" },
];

const cashbackCards = [
  {
    id: "food",
    title: "Program stravovani Premium",
    subtitle: "Cashback az 8 %",
    theme: "violet",
  },
  {
    id: "shop",
    title: "Potraviny a drogerie",
    subtitle: "Cashback 45 %",
    theme: "green",
  },
];

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

function formatMoney(value, currencyName) {
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

function mapAccountForView(rawItem) {
  const id = Number(pick(rawItem, "id", "Id")) || Math.random();
  const accountNumber = String(pick(rawItem, "accountNumber", "AccountNumber") || "");
  const balance = Number(pick(rawItem, "balance", "Balance")) || 0;
  const currency = String(pick(rawItem, "currency", "Currency") || "Koruna");
  const type = String(pick(rawItem, "type", "Type") || "Debet");
  const isFrozen = Boolean(pick(rawItem, "isFrozen", "IsFrozen"));

  const normalizedCurrency = currency.toLowerCase();
  const symbol = normalizedCurrency.includes("euro")
    ? "EUR"
    : normalizedCurrency.includes("dollar")
      ? "USD"
      : "Kc";

  const label =
    type.toLowerCase() === "investment"
      ? "Investicni ucet"
      : normalizedCurrency.includes("euro")
        ? "Ucet v EUR"
        : normalizedCurrency.includes("dollar")
          ? "Ucet v USD"
          : "Bezny ucet";

  const suffix = accountNumber ? accountNumber.slice(-4) : "";

  return {
    id,
    accountNumber,
    type,
    symbol,
    label,
    balanceText: formatMoney(balance, currency),
    chip: suffix ? `...${suffix}` : "",
    isFrozen,
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
    if (first && typeof first === "object" && ("accountNumber" in first || "AccountNumber" in first)) {
      return value;
    }
  }

  return [];
}

export default function AccountsPage() {
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [cards, setCards] = useState([]);
  const [isCardsLoading, setIsCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [createCardError, setCreateCardError] = useState("");

  const profileEmail = useMemo(() => {
    if (!profile) {
      return "";
    }

    return String(pick(profile, "email", "Email", "userName", "UserName") || "").trim();
  }, [profile]);

  const fullName = useMemo(() => {
    if (!profile) {
      return "";
    }

    const fallbackLabel = String(pick(profile, "fullName", "FullName", "email", "Email") || "").trim();
    return resolveUserDisplayNameByEmail(profileEmail, fallbackLabel);
  }, [profile, profileEmail]);

  const transferLimit = Number(pick(profile, "dailyTransferLimit", "DailyTransferLimit")) || 0;
  const internetLimit = Number(pick(profile, "internetPaymentLimit", "InternetPaymentLimit")) || 0;

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
        const message = await readErrorMessage(response, "Nepodarilo se nacist profil uctu.");
        setProfileError(message);
        setProfile(null);
        setAccounts([]);
        return;
      }

      const payload = await response.json().catch(() => null);
      const rawAccounts = extractAccountList(payload);
      const mappedAccounts = Array.isArray(rawAccounts) ? rawAccounts.map(mapAccountForView) : [];

      setProfile(payload);
      setAccounts(mappedAccounts);
    } catch {
      setProfileError("Nepodarilo se nacist profil uctu.");
      setProfile(null);
      setAccounts([]);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadCards = async () => {
    setCardsError("");
    setIsCardsLoading(true);

    try {
      const response = await fetch("/api/Cards/list", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Nepodarilo se nacist karty.");
        setCardsError(message);
        setCards([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setCards(Array.isArray(payload) ? payload : []);
    } catch {
      setCardsError("Nepodarilo se nacist karty.");
      setCards([]);
    } finally {
      setIsCardsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadCards();
  }, []);

  const openCreateCardModal = () => {
    setCreateCardError("");
    setTermsAccepted(false);
    setPinCode("");
    setIsCreateModalOpen(true);
  };

  const closeCreateCardModal = () => {
    if (isCreatingCard) {
      return;
    }

    setIsCreateModalOpen(false);
    setCreateCardError("");
    setTermsAccepted(false);
    setPinCode("");
  };

  const handleCreateCard = async () => {
    if (!termsAccepted) {
      setCreateCardError("Nejdrive potvrdte podminky.");
      return;
    }

    if (!/^\d{4}$/.test(pinCode)) {
      setCreateCardError("Zadejte 4mistny PIN.");
      return;
    }

    const targetAccountNumber =
      accounts.find((account) => !account.isFrozen && String(account.type || "").toLowerCase() !== "investment")
        ?.accountNumber ||
      accounts.find((account) => !account.isFrozen)?.accountNumber ||
      accounts[0]?.accountNumber ||
      "";

    if (!targetAccountNumber) {
      setCreateCardError("Neexistuje dostupny ucet pro vydani karty.");
      return;
    }

    setCreateCardError("");
    setIsCreatingCard(true);

    try {
      const response = await fetch("/api/Cards/create", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          accountNumber: targetAccountNumber,
          pinCode,
          isVirtual: false,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Nepodarilo se vytvorit kartu.");
        setCreateCardError(message);
        return;
      }

      await loadCards();
      setIsCreateModalOpen(false);
      setTermsAccepted(false);
      setPinCode("");
    } catch {
      setCreateCardError("Nepodarilo se vytvorit kartu.");
    } finally {
      setIsCreatingCard(false);
    }
  };

  return (
    <section className="accounts-page">
      <div className="accounts-shell">
        <aside className="accounts-sidebar">
          <h1 className="accounts-title">{fullName ? `Dobry den, ${fullName}` : "Dobry den"}</h1>

          {profileLoading && <p className="cards-state">Nacitam ucty...</p>}
          {!profileLoading && profileError && <p className="cards-state cards-state--error">{profileError}</p>}
          {!profileLoading && !profileError && accounts.length === 0 && (
            <p className="cards-state">K tomuto profilu zatim nejsou dostupne zadne ucty.</p>
          )}

          {!profileLoading && !profileError && accounts.length > 0 && (
            <div className="accounts-list">
              {accounts.map((item) => (
                <article className={`account-card ${item.isFrozen ? "account-card--frozen" : ""}`} key={item.id}>
                  <div className="account-card__icon">{item.symbol}</div>
                  <div className="account-card__content">
                    <p className="account-card__balance">{item.balanceText}</p>
                    <p className="account-card__label">{item.label}</p>
                    {item.chip && <p className="account-card__chip">{item.chip}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}

          <button className="credit-offer" type="button" onClick={openCreateCardModal}>
            <p className="credit-offer__title">Mate predschvalenou kreditni kartu</p>
            <p className="credit-offer__text">Dokoncete zadost behem par kliknuti.</p>
          </button>

          <section className="cards-section">
            <div className="cards-section__head">
              <h3>Moje karty</h3>
              <button type="button" onClick={loadCards} disabled={isCardsLoading}>
                Obnovit
              </button>
            </div>

            {isCardsLoading && <p className="cards-state">Nacitam karty...</p>}
            {!isCardsLoading && cardsError && <p className="cards-state cards-state--error">{cardsError}</p>}
            {!isCardsLoading && !cardsError && cards.length === 0 && (
              <p className="cards-state">Zatim nemate zadne karty.</p>
            )}

            {!isCardsLoading && !cardsError && cards.length > 0 && (
              <div className="accounts-list">
                {cards.map((card) => (
                  <article className="account-card account-card--compact" key={card.id}>
                    <div className="account-card__icon">{card.isVirtual ? "V" : "K"}</div>
                    <div className="account-card__content">
                      <p className="account-card__balance">Karta {card.maskedNumber}</p>
                      <p className="account-card__label">
                        {resolveUserDisplayNameByEmail(profileEmail, card.holderName)}
                      </p>
                      <p className="account-card__chip">
                        {card.isVirtual ? "Virtualni" : "Plastova"} - exp {card.expiryDate}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>

        <main className="accounts-main">
          <label className="search-box">
            <span className="search-box__icon">Q</span>
            <input type="text" placeholder="Hledat" />
          </label>

          <section className="quick-actions">
            {quickActions.map((action) => (
              <button className="quick-action" type="button" key={action.id}>
                <span className="quick-action__icon">{action.icon}</span>
                <span className="quick-action__text">{action.title}</span>
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Cashback a odmeny</h2>
              <a href="/">Vsechny nabidky</a>
            </div>

            <div className="cashback-grid">
              {cashbackCards.map((item) => (
                <article className={`cashback-card cashback-card--${item.theme}`} key={item.id}>
                  <p className="cashback-card__title">{item.title}</p>
                  <p className="cashback-card__subtitle">{item.subtitle}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel operations">
            <div className="panel__head">
              <h2>
                Limity a prehled <span>{">"}</span>
              </h2>
            </div>

            <div className="operations__metrics">
              <article className="operations__metric">
                <p>Dennni limit prevodu</p>
                <strong>{formatMoney(transferLimit, "Koruna")}</strong>
              </article>
              <article className="operations__metric">
                <p>Limit internetovych plateb</p>
                <strong>{formatMoney(internetLimit, "Koruna")}</strong>
              </article>
              <article className="operations__metric">
                <p>Pocet uctu</p>
                <strong>{accounts.length}</strong>
              </article>
            </div>
          </section>
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="card-modal-backdrop" role="presentation" onClick={closeCreateCardModal}>
          <div
            className="card-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-card-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="new-card-title">Nova kreditni karta</h2>
            <p className="card-modal__intro">Pred vytvorenim karty si prectete podminky:</p>

            <ul className="card-modal__terms">
              <li>Kartu lze pouzivat pouze v souladu s obchodnimi podminkami banky.</li>
              <li>Za bezpecnost plateb a prihlasovacich udaju odpovida drztel karty.</li>
              <li>Banka muze kartu zablokovat pri podezreni na podvod nebo zneuziti.</li>
            </ul>

            <label className="card-modal__checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>Souhlasim s podminkami vydani karty.</span>
            </label>

            <label className="card-modal__pin">
              <span>PIN karty (4 cisla)</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinCode}
                onChange={(event) => setPinCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="0000"
              />
            </label>

            {createCardError && <p className="card-modal__error">{createCardError}</p>}

            <div className="card-modal__actions">
              <button
                className="card-modal__button card-modal__button--ghost"
                type="button"
                onClick={closeCreateCardModal}
                disabled={isCreatingCard}
              >
                Zrusit
              </button>
              <button
                className="card-modal__button card-modal__button--primary"
                type="button"
                onClick={handleCreateCard}
                disabled={isCreatingCard || !termsAccepted}
              >
                {isCreatingCard ? "Vytvarim..." : "Potvrdit a vytvorit kartu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
