"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CreditCard, Landmark, Plus, RefreshCcw, Send, ShieldAlert, WalletCards } from "lucide-react";
import { resolveUserDisplayNameByEmail, saveLocalCardPin } from "../auth/session";
import { useNavigate } from "../routing";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EmptyState, PageScaffold, StateMessage } from "../components/PageScaffold";
import {
  extractAccountList,
  formatMoney,
  getAuthHeaders,
  mapAccount,
  pick,
  readErrorMessage,
} from "../lib/bank";

const quickActions = [
  { id: "payment", title: "New payment", icon: Send, href: "/payments" },
  { id: "cards", title: "Cards", icon: CreditCard, href: "/cards" },
  { id: "loans", title: "Loan calculator", icon: Landmark, href: "/loans" },
];

function cardLabel(card, profileEmail) {
  return resolveUserDisplayNameByEmail(profileEmail, card.holderName || "Card holder");
}

export default function AccountsPage() {
  const navigate = useNavigate();
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

  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isFrozen), [accounts]);
  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0),
    [accounts],
  );

  const transferLimit = Number(pick(profile, "dailyTransferLimit", "DailyTransferLimit")) || 0;
  const internetLimit = Number(pick(profile, "internetPaymentLimit", "InternetPaymentLimit")) || 0;

  const loadProfile = useCallback(async () => {
    setProfileError("");
    setProfileLoading(true);

    try {
      const response = await fetch("/api/Accounts/info", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Could not load account profile.");
        setProfileError(message);
        setProfile(null);
        setAccounts([]);
        return;
      }

      const payload = await response.json().catch(() => null);
      const rawAccounts = extractAccountList(payload);
      setProfile(payload);
      setAccounts(Array.isArray(rawAccounts) ? rawAccounts.map(mapAccount) : []);
    } catch {
      setProfileError("Could not load account profile.");
      setProfile(null);
      setAccounts([]);
    } finally {
      setProfileLoading(false);
    }
  }, []);

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
        const message = await readErrorMessage(response, "Could not load cards.");
        setCardsError(message);
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

  const reloadAll = useCallback(async () => {
    await Promise.all([loadProfile(), loadCards()]);
  }, [loadProfile, loadCards]);

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
      activeAccounts.find((account) => String(account.type || "").toLowerCase() !== "investment")?.accountNumber ||
      activeAccounts[0]?.accountNumber ||
      "";

    if (!targetAccountNumber) {
      setCreateCardError("There is no active account for card issuing.");
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
        setCreateCardError(await readErrorMessage(response, "Could not create card."));
        return;
      }

      const createdCardRaw = await response.text().catch(() => "");
      const createdCardId = Number(String(createdCardRaw).replace(/"/g, "").trim());
      if (Number.isFinite(createdCardId) && createdCardId > 0) {
        saveLocalCardPin(createdCardId, pinCode);
      }

      await loadCards();
      setIsCreateModalOpen(false);
      setTermsAccepted(false);
      setPinCode("");
    } catch {
      setCreateCardError("Could not create card.");
    } finally {
      setIsCreatingCard(false);
    }
  };

  return (
    <PageScaffold
      title={fullName ? `Good day, ${fullName}` : "Accounts"}
      description="Overview of balances, cards, daily limits, and the fastest banking actions."
      actions={
        <>
          <Button variant="outline" onClick={reloadAll} disabled={profileLoading || isCardsLoading}>
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
          <CardHeader className="pb-2">
            <CardDescription>Total balance</CardDescription>
            <CardTitle className="text-3xl">{formatMoney(totalBalance, "Koruna")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{accounts.length} accounts connected</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily transfer limit</CardDescription>
            <CardTitle className="text-3xl">{formatMoney(transferLimit, "Koruna")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Internet limit {formatMoney(internetLimit, "Koruna")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cards</CardDescription>
            <CardTitle className="text-3xl">{cards.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Active and virtual cards</CardContent>
        </Card>
      </div>

      {profileError && <StateMessage type="error">{profileError}</StateMessage>}
      {cardsError && <StateMessage type="error">{cardsError}</StateMessage>}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.id} variant="outline" className="h-24 justify-start p-5" onClick={() => navigate(action.href)}>
                  <Icon className="size-5" />
                  <span>{action.title}</span>
                </Button>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>Click an account to view details, history, transfer, and conversion actions.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {profileLoading && <p className="text-sm text-muted-foreground">Loading accounts...</p>}
              {!profileLoading && !profileError && accounts.length === 0 && (
                <EmptyState title="No accounts found" description="This profile does not have bank accounts yet." />
              )}
              {accounts.map((account) => (
                <button
                  key={account.accountNumber || account.id}
                  type="button"
                  className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => navigate(`/accounts/${encodeURIComponent(account.accountNumber)}`)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <WalletCards className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{account.label}</span>
                      <span className="block truncate text-sm text-muted-foreground">{account.accountNumber}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {account.isFrozen && (
                      <Badge variant="destructive">
                        <ShieldAlert className="size-3" />
                        Frozen
                      </Badge>
                    )}
                    <span className="text-right font-semibold">{formatMoney(account.balance, account.currency)}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Cards</CardTitle>
            <CardDescription>Card list is loaded from the backend and refreshed after issuing a new card.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {isCardsLoading && <p className="text-sm text-muted-foreground">Loading cards...</p>}
            {!isCardsLoading && !cardsError && cards.length === 0 && (
              <EmptyState
                title="No cards"
                description="Issue a card for one of your active accounts."
                action={<Button onClick={() => setIsCreateModalOpen(true)}>Issue card</Button>}
              />
            )}
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="rounded-lg border bg-gradient-to-br from-slate-950 to-slate-800 p-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5"
                onClick={() => navigate(`/cards/${card.id}`)}
              >
                <div className="mb-8 flex items-center justify-between">
                  <Badge variant="secondary">{card.isVirtual ? "Virtual" : "Plastic"}</Badge>
                  <CreditCard className="size-5 opacity-80" />
                </div>
                <p className="font-mono text-lg tracking-wide">{card.maskedNumber || "**** **** **** ****"}</p>
                <div className="mt-4 flex justify-between text-xs text-white/70">
                  <span>{cardLabel(card, profileEmail)}</span>
                  <span>{card.expiryDate || "--"}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={(open) => !isCreatingCard && setIsCreateModalOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New credit card</DialogTitle>
            <DialogDescription>Choose a 4-digit PIN and accept the terms before issuing the card.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              <ul className="list-inside list-disc space-y-1">
                <li>The card can be used according to bank terms.</li>
                <li>The card holder is responsible for payment security.</li>
                <li>The bank may block the card on suspicious activity.</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={termsAccepted} onCheckedChange={(value) => setTermsAccepted(Boolean(value))} />
              <span>I accept the card issuing terms.</span>
            </label>

            <div className="grid gap-2">
              <Label htmlFor="card-pin">PIN</Label>
              <Input
                id="card-pin"
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
    </PageScaffold>
  );
}
