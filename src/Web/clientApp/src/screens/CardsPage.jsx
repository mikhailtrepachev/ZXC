"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Eye, Lock, Plus, RefreshCcw, ShieldCheck, Wallet } from "lucide-react";
import { resolveUserDisplayNameByEmail, saveLocalCardPin } from "../auth/session";
import { useNavigate } from "../routing";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState, PageScaffold, StateMessage } from "../components/PageScaffold";
import {
  extractAccountList,
  formatDate,
  formatMoney,
  getAuthHeaders,
  parseJsonStorage,
  pick,
  readErrorMessage,
  transactionIsIncome,
  writeJsonStorage,
} from "../lib/bank";

const TEMP_BLOCKED_STORAGE_KEY = "zxc_cards_temp_blocked";
const CARD_LIMITS_STORAGE_KEY = "zxc_cards_limits";

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
    writeJsonStorage(TEMP_BLOCKED_STORAGE_KEY, tempBlockedIds);
  }, [tempBlockedIds]);

  useEffect(() => {
    writeJsonStorage(CARD_LIMITS_STORAGE_KEY, cardLimits);
  }, [cardLimits]);

  const cardsView = useMemo(
    () =>
      cards.map((card) => {
        const id = Number(card.id);
        const isLocallyBlocked = tempBlockedIds.includes(id);
        const isActiveUi = Boolean(card.isActive) && !isLocallyBlocked;

        return {
          ...card,
          id,
          isLocallyBlocked,
          isActiveUi,
          holderLabel: resolveUserDisplayNameByEmail(profileEmail, card.holderName),
          statusLabel: !card.isActive ? "Blocked by bank" : isLocallyBlocked ? "Temporarily blocked" : "Active",
          cardTypeLabel: card.isVirtual ? "Visa Virtual" : "Visa Classic",
          limit: Number(cardLimits[id]) || null,
        };
      }),
    [cards, tempBlockedIds, cardLimits, profileEmail],
  );

  const selectedCard = useMemo(() => cardsView.find((card) => card.id === selectedCardId) ?? null, [cardsView, selectedCardId]);

  const transactionRows = useMemo(
    () =>
      transactions.slice(0, 8).map((transaction) => {
        const amount = Number(pick(transaction, "amount", "Amount"));
        const isIncome = transactionIsIncome(pick(transaction, "type", "Type"));
        const absoluteAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;

        return {
          id: pick(transaction, "id", "Id"),
          merchant: pick(transaction, "description", "Description") || pick(transaction, "counterpartyAccount", "CounterpartyAccount") || "Card transaction",
          date: formatDate(pick(transaction, "date", "Date")),
          amount: `${isIncome ? "+" : "-"}${formatMoney(absoluteAmount)}`,
          isIncome,
        };
      }),
    [transactions],
  );

  useEffect(() => {
    if (cardsView.length === 0) {
      setSelectedCardId(null);
      return;
    }

    if (!cardsView.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(cardsView[0].id);
    }
  }, [cardsView, selectedCardId]);

  const loadCards = useCallback(async () => {
    setCardsError("");
    setIsCardsLoading(true);

    try {
      const response = await fetch("/api/Cards/list", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setCardsError(await readErrorMessage(response, "Could not load cards."));
        setCards([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setCards(Array.isArray(payload) ? payload : []);
    } catch {
      setCardsError("Could not load cards.");
      setCards([]);
    } finally {
      setIsCardsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTransactionsError("");
    setIsTransactionsLoading(true);

    try {
      const response = await fetch("/api/Transaction/history", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setTransactionsError(await readErrorMessage(response, "Could not load transactions."));
        setTransactions([]);
        return;
      }

      const payload = await response.json().catch(() => []);
      setTransactions(Array.isArray(payload) ? payload : []);
    } catch {
      setTransactionsError("Could not load transactions.");
      setTransactions([]);
    } finally {
      setIsTransactionsLoading(false);
    }
  }, []);

  const loadAccountInfo = useCallback(async () => {
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
      const email = String(pick(payload, "email", "Email", "userName", "UserName") || "").trim();
      setProfileEmail(email);
      const list = extractAccountList(payload);
      setAccountOptions(
        list.map((account) => ({
          accountNumber: String(pick(account, "accountNumber", "AccountNumber") || ""),
          isFrozen: Boolean(pick(account, "isFrozen", "IsFrozen")),
          type: String(pick(account, "type", "Type") || ""),
          balance: Number(pick(account, "balance", "Balance")) || 0,
        })),
      );

      setBalance(list.reduce((sum, account) => sum + (Number(pick(account, "balance", "Balance")) || 0), 0));
    } catch {
      setProfileEmail("");
      setAccountOptions([]);
      setBalance(null);
    }
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadCards(), loadTransactions(), loadAccountInfo()]);
  }, [loadCards, loadTransactions, loadAccountInfo]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const handleCreateCard = async () => {
    if (!termsAccepted) {
      setCreateCardError("Accept the card terms first.");
      return;
    }

    if (!/^\d{4}$/.test(pinCode)) {
      setCreateCardError("Enter a 4-digit PIN.");
      return;
    }

    const targetAccountNumber =
      accountOptions.find((account) => account.accountNumber && !account.isFrozen && String(account.type || "").toLowerCase() !== "investment")?.accountNumber ||
      accountOptions.find((account) => account.accountNumber && !account.isFrozen)?.accountNumber ||
      accountOptions[0]?.accountNumber ||
      "";

    if (!targetAccountNumber) {
      setCreateCardError("There is no available account for card issuing.");
      return;
    }

    setCreateCardError("");
    setIsCreatingCard(true);

    try {
      const response = await fetch("/api/Cards/create", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ accountNumber: targetAccountNumber, pinCode, isVirtual: false }),
      });

      if (!response.ok) {
        setCreateCardError(await readErrorMessage(response, "Could not create card."));
        return;
      }

      const createdCardRaw = await response.text().catch(() => "");
      const createdCardId = Number(String(createdCardRaw).replace(/"/g, "").trim());
      if (Number.isFinite(createdCardId) && createdCardId > 0) {
        saveLocalCardPin(createdCardId, pinCode);
      }

      await loadCards();
      setNotice({ type: "success", text: "New card was created." });
      setIsCreateModalOpen(false);
      setTermsAccepted(false);
      setPinCode("");
    } catch {
      setCreateCardError("Could not create card.");
    } finally {
      setIsCreatingCard(false);
    }
  };

  const handleShowPin = () => {
    setNotice({
      type: "warning",
      text: selectedCard ? "PIN is hidden by design. Open card detail for secure verification." : "Select a card first.",
    });
  };

  const handleToggleTemporaryBlock = () => {
    if (!selectedCard) {
      setNotice({ type: "warning", text: "Select a card first." });
      return;
    }

    if (!selectedCard.isActive && !selectedCard.isLocallyBlocked) {
      setNotice({ type: "error", text: "This card is blocked by the bank." });
      return;
    }

    setTempBlockedIds((previous) => {
      const exists = previous.includes(selectedCard.id);
      setNotice({
        type: "success",
        text: exists ? "Card was locally unblocked." : "Card was temporarily blocked on this device.",
      });
      return exists ? previous.filter((id) => id !== selectedCard.id) : [...previous, selectedCard.id];
    });
  };

  const openLimitModal = () => {
    if (!selectedCard) {
      setNotice({ type: "warning", text: "Select a card first." });
      return;
    }

    setLimitError("");
    setLimitInput(selectedCard.limit ? String(selectedCard.limit) : "");
    setIsLimitModalOpen(true);
  };

  const saveLimit = () => {
    if (!selectedCard) {
      setLimitError("Select a card first.");
      return;
    }

    const parsed = Number(limitInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLimitError("Enter a positive limit.");
      return;
    }

    if (parsed > 500000) {
      setLimitError("Maximum limit is 500 000 Kc.");
      return;
    }

    setCardLimits((previous) => ({ ...previous, [selectedCard.id]: Math.round(parsed) }));
    setNotice({ type: "success", text: `Card limit was set to ${formatMoney(parsed)}.` });
    setIsLimitModalOpen(false);
  };

  return (
    <PageScaffold
      title="Cards"
      description="Manage bank cards, local limits, temporary blocking, and recent card activity."
      actions={
        <>
          <Button variant="outline" onClick={reloadAll}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="size-4" />
            New card
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total balance</CardDescription>
            <CardTitle>{formatMoney(balance)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cards</CardDescription>
            <CardTitle>{cardsView.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Selected card</CardDescription>
            <CardTitle className="truncate">{selectedCard?.maskedNumber || "--"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {notice.text && <StateMessage type={notice.type}>{notice.text}</StateMessage>}
      {cardsError && <StateMessage type="error">{cardsError}</StateMessage>}
      {transactionsError && <StateMessage type="error">{transactionsError}</StateMessage>}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>My cards</CardTitle>
            <CardDescription>Select a card to manage local actions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {isCardsLoading && <p className="text-sm text-muted-foreground">Loading cards...</p>}
            {!isCardsLoading && !cardsError && cardsView.length === 0 && (
              <EmptyState title="No cards" description="Create a card for one of your accounts." action={<Button onClick={() => setIsCreateModalOpen(true)}>Create card</Button>} />
            )}
            {cardsView.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`rounded-lg border p-4 text-left transition-colors ${selectedCard?.id === card.id ? "border-primary bg-primary/5" : "bg-background hover:bg-accent"}`}
                onClick={() => setSelectedCardId(card.id)}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{card.isVirtual ? "Virtual card" : "Main card"}</p>
                    <p className="text-sm text-muted-foreground">{card.cardTypeLabel} - {card.maskedNumber}</p>
                  </div>
                  <Badge variant={card.isActiveUi ? "secondary" : "destructive"}>{card.statusLabel}</Badge>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <span>Holder: {card.holderLabel || "--"}</span>
                  <span>Available balance: {formatMoney(balance)}</span>
                  <span>Expires: {card.expiryDate || "--"}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>{selectedCard ? `Active card: ${selectedCard.maskedNumber}` : "Select a card for actions."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" onClick={openLimitModal}>
              <ShieldCheck className="size-4" />
              Set local limit
            </Button>
            <Button variant="outline" onClick={handleShowPin}>
              <Eye className="size-4" />
              Show PIN safely
            </Button>
            <Button variant="outline" onClick={handleToggleTemporaryBlock}>
              <Lock className="size-4" />
              {selectedCard?.isActiveUi ? "Temporarily block" : "Unblock locally"}
            </Button>
            <Button variant="outline" onClick={() => setNotice({ type: "success", text: "Card is ready for Apple/Google Pay." })}>
              <Wallet className="size-4" />
              Add to wallet
            </Button>
            <Button onClick={() => selectedCard && navigate(`/cards/${selectedCard.id}`)} disabled={!selectedCard}>
              <CreditCard className="size-4" />
              Open details
            </Button>
            <p className="text-sm text-muted-foreground">
              Local limit: {selectedCard?.limit ? formatMoney(selectedCard.limit) : "not set"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent card activity</CardTitle>
          <CardDescription>Latest transaction records from the backend.</CardDescription>
        </CardHeader>
        <CardContent>
          {isTransactionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading transactions...</p>
          ) : transactionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionRows.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.merchant}</TableCell>
                    <TableCell>{transaction.date}</TableCell>
                    <TableCell className={transaction.isIncome ? "text-right font-medium text-emerald-600" : "text-right font-medium"}>
                      {transaction.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateModalOpen} onOpenChange={(open) => !isCreatingCard && setIsCreateModalOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New credit card</DialogTitle>
            <DialogDescription>Issue a card to an available account and store the local PIN hint.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={termsAccepted} onCheckedChange={(value) => setTermsAccepted(Boolean(value))} />
              <span>I accept the card issuing terms.</span>
            </label>
            <div className="grid gap-2">
              <Label htmlFor="new-card-pin">PIN</Label>
              <Input
                id="new-card-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinCode}
                onChange={(event) => setPinCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="0000"
              />
            </div>
            {createCardError && <StateMessage type="error">{createCardError}</StateMessage>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={isCreatingCard}>
              Cancel
            </Button>
            <Button onClick={handleCreateCard} disabled={isCreatingCard || !termsAccepted}>
              {isCreatingCard ? "Creating..." : "Create card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set local card limit</DialogTitle>
            <DialogDescription>{selectedCard ? `Card ${selectedCard.maskedNumber}` : "Select a card first."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="card-limit">Daily limit in Kc</Label>
            <Input id="card-limit" type="number" min={1} max={500000} step={100} value={limitInput} onChange={(event) => setLimitInput(event.target.value)} />
            {limitError && <StateMessage type="error">{limitError}</StateMessage>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLimitModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveLimit}>Save limit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScaffold>
  );
}
