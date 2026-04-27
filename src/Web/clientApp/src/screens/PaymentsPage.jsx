"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send, X } from "lucide-react";
import { useNavigate, useSearchParams } from "../routing";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PageScaffold, StateMessage } from "../components/PageScaffold";
import {
  currencyCodeFromName,
  extractAccountList,
  formatMoney,
  getAuthHeaders,
  mapAccount,
  pick,
  readErrorMessage,
} from "../lib/bank";

function mapAccountForTransfer(rawItem) {
  const mapped = mapAccount(rawItem);

  return {
    ...mapped,
    id: String(pick(rawItem, "id", "Id") || mapped.accountNumber),
  };
}

function accountTail(accountNumber) {
  const value = String(accountNumber || "");
  return value ? value.slice(-4) : "----";
}

function accountDisplayName(account) {
  if (!account) {
    return "--";
  }

  const label = account.label || `${account.type || "Bank"} account`;
  return `${label} (*${accountTail(account.accountNumber)}) - ${formatMoney(account.balance, account.currency)}`;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function composeRecipientAccountNumber(accountNumber, bankCode) {
  return `${digitsOnly(accountNumber)}${digitsOnly(bankCode)}`.trim();
}

function formatBankAccount(value) {
  const digits = digitsOnly(value);
  if (!digits) {
    return "--";
  }

  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatArrivalDate() {
  return `Today, ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [fromAccountNumber, setFromAccountNumber] = useState("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [recipientBankCode, setRecipientBankCode] = useState("");
  const [recipientPreview, setRecipientPreview] = useState(null);
  const [recipientError, setRecipientError] = useState("");
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const accounts = useMemo(
    () => extractAccountList(profile).map(mapAccountForTransfer).filter((account) => Boolean(account.accountNumber)),
    [profile],
  );
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isFrozen), [accounts]);
  const selectedFromAccount = useMemo(
    () => activeAccounts.find((account) => account.accountNumber === fromAccountNumber) || null,
    [activeAccounts, fromAccountNumber],
  );
  const recipientAccountNumber = useMemo(
    () => composeRecipientAccountNumber(toAccountNumber, recipientBankCode),
    [recipientBankCode, toAccountNumber],
  );
  const amountValue = Number(amount);
  const normalizedAmount = Number.isFinite(amountValue) && amountValue > 0 ? amountValue : 0;
  const transferFee = 0;
  const totalAmount = normalizedAmount + transferFee;
  const selectedCurrencyName = selectedFromAccount?.currency || "CZK";
  const selectedCurrencyCode = currencyCodeFromName(selectedCurrencyName);
  const preferredFromAccount = String(searchParams.get("from") || "").trim();
  const dailyLimit = Number(pick(profile, "dailyTransferLimit", "DailyTransferLimit")) || 0;
  const estimatedArrival = useMemo(() => formatArrivalDate(), []);

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
        setProfileError(await readErrorMessage(response, "Could not load connected accounts."));
        setProfile(null);
        return;
      }

      setProfile(await response.json().catch(() => null));
    } catch {
      setProfileError("Could not load connected accounts.");
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
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
    setRecipientPreview(null);
    setRecipientError("");
    setRecipientLoading(false);

    if (!recipientAccountNumber || recipientAccountNumber.length < 8) {
      return undefined;
    }

    if (selectedFromAccount?.accountNumber === recipientAccountNumber) {
      setRecipientError("Choose a different recipient account.");
      return undefined;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(async () => {
      setRecipientLoading(true);

      try {
        const response = await fetch(`/api/Transaction/recipient/${encodeURIComponent(recipientAccountNumber)}`, {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          const message = await readErrorMessage(response, "Recipient account was not found.");
          if (!isCancelled) {
            setRecipientError(message);
          }
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!isCancelled) {
          setRecipientPreview(payload);
        }
      } catch {
        if (!isCancelled) {
          setRecipientError("Could not verify recipient account.");
        }
      } finally {
        if (!isCancelled) {
          setRecipientLoading(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [recipientAccountNumber, selectedFromAccount?.accountNumber]);

  const resetTransfer = () => {
    setAmount("");
    setToAccountNumber("");
    setRecipientBankCode("");
    setTransferMessage("");
    setRecipientPreview(null);
    setRecipientError("");
    setSubmitError("");
    setSubmitSuccess("");
  };

  const validateTransfer = () => {
    setSubmitError("");
    setSubmitSuccess("");

    if (!selectedFromAccount) {
      return "Select a sender account.";
    }

    if (!recipientAccountNumber) {
      return "Enter a recipient bank account.";
    }

    if (selectedFromAccount.accountNumber === recipientAccountNumber) {
      return "Choose a different recipient account.";
    }

    if (recipientLoading) {
      return "Wait until recipient account verification is finished.";
    }

    if (recipientError || !recipientPreview) {
      return recipientError || "Recipient account was not found.";
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return "Enter a positive transfer amount.";
    }

    if (amountValue > selectedFromAccount.balance) {
      return "Insufficient balance.";
    }

    if (dailyLimit > 0 && amountValue > dailyLimit) {
      return `Amount exceeds daily limit ${formatMoney(dailyLimit, selectedCurrencyName)}.`;
    }

    return "";
  };

  const handleConfirmTransfer = async (event) => {
    event.preventDefault();

    const validationError = validateTransfer();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Transaction/transfer", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          fromAccountNumber: selectedFromAccount.accountNumber,
          toAccountNumber: recipientAccountNumber,
          amount: amountValue,
          message: String(transferMessage || "").trim() || "Bank transfer",
        }),
      });

      if (!response.ok) {
        setSubmitError(await readErrorMessage(response, "Transfer failed."));
        return;
      }

      setSubmitSuccess("Transfer was sent.");
      setAmount("");
      await loadProfile();
    } catch {
      setSubmitError("Transfer failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageScaffold
      title="Payments"
      description="Move money from a connected ZXC Bank account to a verified bank account."
      actions={
        <Button variant="outline" onClick={() => navigate("/accounts")}>
          <ArrowLeft className="size-4" />
          Accounts
        </Button>
      }
    >
      <div className="flex justify-center">
        <Card className="w-full max-w-md border bg-card shadow-sm">
          <CardContent className="p-8">
            <form className="grid gap-7" onSubmit={handleConfirmTransfer}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="font-heading text-2xl font-semibold uppercase tracking-wider">Transfer funds</h2>
                  <p className="text-sm text-muted-foreground">Send money to a verified bank account.</p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={resetTransfer} aria-label="Reset transfer">
                  <X className="size-4" />
                </Button>
              </div>

              {profileError && <StateMessage type="error">{profileError}</StateMessage>}
              {!profileLoading && activeAccounts.length < 1 && (
                <StateMessage type="warning">You need an active account to transfer funds.</StateMessage>
              )}

              <div className="grid gap-2">
                <Label htmlFor="paymentAmount">Amount to transfer</Label>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {selectedCurrencyCode === "USD" ? "$" : selectedCurrencyCode}
                  </span>
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="1,200.00"
                    className="h-11 border-x-0 border-t-0 pl-10 text-lg shadow-none focus-visible:ring-0"
                    disabled={profileLoading || activeAccounts.length < 1 || isSubmitting}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>From account</Label>
                <Select value={fromAccountNumber} onValueChange={setFromAccountNumber} disabled={profileLoading || isSubmitting}>
                  <SelectTrigger className="h-11 border-x-0 border-t-0 px-0 shadow-none focus:ring-0">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.accountNumber}>
                        {accountDisplayName(account)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_6.5rem]">
                  <div className="grid gap-2">
                    <Label htmlFor="recipientAccount">To account</Label>
                    <Input
                      id="recipientAccount"
                      inputMode="numeric"
                      value={toAccountNumber}
                      onChange={(event) => setToAccountNumber(event.target.value.replace(/[^\d\s-]/g, ""))}
                      placeholder="2481781000000000"
                      className="h-11 border-x-0 border-t-0 text-lg shadow-none focus-visible:ring-0"
                      disabled={profileLoading || isSubmitting}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="recipientBankCode">Bank code</Label>
                    <Input
                      id="recipientBankCode"
                      inputMode="numeric"
                      maxLength={4}
                      value={recipientBankCode}
                      onChange={(event) => setRecipientBankCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="0002"
                      className="h-11 border-x-0 border-t-0 text-lg shadow-none focus-visible:ring-0"
                      disabled={profileLoading || isSubmitting}
                    />
                  </div>
                </div>

                {(recipientAccountNumber || recipientLoading || recipientError || recipientPreview) && (
                  <div className="grid gap-2 bg-muted/40 p-3 text-sm">
                    <p className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Account</span>
                      <strong className="break-all text-right">{formatBankAccount(recipientAccountNumber)}</strong>
                    </p>
                    {recipientLoading && <p className="text-muted-foreground">Checking recipient...</p>}
                    {recipientPreview && (
                      <p className="flex justify-between gap-4 border-t pt-2">
                        <span className="text-muted-foreground">Recipient</span>
                        <strong className="text-right">{recipientPreview.holderFullName || "--"}</strong>
                      </p>
                    )}
                    {recipientError && <p className="border-t pt-2 text-destructive">{recipientError}</p>}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="transferMessage">Message</Label>
                <Input
                  id="transferMessage"
                  maxLength={140}
                  value={transferMessage}
                  onChange={(event) => setTransferMessage(event.target.value)}
                  placeholder="Payment note"
                  className="h-11 border-x-0 border-t-0 shadow-none focus-visible:ring-0"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid gap-3 bg-muted/40 p-4 text-sm">
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Estimated arrival</span>
                  <strong>{estimatedArrival}</strong>
                </p>
                <p className="flex justify-between gap-4 border-t pt-3">
                  <span className="text-muted-foreground">Transaction fee</span>
                  <strong>{formatMoney(transferFee, selectedCurrencyName, 2)}</strong>
                </p>
                <p className="flex justify-between gap-4 border-t pt-3">
                  <span>Total amount</span>
                  <strong>{formatMoney(totalAmount, selectedCurrencyName, 2)}</strong>
                </p>
              </div>

              <Button type="submit" disabled={profileLoading || activeAccounts.length < 1 || recipientLoading || isSubmitting}>
                <Send className="size-4" />
                {isSubmitting ? "Sending..." : "Confirm transfer"}
              </Button>

              {submitError && <StateMessage type="error">{submitError}</StateMessage>}
              {submitSuccess && <StateMessage type="success">{submitSuccess}</StateMessage>}
            </form>
          </CardContent>
        </Card>
      </div>
    </PageScaffold>
  );
}
