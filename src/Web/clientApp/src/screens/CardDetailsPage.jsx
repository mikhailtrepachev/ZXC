"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CreditCard, Eye, KeyRound, Landmark, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import {
  getCurrentUserFromToken,
  resolveUserDisplayNameByEmail,
} from "../auth/session";
import { useNavigate, useParams } from "../routing";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { PageScaffold, StateMessage } from "../components/PageScaffold";
import {
  formatDate,
  formatMoney,
  getAuthHeaders,
  pick,
  transactionIsIncome,
} from "../lib/bank";

const tabs = [
  { id: "transactions", label: "Transactions", icon: ReceiptText },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "limits", label: "Limits", icon: ShieldCheck },
  { id: "profile", label: "Profile", icon: UserRound },
];

function formatCountdown(secondsLeft) {
  const safe = Math.max(0, Number(secondsLeft) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCardNumber(value) {
  const digits = digitsOnly(value);
  return digits ? digits.replace(/(.{4})/g, "$1 ").trim() : "**** **** **** ****";
}

function maskCardNumber(value) {
  const digits = digitsOnly(value);
  return digits ? `**** **** **** ${digits.slice(-4)}` : "**** **** **** ****";
}

function formatBankAccount(value) {
  const digits = digitsOnly(value);
  return digits ? digits.replace(/(.{4})/g, "$1 ").trim() : "--";
}

export default function CardDetailsPage() {
  const navigate = useNavigate();
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
      return undefined;
    }

    const timerId = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(timerId);
  }, [isSensitiveVisible]);

  useEffect(() => {
    let isMounted = true;

    async function loadCard() {
      if (!Number.isFinite(numericCardId) || numericCardId <= 0) {
        if (isMounted) {
          setError("Invalid card ID.");
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

        if (!email) {
          email = String(getCurrentUserFromToken() || "").trim();
        }

        if (isMounted) {
          setProfileEmail(email);
        }

        if (!cardsResponse.ok) {
          throw new Error("Could not load card list.");
        }

        const list = await cardsResponse.json().catch(() => []);
        const cards = Array.isArray(list) ? list : [];
        const selected = cards.find((item) => Number(item.id) === numericCardId) || null;

        if (!isMounted) {
          return;
        }

        if (!selected) {
          setError("Card was not found.");
          setCard(null);
          return;
        }

        setCard({
          ...selected,
          holderLabel: resolveUserDisplayNameByEmail(email, selected.holderName),
        });
      } catch {
        if (isMounted) {
          setError("Could not load card details.");
        }
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
  }, [numericCardId]);

  const transactionRows = useMemo(
    () =>
      transactions.slice(0, 12).map((tx) => {
        const amount = Number(pick(tx, "amount", "Amount"));
        const isIncome = transactionIsIncome(pick(tx, "type", "Type"));
        const absoluteAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;

        return {
          id: pick(tx, "id", "Id") || `${tx.date}-${tx.description}`,
          merchant: pick(tx, "description", "Description") || pick(tx, "counterpartyAccount", "CounterpartyAccount") || "Card transaction",
          date: formatDate(pick(tx, "date", "Date")),
          amount: `${isIncome ? "+" : "-"} ${formatMoney(absoluteAmount)}`,
          status: isIncome ? "Incoming" : "Completed",
          isIncome,
        };
      }),
    [transactions],
  );

  const cardDetails = useMemo(() => {
    if (!card) {
      return [];
    }

    const fullCardNumber = String(pick(card, "cardNumber", "CardNumber", "fullNumber", "FullNumber") || "").trim();
    return [
      { label: "Card number", value: isSensitiveVisible && fullCardNumber ? formatCardNumber(fullCardNumber) : maskCardNumber(fullCardNumber || card.maskedNumber) },
      { label: "Valid until", value: card.expiryDate || "--" },
      { label: "CVC", value: isSensitiveVisible ? card.cvv || "--" : "***" },
      { label: "PIN", value: "Stored securely on backend" },
      { label: "Holder", value: resolveUserDisplayNameByEmail(profileEmail, card.holderName || "--") },
    ];
  }, [card, isSensitiveVisible, profileEmail]);

  const cardProfile = useMemo(() => {
    if (!card) {
      return [];
    }

    return [
      { label: "Type", value: card.isVirtual ? "Virtual" : "Plastic" },
      {
        label: "Status",
        value: !card.isActive ? "Blocked by bank" : card.isTemporarilyBlocked ? "Temporarily blocked" : "Active",
      },
      { label: "Card ID", value: String(card.id) },
      { label: "Bank account", value: formatBankAccount(card.accountNumber) },
    ];
  }, [card]);

  const cardLimits = useMemo(() => {
    if (!card) {
      return [];
    }

    const dailyLimit = Number(pick(card, "dailyLimit", "DailyLimit"));
    const outgoingSpent = transactions.reduce((sum, tx) => {
      const amount = Number(pick(tx, "amount", "Amount"));
      const isIncome = transactionIsIncome(pick(tx, "type", "Type"));
      if (!Number.isFinite(amount) || isIncome) {
        return sum;
      }

      return sum + Math.abs(amount);
    }, 0);

    const max = Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : 50000;

    return [{ name: "Daily card limit", used: Math.min(outgoingSpent, max), max }];
  }, [card, transactions]);

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
      setPasswordError("Enter your password.");
      return;
    }

    if (!profileEmail) {
      setPasswordError("Could not detect user email.");
      return;
    }

    setIsPasswordChecking(true);

    try {
      const response = await fetch("/api/Clients/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileEmail, password }),
      });

      if (!response.ok) {
        setPasswordError("Invalid password.");
        return;
      }

      setRevealUntil(Date.now() + 60_000);
      setNowTs(Date.now());
      setIsPasswordModalOpen(false);
      setPasswordInput("");
      setPasswordError("");
    } catch {
      setPasswordError("Password verification failed.");
    } finally {
      setIsPasswordChecking(false);
    }
  };

  const renderInfoGrid = (items, emptyText) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground">{emptyText}</p>;
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="grid gap-1 border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="font-medium break-all">{item.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderTab = () => {
    if (activeTab === "transactions") {
      return isTransactionsLoading ? (
        <p className="text-sm text-muted-foreground">Loading transactions...</p>
      ) : transactionRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No card transactions are available.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactionRows.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">{tx.merchant}</TableCell>
                <TableCell>{tx.date}</TableCell>
                <TableCell>{tx.status}</TableCell>
                <TableCell className={tx.isIncome ? "text-right font-medium text-emerald-600" : "text-right font-medium"}>{tx.amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    if (activeTab === "security") {
      return (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Sensitive card details</h2>
              <p className="text-sm text-muted-foreground">Verify your password to reveal sensitive data for one minute.</p>
            </div>
            <Button onClick={() => setIsPasswordModalOpen(true)}>
              <Eye className="size-4" />
              {isSensitiveVisible ? "Details visible" : "Reveal details"}
            </Button>
          </div>
          {isSensitiveVisible && <StateMessage type="success">Sensitive details are visible: {formatCountdown(secondsLeft)}</StateMessage>}
          {renderInfoGrid(cardDetails, "Card data is unavailable.")}
        </div>
      );
    }

    if (activeTab === "limits") {
      return (
        <div className="grid gap-3">
          {cardLimits.map((limit) => {
            const percent = Math.round((limit.used / limit.max) * 100);

            return (
              <div key={limit.name} className="border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{limit.name}</span>
                  <span className="text-muted-foreground">
                    {formatMoney(limit.used)} / {formatMoney(limit.max)}
                  </span>
                </div>
                <Progress value={Math.min(percent, 100)} />
              </div>
            );
          })}
        </div>
      );
    }

    return renderInfoGrid(cardProfile, "Card profile is unavailable.");
  };

  return (
    <PageScaffold
      title="Card details"
      description={card ? maskCardNumber(card.maskedNumber) : "Card profile and security controls"}
      actions={
        <Button variant="outline" onClick={() => navigate("/cards")}>
          <ArrowLeft className="size-4" />
          Cards
        </Button>
      }
    >
      {isCardLoading && <StateMessage>Loading card...</StateMessage>}
      {!isCardLoading && error && <StateMessage type="error">{error}</StateMessage>}

      {!isCardLoading && !error && card && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="overflow-hidden p-0">
            <div className="relative min-h-60 overflow-hidden bg-zinc-950 p-7 text-white">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.24),transparent_42%,rgba(245,158,11,0.18))]" />
              <div className="relative flex items-center justify-between">
                <Badge className="bg-white/10 px-3 py-1 text-white">{card.isVirtual ? "Virtual" : "Plastic"}</Badge>
                <ShieldCheck className="size-5 text-white/75" />
              </div>
              <div className="relative mt-10 grid gap-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center border border-white/30 bg-white/15">
                    <CreditCard className="size-5" />
                  </span>
                  <Landmark className="size-6 text-white/70" />
                </div>
                <p className="font-mono text-2xl font-semibold tracking-normal text-balance">
                  {isSensitiveVisible ? formatCardNumber(card.maskedNumber) : maskCardNumber(card.maskedNumber)}
                </p>
                <div className="grid grid-cols-2 gap-4 text-xs uppercase tracking-normal text-white/60">
                  <span>
                    Holder
                    <strong className="mt-1 block truncate text-sm tracking-normal text-white">
                      {resolveUserDisplayNameByEmail(profileEmail, card.holderName || "--")}
                    </strong>
                  </span>
                  <span className="text-right">
                    Expires
                    <strong className="mt-1 block text-sm tracking-normal text-white">{card.expiryDate || "--"}</strong>
                  </span>
                </div>
              </div>
            </div>
            <CardContent className="grid gap-4 py-6">
              <div className="flex items-center justify-between gap-4">
                <Badge variant={card.isActive && !card.isTemporarilyBlocked ? "secondary" : "destructive"}>
                  {!card.isActive ? "Blocked" : card.isTemporarilyBlocked ? "Temporarily blocked" : "Active"}
                </Badge>
                <span className="text-sm text-muted-foreground">{card.isVirtual ? "Digital issue" : "Physical issue"}</span>
              </div>
              <Separator />
              <div className="grid gap-3 text-sm">
                <p className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4" />
                    Valid until
                  </span>
                  <strong>{card.expiryDate || "--"}</strong>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Landmark className="size-4" />
                    Account
                  </span>
                  <strong className="break-all text-right">{formatBankAccount(card.accountNumber)}</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-4">
              <CardTitle>Card controls</CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-auto w-full flex-wrap justify-start bg-transparent p-0">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                      <TabsTrigger key={tab.id} value={tab.id} className="border">
                        <Icon className="size-4" />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>{renderTab()}</CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isPasswordModalOpen} onOpenChange={(open) => (open ? setIsPasswordModalOpen(true) : closePasswordModal())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password confirmation</DialogTitle>
            <DialogDescription>Enter your account password to reveal card details for one minute.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="card-password">Password</Label>
            <Input id="card-password" type="password" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} autoFocus />
            {passwordError && <StateMessage type="error">{passwordError}</StateMessage>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePasswordModal} disabled={isPasswordChecking}>
              Cancel
            </Button>
            <Button onClick={handleVerifyPassword} disabled={isPasswordChecking}>
              {isPasswordChecking ? "Verifying..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScaffold>
  );
}
