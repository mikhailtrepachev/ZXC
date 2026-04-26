"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react";
import {
  getCurrentUserFromToken,
  getLocalCardPin,
  resolveUserDisplayNameByEmail,
} from "../auth/session";
import { useNavigate, useParams } from "../routing";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { PageScaffold, StateMessage } from "../components/PageScaffold";
import {
  formatDate,
  formatMoney,
  getAuthHeaders,
  parseJsonStorage,
  pick,
  transactionIsIncome,
} from "../lib/bank";

const tabs = [
  { id: "transactions", label: "Transactions" },
  { id: "security", label: "Security" },
  { id: "limits", label: "Limits" },
  { id: "profile", label: "Profile" },
];

const CARD_LIMITS_STORAGE_KEY = "zxc_cards_limits";

function formatCountdown(secondsLeft) {
  const safe = Math.max(0, Number(secondsLeft) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    const localPin = getLocalCardPin(card.id);

    return [
      { label: "Card number", value: isSensitiveVisible && fullCardNumber ? fullCardNumber : card.maskedNumber || "--" },
      { label: "Valid until", value: card.expiryDate || "--" },
      { label: "CVC", value: isSensitiveVisible ? card.cvv || "--" : "***" },
      { label: "PIN", value: isSensitiveVisible ? localPin || "Not stored locally" : "****" },
      { label: "Holder", value: resolveUserDisplayNameByEmail(profileEmail, card.holderName || "--") },
    ];
  }, [card, isSensitiveVisible, profileEmail]);

  const cardProfile = useMemo(() => {
    if (!card) {
      return [];
    }

    return [
      { label: "Type", value: card.isVirtual ? "Virtual" : "Plastic" },
      { label: "Status", value: card.isActive ? "Active" : "Blocked by bank" },
      { label: "Card ID", value: String(card.id) },
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
      const amount = Number(pick(tx, "amount", "Amount"));
      const isIncome = transactionIsIncome(pick(tx, "type", "Type"));
      if (!Number.isFinite(amount) || isIncome) {
        return sum;
      }

      return sum + Math.abs(amount);
    }, 0);

    const max = Number.isFinite(localLimit) && localLimit > 0 ? localLimit : 50000;

    return [{ name: "Local daily limit", used: Math.min(outgoingSpent, max), max }];
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
          <Card key={item.label} className="py-4">
            <CardContent className="grid gap-1 px-4">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="font-medium break-all">{item.value}</p>
            </CardContent>
          </Card>
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
              <div key={limit.name} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{limit.name}</span>
                  <span className="text-muted-foreground">
                    {formatMoney(limit.used)} / {formatMoney(limit.max)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
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
      description={card?.maskedNumber || "Card profile and security controls"}
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
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="overflow-hidden">
            <CardHeader className="bg-slate-950 text-white">
              <div className="mb-12 flex items-center justify-between">
                <span className="rounded-md bg-white/10 px-3 py-1 text-xs">{card.isVirtual ? "Virtual" : "Plastic"}</span>
                <ShieldCheck className="size-5 opacity-80" />
              </div>
              <CardTitle className="font-mono text-2xl tracking-wide">{card.maskedNumber || "**** **** **** ****"}</CardTitle>
              <CardDescription className="text-white/70">
                {resolveUserDisplayNameByEmail(profileEmail, card.holderName || "--")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6">
              <Badge variant={card.isActive ? "secondary" : "destructive"} className="w-fit">
                {card.isActive ? "Active" : "Blocked"}
              </Badge>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <span className="text-muted-foreground">Expires</span>
                <span className="text-right font-medium">{card.expiryDate || "--"}</span>
                <span className="text-muted-foreground">Account</span>
                <span className="text-right font-medium break-all">{card.accountNumber || "--"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Button key={tab.id} variant={activeTab === tab.id ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab.id)}>
                    {tab.label}
                  </Button>
                ))}
              </div>
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
