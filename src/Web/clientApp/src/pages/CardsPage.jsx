import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../auth/session";
import "./PageLayout.css";
import "./CardsPage.css";

const TEMP_BLOCKED_STORAGE_KEY = "zxc_cards_temp_blocked";
const CARD_LIMITS_STORAGE_KEY = "zxc_cards_limits";

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

export default function CardsPage() {
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [isCardsLoading, setIsCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState("");

  const [balance, setBalance] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [notice, setNotice] = useState({ type: "", text: "" });

  const [tempBlockedIds, setTempBlockedIds] = useState(() => {
    const parsed = parseJsonStorage(TEMP_BLOCKED_STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter(Number.isFinite) : [];
  });

  const [cardLimits, setCardLimits] = useState(() => {
    const parsed = parseJsonStorage(CARD_LIMITS_STORAGE_KEY, {});
    return parsed && typeof parsed === "object" ? parsed : {};
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [createCardError, setCreateCardError] = useState("");

  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [limitError, setLimitError] = useState("");

  useEffect(() => {
    localStorage.setItem(TEMP_BLOCKED_STORAGE_KEY, JSON.stringify(tempBlockedIds));
  }, [tempBlockedIds]);

  useEffect(() => {
    localStorage.setItem(CARD_LIMITS_STORAGE_KEY, JSON.stringify(cardLimits));
  }, [cardLimits]);

  const cardsView = useMemo(() => {
    return cards.map((card) => {
      const id = Number(card.id);
      const isLocallyBlocked = tempBlockedIds.includes(id);
      const isActiveUi = Boolean(card.isActive) && !isLocallyBlocked;

      return {
        ...card,
        id,
        isLocallyBlocked,
        isActiveUi,
        statusLabel: !card.isActive ? "Blokovana bankou" : isLocallyBlocked ? "Docasne blokovana" : "Aktivni",
        cardTypeLabel: card.isVirtual ? "Visa Virtual" : "Visa Classic",
        limit: Number(cardLimits[id]) || null,
      };
    });
  }, [cards, tempBlockedIds, cardLimits]);

  const selectedCard = useMemo(() => {
    return cardsView.find((card) => card.id === selectedCardId) ?? null;
  }, [cardsView, selectedCardId]);

  const transactionRows = useMemo(() => {
    return transactions.slice(0, 8).map((transaction) => {
      const amount = Number(transaction.amount);
      const isIncome = transactionIsIncome(transaction.type);
      const absoluteAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;

      return {
        id: transaction.id,
        merchant: transaction.description?.trim() || transaction.counterpartyAccount || "Kartova transakce",
        date: formatDate(transaction.date),
        amount: `${isIncome ? "+" : "-"}${formatMoney(absoluteAmount)}`,
        isIncome,
      };
    });
  }, [transactions]);

  useEffect(() => {
    if (cardsView.length === 0) {
      setSelectedCardId(null);
      return;
    }

    if (!cardsView.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(cardsView[0].id);
    }
  }, [cardsView, selectedCardId]);

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

  const loadTransactions = async () => {
    setTransactionsError("");
    setIsTransactionsLoading(true);

    try {
      const response = await fetch("/api/Transaction/history", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Nepodarilo se nacist historii transakci.");
        setTransactionsError(message);
        setTransactions([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setTransactions(Array.isArray(payload) ? payload : []);
    } catch {
      setTransactionsError("Nepodarilo se nacist historii transakci.");
      setTransactions([]);
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  const loadAccountInfo = async () => {
    try {
      const response = await fetch("/api/Accounts/info", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setBalance(null);
        return;
      }

      const payload = await response.json().catch(() => null);
      const rawAccounts = pick(payload, "accounts", "Accounts");
      const list = Array.isArray(rawAccounts) ? rawAccounts : [];

      if (list.length === 0) {
        setBalance(null);
        return;
      }

      const total = list.reduce((sum, account) => {
        const value = Number(pick(account, "balance", "Balance"));
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);

      setBalance(Number.isFinite(total) ? total : null);
    } catch {
      setBalance(null);
    }
  };

  const reloadAll = async () => {
    await Promise.all([loadCards(), loadTransactions(), loadAccountInfo()]);
  };

  useEffect(() => {
    reloadAll();
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

    setCreateCardError("");
    setIsCreatingCard(true);

    try {
      const response = await fetch("/api/Cards/create", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
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
      setNotice({ type: "ok", text: "Nova karta byla uspesne vytvorena." });
      setIsCreateModalOpen(false);
      setCreateCardError("");
      setTermsAccepted(false);
      setPinCode("");
    } catch {
      setCreateCardError("Nepodarilo se vytvorit kartu.");
    } finally {
      setIsCreatingCard(false);
    }
  };

  const handleShowPin = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdrive vyberte kartu." });
      return;
    }

    setNotice({
      type: "info",
      text: "PIN nelze zobrazit. Banka ho uklada pouze jako hash z bezpecnostnich duvodu.",
    });
  };

  const handleToggleTemporaryBlock = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdrive vyberte kartu." });
      return;
    }

    if (!selectedCard.isActive && !selectedCard.isLocallyBlocked) {
      setNotice({ type: "error", text: "Tato karta je blokovana bankou a nelze ji zde odblokovat." });
      return;
    }

    setTempBlockedIds((previous) => {
      const exists = previous.includes(selectedCard.id);
      if (exists) {
        setNotice({ type: "ok", text: "Karta byla odblokovana pro online pouziti." });
        return previous.filter((id) => id !== selectedCard.id);
      }

      setNotice({ type: "warn", text: "Karta byla docasne blokovana na tomto zarizeni." });
      return [...previous, selectedCard.id];
    });
  };

  const openLimitModal = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdrive vyberte kartu." });
      return;
    }

    setLimitError("");
    setLimitInput(selectedCard.limit ? String(selectedCard.limit) : "");
    setIsLimitModalOpen(true);
  };

  const closeLimitModal = () => {
    setIsLimitModalOpen(false);
    setLimitError("");
    setLimitInput("");
  };

  const saveLimit = () => {
    if (!selectedCard) {
      setLimitError("Nejdrive vyberte kartu.");
      return;
    }

    const parsed = Number(limitInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLimitError("Zadejte kladnou castku limitu.");
      return;
    }

    if (parsed > 500000) {
      setLimitError("Maximalni limit je 500 000 Kc.");
      return;
    }

    setCardLimits((previous) => ({
      ...previous,
      [selectedCard.id]: Math.round(parsed),
    }));

    setNotice({ type: "ok", text: `Limit karty byl nastaven na ${formatMoney(parsed)}.` });
    closeLimitModal();
  };

  const handleAddToWallet = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdrive vyberte kartu." });
      return;
    }

    if (!selectedCard.isActiveUi) {
      setNotice({ type: "error", text: "Pro pridani do Apple/Google Pay musi byt karta aktivni." });
      return;
    }

    setNotice({ type: "ok", text: "Karta byla pripravena pro pridani do Apple/Google Pay." });
  };

  return (
    <div className="page cards-page">
      <div className="page__container">
        <h1 className="page__title">Karty</h1>
        <p className="page__subtitle">Sprava platebnich karet a jejich operaci.</p>

        <div className="page__grid">
          <section className="page__panel">
            <div className="cards-page__panelHead">
              <h2 className="page__panelTitle">Moje karty</h2>
              <button className="page__chip" type="button" onClick={openCreateCardModal}>
                Nova karta
              </button>
            </div>

            {isCardsLoading && <p className="cards-page__state">Nacitam karty...</p>}
            {!isCardsLoading && cardsError && <p className="cards-page__state cards-page__state--error">{cardsError}</p>}
            {!isCardsLoading && !cardsError && cardsView.length === 0 && (
              <p className="cards-page__state">Zatim nemate zadne karty.</p>
            )}

            {!isCardsLoading && !cardsError && cardsView.length > 0 && (
              <div className="page__cardsList">
                {cardsView.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`page__itemCard cards-page__itemCard ${selectedCard?.id === card.id ? "cards-page__itemCard--selected" : ""}`}
                    onClick={() => setSelectedCardId(card.id)}
                  >
                    <div className="page__itemTop">
                      <div>
                        <p className="page__itemTitle">{card.isVirtual ? "Virtualni karta" : "Hlavni karta"}</p>
                        <p className="page__itemSubtitle">
                          {card.cardTypeLabel} - {card.maskedNumber}
                        </p>
                      </div>
                      <span className={`page__badge ${card.isActiveUi ? "page__badge--ok" : "cards-page__badge--warn"}`}>
                        {card.statusLabel}
                      </span>
                    </div>

                    <div className="page__itemMeta">
                      <span>Dostupny zustatek: {formatMoney(balance)}</span>
                      <span>Platnost: {card.expiryDate}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Rychle akce</h2>
            <div className="page__actions">
              <button className="page__chip" type="button" onClick={openLimitModal}>
                Nastavit limity
              </button>
              <button className="page__chip" type="button" onClick={handleShowPin}>
                Zobrazit PIN
              </button>
              <button className="page__chip" type="button" onClick={handleToggleTemporaryBlock}>
                {selectedCard?.isActiveUi ? "Docasne blokovat kartu" : "Odblokovat kartu"}
              </button>
              <button className="page__chip" type="button" onClick={handleAddToWallet}>
                Pridat kartu do Apple/Google Pay
              </button>
              <button className="page__chip" type="button" onClick={reloadAll}>
                Obnovit data
              </button>
            </div>

            <p className="cards-page__selected">
              {selectedCard ? `Aktivni karta: ${selectedCard.maskedNumber}` : "Vyberte kartu pro akce."}
            </p>

            {selectedCard?.limit ? (
              <p className="cards-page__limit">Nastaveny lokalni limit: {formatMoney(selectedCard.limit)}</p>
            ) : (
              <p className="cards-page__limit">Lokalni limit zatim neni nastaven.</p>
            )}

            {notice.text && <p className={`cards-page__notice cards-page__notice--${notice.type || "info"}`}>{notice.text}</p>}
          </section>

          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Posledni transakce kartou</h2>

            {isTransactionsLoading && <p className="cards-page__state">Nacitam transakce...</p>}
            {!isTransactionsLoading && transactionsError && (
              <p className="cards-page__state cards-page__state--error">{transactionsError}</p>
            )}
            {!isTransactionsLoading && !transactionsError && transactionRows.length === 0 && (
              <p className="cards-page__state">Transakcni historie je zatim prazdna.</p>
            )}

            {!isTransactionsLoading && !transactionsError && transactionRows.length > 0 && (
              <div className="page__table">
                {transactionRows.map((transaction) => (
                  <div className="page__row" key={transaction.id}>
                    <span>{transaction.merchant}</span>
                    <span>{transaction.date}</span>
                    <span className={`page__amount ${transaction.isIncome ? "page__amount--in" : ""}`}>{transaction.amount}</span>
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

      {isCreateModalOpen && (
        <div className="cards-page__modalBackdrop" role="presentation" onClick={closeCreateCardModal}>
          <div
            className="cards-page__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cards-create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cards-create-title">Nova kreditni karta</h2>
            <p className="cards-page__modalIntro">Pred vytvorenim karty si prectete podminky:</p>

            <ul className="cards-page__terms">
              <li>Kartu lze pouzivat pouze v souladu s obchodnimi podminkami banky.</li>
              <li>Za bezpecnost plateb a prihlasovacich udaju odpovida drztel karty.</li>
              <li>Banka muze kartu zablokovat pri podezreni na podvod nebo zneuziti.</li>
            </ul>

            <label className="cards-page__checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>Souhlasim s podminkami vydani karty.</span>
            </label>

            <label className="cards-page__pin">
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

            {createCardError && <p className="cards-page__modalError">{createCardError}</p>}

            <div className="cards-page__modalActions">
              <button type="button" className="cards-page__modalButton cards-page__modalButton--ghost" onClick={closeCreateCardModal} disabled={isCreatingCard}>
                Zrusit
              </button>
              <button type="button" className="cards-page__modalButton cards-page__modalButton--primary" onClick={handleCreateCard} disabled={isCreatingCard || !termsAccepted}>
                {isCreatingCard ? "Vytvarim..." : "Potvrdit a vytvorit kartu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLimitModalOpen && (
        <div className="cards-page__modalBackdrop" role="presentation" onClick={closeLimitModal}>
          <div
            className="cards-page__modal cards-page__modal--small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cards-limit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cards-limit-title">Nastaveni limitu</h2>
            <p className="cards-page__modalIntro">
              {selectedCard ? `Karta ${selectedCard.maskedNumber}` : "Vyberte kartu"}
            </p>

            <label className="cards-page__pin">
              <span>Dennni limit v Kc</span>
              <input
                type="number"
                min={1}
                max={500000}
                step={100}
                value={limitInput}
                onChange={(event) => setLimitInput(event.target.value)}
                placeholder="Napriklad 50000"
              />
            </label>

            {limitError && <p className="cards-page__modalError">{limitError}</p>}

            <div className="cards-page__modalActions">
              <button type="button" className="cards-page__modalButton cards-page__modalButton--ghost" onClick={closeLimitModal}>
                Zrusit
              </button>
              <button type="button" className="cards-page__modalButton cards-page__modalButton--primary" onClick={saveLimit}>
                Ulozit limit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
