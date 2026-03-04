import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAccessToken,
  resolveUserDisplayNameByEmail,
  saveLocalCardPin,
} from "../auth/session";
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

export default function CardsPage() {
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [isCardsLoading, setIsCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState("");

  const [profileEmail, setProfileEmail] = useState("");
  const [balance, setBalance] = useState(null);
  const [accountOptions, setAccountOptions] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [notice, setNotice] = useState({ type: "", text: "" });

  const [tempBlockedIds, setTempBlockedIds] = useState(() => {
    const parsed = parseJsonStorage(TEMP_BLOCKED_STORAGE_KEY, []);
    return Array.isArray(parsed)
      ? parsed.map((id) => Number(id)).filter(Number.isFinite)
      : [];
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
    localStorage.setItem(
      TEMP_BLOCKED_STORAGE_KEY,
      JSON.stringify(tempBlockedIds),
    );
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
        holderLabel: resolveUserDisplayNameByEmail(
          profileEmail,
          card.holderName,
        ),
        statusLabel: !card.isActive
          ? "Blokována bankou"
          : isLocallyBlocked
            ? "Dočasně blokována"
            : "Aktivní",
        cardTypeLabel: card.isVirtual ? "Visa Virtual" : "Visa Classic",
        limit: Number(cardLimits[id]) || null,
      };
    });
  }, [cards, tempBlockedIds, cardLimits, profileEmail]);

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
        merchant:
          transaction.description?.trim() ||
          transaction.counterpartyAccount ||
          "Kartová transakce",
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
        const message = await readErrorMessage(
          response,
          "Nepodařilo se načíst karty.",
        );
        setCardsError(message);
        setCards([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setCards(Array.isArray(payload) ? payload : []);
    } catch {
      setCardsError("Nepodařilo se načíst karty.");
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
        const message = await readErrorMessage(
          response,
          "Nepodařilo se načíst historii transakcí.",
        );
        setTransactionsError(message);
        setTransactions([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setTransactions(Array.isArray(payload) ? payload : []);
    } catch {
      setTransactionsError("Nepodařilo se načíst historii transakcí.");
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
      const email = String(
        pick(payload, "email", "Email", "userName", "UserName") || "",
      ).trim();
      setProfileEmail(email);
      const rawAccounts = extractAccountList(payload);
      const list = Array.isArray(rawAccounts) ? rawAccounts : [];

      setAccountOptions(
        list.map((account) => ({
          accountNumber: String(
            pick(account, "accountNumber", "AccountNumber") || "",
          ),
          isFrozen: Boolean(pick(account, "isFrozen", "IsFrozen")),
          type: String(pick(account, "type", "Type") || ""),
        })),
      );

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
      setProfileEmail("");
      setAccountOptions([]);
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
      setCreateCardError("Nejdříve potvrďte podmínky.");
      return;
    }

    if (!/^\d{4}$/.test(pinCode)) {
      setCreateCardError("Zadejte 4místný PIN.");
      return;
    }

    const targetAccountNumber =
      accountOptions.find(
        (account) =>
          account.accountNumber &&
          !account.isFrozen &&
          String(account.type || "").toLowerCase() !== "investment",
      )?.accountNumber ||
      accountOptions.find(
        (account) => account.accountNumber && !account.isFrozen,
      )?.accountNumber ||
      accountOptions[0]?.accountNumber ||
      "";

    if (!targetAccountNumber) {
      setCreateCardError("Neexistuje dostupný účet pro vydání karty.");
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
        const message = await readErrorMessage(
          response,
          "Nepodařilo se vytvořit kartu.",
        );
        setCreateCardError(message);
        return;
      }

      const createdCardRaw = await response.text().catch(() => "");
      const createdCardId = Number(
        String(createdCardRaw).replace(/"/g, "").trim(),
      );
      if (Number.isFinite(createdCardId) && createdCardId > 0) {
        saveLocalCardPin(createdCardId, pinCode);
      }

      await loadCards();
      setNotice({ type: "ok", text: "Nová karta byla úspěšně vytvořena." });
      setIsCreateModalOpen(false);
      setCreateCardError("");
      setTermsAccepted(false);
      setPinCode("");
    } catch {
      setCreateCardError("Nepodařilo se vytvořit kartu.");
    } finally {
      setIsCreatingCard(false);
    }
  };

  const handleShowPin = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdříve vyberte kartu." });
      return;
    }

    setNotice({
      type: "info",
      text: "PIN nelze zobrazit. Banka ho ukládá pouze jako hash z bezpečnostních důvodů.",
    });
  };

  const handleToggleTemporaryBlock = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdříve vyberte kartu." });
      return;
    }

    if (!selectedCard.isActive && !selectedCard.isLocallyBlocked) {
      setNotice({
        type: "error",
        text: "Tato karta je blokována bankou a nelze ji zde odblokovat.",
      });
      return;
    }

    setTempBlockedIds((previous) => {
      const exists = previous.includes(selectedCard.id);
      if (exists) {
        setNotice({
          type: "ok",
          text: "Karta byla odblokována pro online použití.",
        });
        return previous.filter((id) => id !== selectedCard.id);
      }

      setNotice({
        type: "warn",
        text: "Karta byla dočasně blokována na tomto zařízení.",
      });
      return [...previous, selectedCard.id];
    });
  };

  const openLimitModal = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdříve vyberte kartu." });
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
      setLimitError("Nejdříve vyberte kartu.");
      return;
    }

    const parsed = Number(limitInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLimitError("Zadejte kladnou částku limitu.");
      return;
    }

    if (parsed > 500000) {
      setLimitError("Maximální limit je 500 000 Kč.");
      return;
    }

    setCardLimits((previous) => ({
      ...previous,
      [selectedCard.id]: Math.round(parsed),
    }));

    setNotice({
      type: "ok",
      text: `Limit karty byl nastaven na ${formatMoney(parsed)}.`,
    });
    closeLimitModal();
  };

  const handleAddToWallet = () => {
    if (!selectedCard) {
      setNotice({ type: "error", text: "Nejdříve vyberte kartu." });
      return;
    }

    if (!selectedCard.isActiveUi) {
      setNotice({
        type: "error",
        text: "Pro přidání do Apple/Google Pay musí být karta aktivní.",
      });
      return;
    }

    setNotice({
      type: "ok",
      text: "Karta byla připravena pro přidání do Apple/Google Pay.",
    });
  };

  return (
    <div className="page cards-page">
      <div className="page__container">
        <h1 className="page__title">Karty</h1>
        <p className="page__subtitle">
          Správa platebních karet a jejich operací.
        </p>

        <div className="page__grid">
          <section className="page__panel">
            <div className="cards-page__panelHead">
              <h2 className="page__panelTitle">Moje karty</h2>
              <button
                className="page__chip"
                type="button"
                onClick={openCreateCardModal}
              >
                Nová karta
              </button>
            </div>

            {isCardsLoading && (
              <p className="cards-page__state">Načítám karty...</p>
            )}
            {!isCardsLoading && cardsError && (
              <p className="cards-page__state cards-page__state--error">
                {cardsError}
              </p>
            )}
            {!isCardsLoading && !cardsError && cardsView.length === 0 && (
              <p className="cards-page__state">Zatím nemáte žádné karty.</p>
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
                        <p className="page__itemTitle">
                          {card.isVirtual ? "Virtuální karta" : "Hlavní karta"}
                        </p>
                        <p className="page__itemSubtitle">
                          {card.cardTypeLabel} - {card.maskedNumber}
                        </p>
                      </div>
                      <span
                        className={`page__badge ${card.isActiveUi ? "page__badge--ok" : "cards-page__badge--warn"}`}
                      >
                        {card.statusLabel}
                      </span>
                    </div>

                    <div className="page__itemMeta">
                      <span>Držitel: {card.holderLabel}</span>
                      <span>Dostupný zůstatek: {formatMoney(balance)}</span>
                      <span>Platnost: {card.expiryDate}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Rychlé akce</h2>
            <div className="page__actions">
              <button
                className="page__chip"
                type="button"
                onClick={openLimitModal}
              >
                Nastavit limity
              </button>
              <button
                className="page__chip"
                type="button"
                onClick={handleShowPin}
              >
                Zobrazit PIN
              </button>
              <button
                className="page__chip"
                type="button"
                onClick={handleToggleTemporaryBlock}
              >
                {selectedCard?.isActiveUi
                  ? "Dočasně blokovat kartu"
                  : "Odblokovat kartu"}
              </button>
              <button
                className="page__chip"
                type="button"
                onClick={handleAddToWallet}
              >
                Přidat kartu do Apple/Google Pay
              </button>
              <button className="page__chip" type="button" onClick={reloadAll}>
                Obnovit data
              </button>
            </div>

            <p className="cards-page__selected">
              {selectedCard
                ? `Aktivní karta: ${selectedCard.maskedNumber}`
                : "Vyberte kartu pro akce."}
            </p>

            {selectedCard?.limit ? (
              <p className="cards-page__limit">
                Nastavený lokální limit: {formatMoney(selectedCard.limit)}
              </p>
            ) : (
              <p className="cards-page__limit">
                Lokální limit zatím není nastaven.
              </p>
            )}

            {notice.text && (
              <p
                className={`cards-page__notice cards-page__notice--${notice.type || "info"}`}
              >
                {notice.text}
              </p>
            )}
          </section>

          <section className="page__panel page__panel--full">
            <div className="cards-page__panelHead">
              <h2 className="page__panelTitle">Poslední transakce kartou</h2>
              <button
                className="page__chip"
                type="button"
                onClick={loadTransactions}
                disabled={isTransactionsLoading}
              >
                Obnovit historii
              </button>
            </div>

            {isTransactionsLoading && (
              <p className="cards-page__state">Načítám transakce...</p>
            )}
            {!isTransactionsLoading && transactionsError && (
              <p className="cards-page__state cards-page__state--error">
                {transactionsError}
              </p>
            )}
            {!isTransactionsLoading &&
              !transactionsError &&
              transactionRows.length === 0 && (
                <p className="cards-page__state">
                  Transakční historie je zatím prázdná.
                </p>
              )}

            {!isTransactionsLoading &&
              !transactionsError &&
              transactionRows.length > 0 && (
                <div className="page__table">
                  {transactionRows.map((transaction) => (
                    <div className="page__row" key={transaction.id}>
                      <span>{transaction.merchant}</span>
                      <span>{transaction.date}</span>
                      <span
                        className={`page__amount ${transaction.isIncome ? "page__amount--in" : ""}`}
                      >
                        {transaction.amount}
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

      {isCreateModalOpen && (
        <div
          className="cards-page__modalBackdrop"
          role="presentation"
          onClick={closeCreateCardModal}
        >
          <div
            className="cards-page__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cards-create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cards-create-title">Nová kreditní karta</h2>
            <p className="cards-page__modalIntro">
              Před vytvořením karty si přečtěte podmínky:
            </p>

            <ul className="cards-page__terms">
              <li>
                Kartu lze používat pouze v souladu s obchodními podmínkami
                banky.
              </li>
              <li>
                Za bezpečnost plateb a přihlašovacích údajů odpovídá držitel
                karty.
              </li>
              <li>
                Banka může kartu zablokovat při podezření na podvod nebo
                zneužití.
              </li>
            </ul>

            <label className="cards-page__checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>Souhlasím s podmínkami vydání karty.</span>
            </label>

            <label className="cards-page__pin">
              <span>PIN karty (4 čísla)</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinCode}
                onChange={(event) =>
                  setPinCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="0000"
              />
            </label>

            {createCardError && (
              <p className="cards-page__modalError">{createCardError}</p>
            )}

            <div className="cards-page__modalActions">
              <button
                type="button"
                className="cards-page__modalButton cards-page__modalButton--ghost"
                onClick={closeCreateCardModal}
                disabled={isCreatingCard}
              >
                Zrušit
              </button>
              <button
                type="button"
                className="cards-page__modalButton cards-page__modalButton--primary"
                onClick={handleCreateCard}
                disabled={isCreatingCard || !termsAccepted}
              >
                {isCreatingCard ? "Vytvářím..." : "Potvrdit a vytvořit kartu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLimitModalOpen && (
        <div
          className="cards-page__modalBackdrop"
          role="presentation"
          onClick={closeLimitModal}
        >
          <div
            className="cards-page__modal cards-page__modal--small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cards-limit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cards-limit-title">Nastavení limitu</h2>
            <p className="cards-page__modalIntro">
              {selectedCard
                ? `Karta ${selectedCard.maskedNumber}`
                : "Vyberte kartu"}
            </p>

            <label className="cards-page__pin">
              <span>Denní limit v Kč</span>
              <input
                type="number"
                min={1}
                max={500000}
                step={100}
                value={limitInput}
                onChange={(event) => setLimitInput(event.target.value)}
                placeholder="Například, 50000"
              />
            </label>

            {limitError && (
              <p className="cards-page__modalError">{limitError}</p>
            )}

            <div className="cards-page__modalActions">
              <button
                type="button"
                className="cards-page__modalButton cards-page__modalButton--ghost"
                onClick={closeLimitModal}
              >
                Zrušit
              </button>
              <button
                type="button"
                className="cards-page__modalButton cards-page__modalButton--primary"
                onClick={saveLimit}
              >
                Uložit limit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
