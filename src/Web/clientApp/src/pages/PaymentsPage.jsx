import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

function mapAccountForTransfer(rawItem) {
  const accountNumber = String(pick(rawItem, "accountNumber", "AccountNumber") || "").trim();
  const currency = String(pick(rawItem, "currency", "Currency") || "CZK");
  const isFrozen = Boolean(pick(rawItem, "isFrozen", "IsFrozen"));
  const balance = Number(pick(rawItem, "balance", "Balance"));

  return {
    id: String(pick(rawItem, "id", "Id") || accountNumber),
    accountNumber,
    currency,
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
  const [searchParams] = useSearchParams();
  const accountPickerRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  const [fromAccountNumber, setFromAccountNumber] = useState("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [transferMessage, setTransferMessage] = useState("");

  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isRecipientLoading, setIsRecipientLoading] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState(null);
  const [pendingTransfer, setPendingTransfer] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const accounts = useMemo(() => {
    const rawAccounts = extractAccountList(profile);
    if (!Array.isArray(rawAccounts)) {
      return [];
    }

    return rawAccounts.map(mapAccountForTransfer).filter((account) => Boolean(account.accountNumber));
  }, [profile]);

  const activeAccounts = useMemo(() => {
    return accounts.filter((account) => !account.isFrozen);
  }, [accounts]);

  const selectedFromAccount = useMemo(() => {
    return activeAccounts.find((account) => account.accountNumber === fromAccountNumber) || null;
  }, [activeAccounts, fromAccountNumber]);

  const selectedCurrencyName = selectedFromAccount?.currency || "CZK";
  const selectedCurrencyCode = currencyCodeFromName(selectedCurrencyName);
  const preferredFromAccount = String(searchParams.get("from") || "").trim();

  const dailyLimit = Number(pick(profile, "dailyTransferLimit", "DailyTransferLimit")) || 0;
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

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!accountPickerRef.current?.contains(event.target)) {
        setIsAccountPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (activeAccounts.length === 0) {
      setFromAccountNumber("");
      return;
    }

    if (preferredFromAccount && activeAccounts.some((account) => account.accountNumber === preferredFromAccount)) {
      if (fromAccountNumber !== preferredFromAccount) {
        setFromAccountNumber(preferredFromAccount);
      }
      return;
    }

    if (!activeAccounts.some((account) => account.accountNumber === fromAccountNumber)) {
      setFromAccountNumber(activeAccounts[0].accountNumber);
    }
  }, [activeAccounts, fromAccountNumber, preferredFromAccount]);

  useEffect(() => {
    if (!fromAccountNumber || !toAccountNumber) {
      return;
    }

    if (fromAccountNumber !== toAccountNumber) {
      return;
    }

    const fallbackReceiver =
      activeAccounts.find((account) => account.accountNumber !== fromAccountNumber)?.accountNumber || "";
    setToAccountNumber(fallbackReceiver);
  }, [fromAccountNumber, toAccountNumber, activeAccounts]);

  const setTemplate = (value) => {
    setAmount(String(value));
  };

  const validateTransferDraft = () => {
    setSubmitError("");
    setSubmitSuccess("");

    const normalizedFromAccount = fromAccountNumber.trim();
    const normalizedToAccount = toAccountNumber.trim();
    const numericAmount = Number(amount);
    const normalizedMessage = transferMessage.trim();

    const senderAccount = activeAccounts.find(
      (account) => account.accountNumber === normalizedFromAccount,
    );

    if (!/^\d{10,30}$/.test(normalizedFromAccount)) {
      setSubmitError("Vyberte platny ucet odesilatele.");
      return null;
    }

    if (!senderAccount) {
      setSubmitError("Vybrany ucet odesilatele neni dostupny.");
      return null;
    }

    if (!/^\d{10,30}$/.test(normalizedToAccount)) {
      setSubmitError("Zadejte platne cislo uctu prijemce.");
      return null;
    }

    if (normalizedFromAccount === normalizedToAccount) {
      setSubmitError("Nelze provest prevod na stejny ucet.");
      return null;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError("Castka musi byt kladne cislo.");
      return null;
    }

    if (numericAmount > senderAccount.balance) {
      setSubmitError("Nedostatek prostredku na vybranem uctu.");
      return null;
    }

    if (dailyLimit > 0 && numericAmount > dailyLimit) {
      setSubmitError(`Castka presahuje denni limit ${formatMoney(dailyLimit, selectedCurrencyName)}.`);
      return null;
    }

    if (normalizedMessage.length > 140) {
      setSubmitError("Zprava muze mit maximalne 140 znaku.");
      return null;
    }

    return {
      fromAccountNumber: normalizedFromAccount,
      toAccountNumber: normalizedToAccount,
      amount: numericAmount,
      message: normalizedMessage,
      senderCurrency: senderAccount.currency,
    };
  };

  const loadRecipientPreview = async (accountNumber) => {
    try {
      const response = await fetch(`/api/Transaction/recipient/${encodeURIComponent(accountNumber)}`, {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload === "object") {
          return payload;
        }
      }

      if (response.status === 404) {
        return {
          holderFirstName: "",
          holderLastName: "",
          holderFullName: "Drzitel uctu nebyl nalezen",
          accountNumber,
        };
      }

      const message = await readErrorMessage(response, "Nepodarilo se overit prijemce.");
      setConfirmError(message);
    } catch {
      setConfirmError("Nepodarilo se overit prijemce.");
    }

    return {
      holderFirstName: "",
      holderLastName: "",
      holderFullName: "Drzitel uctu nebyl nalezen",
      accountNumber,
    };
  };

  const handleOpenConfirm = async (event) => {
    event.preventDefault();

    const draft = validateTransferDraft();
    if (!draft) {
      return;
    }

    setPendingTransfer(draft);
    setRecipientPreview(null);
    setConfirmError("");
    setIsRecipientLoading(true);
    setIsConfirmModalOpen(true);

    const preview = await loadRecipientPreview(draft.toAccountNumber);
    setRecipientPreview(preview);
    setIsRecipientLoading(false);
  };

  const closeConfirmModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsConfirmModalOpen(false);
    setConfirmError("");
  };

  const handleConfirmTransfer = async () => {
    if (!pendingTransfer) {
      return;
    }

    setConfirmError("");
    setSubmitError("");
    setSubmitSuccess("");
    setIsSubmitting(true);

    const suggestedReceiver =
      activeAccounts.find((account) => account.accountNumber !== pendingTransfer.fromAccountNumber)?.accountNumber || "";

    try {
      const response = await fetch("/api/Transaction/transfer", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          fromAccountNumber: pendingTransfer.fromAccountNumber,
          toAccountNumber: pendingTransfer.toAccountNumber,
          amount: pendingTransfer.amount,
          message: pendingTransfer.message,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Prevod se nepodaril.");
        setConfirmError(message);
        return;
      }

      setSubmitSuccess("Prevod byl uspesne odeslan.");
      setToAccountNumber(suggestedReceiver);
      setAmount("");
      setTransferMessage("");
      setIsConfirmModalOpen(false);
      setPendingTransfer(null);
      setRecipientPreview(null);

      await loadProfile();
    } catch {
      setConfirmError("Prevod se nepodaril.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page payments-page">
      <div className="page__container">
        <h1 className="page__title">Platby</h1>
        <p className="page__subtitle">Rychly prevod penez s kontrolou udaju pred odeslanim.</p>

        <div className="page__grid">
          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Novy prevod</h2>

            <form className="payments-page__transferForm" onSubmit={handleOpenConfirm}>
              <div className="payments-page__field">
                <p className="payments-page__label">Z uctu</p>

                <div className="payments-page__accountPicker" ref={accountPickerRef}>
                  <div className="payments-page__accountBar">
                    <span className="payments-page__accountNumber">
                      {selectedFromAccount?.accountNumber || "Bez dostupneho uctu"}
                    </span>

                    <button
                      className="payments-page__balanceButton"
                      type="button"
                      onClick={() => setIsAccountPickerOpen((value) => !value)}
                      disabled={activeAccounts.length === 0}
                    >
                      <span>{formatMoney(selectedFromAccount?.balance ?? 0, selectedFromAccount?.currency || "CZK")}</span>
                      <span className="payments-page__currencyBadge">{selectedCurrencyCode}</span>
                      <span className="payments-page__balanceChevron">{isAccountPickerOpen ? "^" : "v"}</span>
                    </button>
                  </div>

                  {isAccountPickerOpen && (
                    <div className="payments-page__accountMenu">
                      {activeAccounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          className={`payments-page__accountOption ${
                            account.accountNumber === fromAccountNumber ? "is-selected" : ""
                          }`}
                          onClick={() => {
                            setFromAccountNumber(account.accountNumber);
                            setIsAccountPickerOpen(false);
                          }}
                        >
                          <span>{account.accountNumber}</span>
                          <span>
                            {formatMoney(account.balance, account.currency)}
                            <strong>{currencyCodeFromName(account.currency)}</strong>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="payments-page__field">
                <label className="payments-page__label" htmlFor="payments-to-account">
                  Na ucet
                </label>
                <input
                  id="payments-to-account"
                  type="text"
                  value={toAccountNumber}
                  onChange={(event) => setToAccountNumber(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Napriklad 40817123456789012345"
                  inputMode="numeric"
                />
              </div>

              <div className="payments-page__field">
                <label className="payments-page__label" htmlFor="payments-amount">
                  Zadejte castku
                </label>
                <div className="payments-page__amountWrap">
                  <input
                    id="payments-amount"
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="1000"
                  />
                  <span className="payments-page__amountCurrency">{selectedCurrencyCode}</span>
                </div>
              </div>

              <div className="payments-page__field">
                <label className="payments-page__label" htmlFor="payments-message">
                  Zprava pro prijemce (nepovinne)
                </label>
                <textarea
                  id="payments-message"
                  rows={3}
                  maxLength={140}
                  value={transferMessage}
                  onChange={(event) => setTransferMessage(event.target.value)}
                  placeholder="Napiste kratkou zpravu k prevodu"
                />
                <p className="payments-page__counter">{transferMessage.length}/140</p>
              </div>

              <button
                className="page__button payments-page__continue"
                type="submit"
                disabled={activeAccounts.length === 0 || isSubmitting}
              >
                Pokracovat
              </button>

              {submitError && <p className="payments-page__msg payments-page__msg--error">{submitError}</p>}
              {submitSuccess && <p className="payments-page__msg payments-page__msg--ok">{submitSuccess}</p>}
            </form>
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Limity a sablony</h2>

            {profileLoading && <p className="payments-page__hint">Nacitam limity...</p>}
            {!profileLoading && profileError && (
              <p className="payments-page__msg payments-page__msg--error">{profileError}</p>
            )}
            {!profileLoading && !profileError && (
              <div className="payments-page__limits">
                <p>
                  Denni limit prevodu: <strong>{formatMoney(dailyLimit, selectedCurrencyName)}</strong>
                </p>
                <p>
                  Limit internetovych plateb: <strong>{formatMoney(internetLimit, selectedCurrencyName)}</strong>
                </p>
              </div>
            )}

            <div className="page__actions">
              <button className="page__chip" type="button" onClick={() => setTemplate(500)}>
                Sablona {formatMoney(500, selectedCurrencyName)}
              </button>
              <button className="page__chip" type="button" onClick={() => setTemplate(1000)}>
                Sablona {formatMoney(1000, selectedCurrencyName)}
              </button>
              <button className="page__chip" type="button" onClick={() => setTemplate(5000)}>
                Sablona {formatMoney(5000, selectedCurrencyName)}
              </button>
            </div>

            <div className="payments-page__accounts">
              <p>Moje ucty:</p>
              {accounts.length === 0 && <span>Zatim bez dostupnych uctu.</span>}
              {accounts.map((account) => (
                <span key={account.id}>
                  {account.accountNumber} ({currencyCodeFromName(account.currency)}) - {formatMoney(account.balance, account.currency)}
                </span>
              ))}
            </div>
          </section>

        </div>

        <button className="page__button" onClick={() => navigate("/accounts")}>Zpet na ucty</button>
      </div>

      {isConfirmModalOpen && (
        <div className="payments-page__modalBackdrop" role="presentation" onClick={closeConfirmModal}>
          <div
            className="payments-page__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payments-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="payments-confirm-title">Zkontrolujte prevod</h2>

            <div className="payments-page__summary">
              <div className="payments-page__summaryRow">
                <span>Z uctu</span>
                <strong>{pendingTransfer?.fromAccountNumber || "--"}</strong>
              </div>

              <div className="payments-page__summaryRow">
                <span>Na ucet</span>
                <strong>{pendingTransfer?.toAccountNumber || "--"}</strong>
              </div>

              <div className="payments-page__recipient">
                {isRecipientLoading ? "Nacitam jmeno prijemce..." : recipientPreview?.holderFullName || "Drzitel uctu nebyl nalezen"}
              </div>

              <div className="payments-page__summaryRow">
                <span>Castka</span>
                <strong>{formatMoney(pendingTransfer?.amount || 0, pendingTransfer?.senderCurrency || "CZK")}</strong>
              </div>

              <div className="payments-page__summaryRow">
                <span>Mena</span>
                <strong>{currencyCodeFromName(pendingTransfer?.senderCurrency || "CZK")}</strong>
              </div>

              {pendingTransfer?.message && (
                <div className="payments-page__summaryRow payments-page__summaryRow--message">
                  <span>Zprava</span>
                  <strong>{pendingTransfer.message}</strong>
                </div>
              )}
            </div>

            {confirmError && <p className="payments-page__msg payments-page__msg--error">{confirmError}</p>}

            <div className="payments-page__modalActions">
              <button
                className="payments-page__modalButton payments-page__modalButton--ghost"
                type="button"
                onClick={closeConfirmModal}
                disabled={isSubmitting}
              >
                Zpet
              </button>
              <button
                className="payments-page__modalButton payments-page__modalButton--primary"
                type="button"
                onClick={handleConfirmTransfer}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Odesilam..." : "Odeslat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
