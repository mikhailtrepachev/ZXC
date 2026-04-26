"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useNavigate, useSearchParams } from "../routing";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
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

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [fromAccountNumber, setFromAccountNumber] = useState("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isRecipientLoading, setIsRecipientLoading] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState(null);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const accounts = useMemo(() => extractAccountList(profile).map(mapAccountForTransfer).filter((account) => Boolean(account.accountNumber)), [profile]);
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isFrozen), [accounts]);
  const selectedFromAccount = useMemo(
    () => activeAccounts.find((account) => account.accountNumber === fromAccountNumber) || null,
    [activeAccounts, fromAccountNumber],
  );
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
        setProfileError(await readErrorMessage(response, "Could not load profile."));
        setProfile(null);
        return;
      }

      setProfile(await response.json().catch(() => null));
    } catch {
      setProfileError("Could not load profile.");
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

  const validateTransferDraft = () => {
    setSubmitError("");
    setSubmitSuccess("");

    const normalizedFromAccount = fromAccountNumber.trim();
    const normalizedToAccount = toAccountNumber.trim();
    const numericAmount = Number(amount);
    const normalizedMessage = transferMessage.trim();
    const senderAccount = activeAccounts.find((account) => account.accountNumber === normalizedFromAccount);

    if (!/^\d{10,30}$/.test(normalizedFromAccount)) {
      setSubmitError("Select a valid sender account.");
      return null;
    }

    if (!senderAccount) {
      setSubmitError("Selected sender account is unavailable.");
      return null;
    }

    if (!/^\d{10,30}$/.test(normalizedToAccount)) {
      setSubmitError("Enter a valid recipient account number.");
      return null;
    }

    if (normalizedFromAccount === normalizedToAccount) {
      setSubmitError("Transfer to the same account is not allowed.");
      return null;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError("Amount must be positive.");
      return null;
    }

    if (numericAmount > senderAccount.balance) {
      setSubmitError("Insufficient balance.");
      return null;
    }

    if (dailyLimit > 0 && numericAmount > dailyLimit) {
      setSubmitError(`Amount exceeds daily limit ${formatMoney(dailyLimit, selectedCurrencyName)}.`);
      return null;
    }

    if (normalizedMessage.length > 140) {
      setSubmitError("Message can have at most 140 characters.");
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
        return { holderFullName: "Account holder was not found", accountNumber };
      }

      setConfirmError(await readErrorMessage(response, "Could not verify recipient."));
    } catch {
      setConfirmError("Could not verify recipient.");
    }

    return { holderFullName: "Account holder was not found", accountNumber };
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
    setRecipientPreview(await loadRecipientPreview(draft.toAccountNumber));
    setIsRecipientLoading(false);
  };

  const closeConfirmModal = () => {
    if (!isSubmitting) {
      setIsConfirmModalOpen(false);
      setConfirmError("");
    }
  };

  const handleConfirmTransfer = async () => {
    if (!pendingTransfer) {
      return;
    }

    setConfirmError("");
    setSubmitError("");
    setSubmitSuccess("");
    setIsSubmitting(true);

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
        setConfirmError(await readErrorMessage(response, "Transfer failed."));
        return;
      }

      setSubmitSuccess("Transfer was sent.");
      setToAccountNumber("");
      setAmount("");
      setTransferMessage("");
      setIsConfirmModalOpen(false);
      setPendingTransfer(null);
      setRecipientPreview(null);
      await loadProfile();
    } catch {
      setConfirmError("Transfer failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageScaffold
      title="Payments"
      description="Send money with recipient verification and a final confirmation step."
      actions={
        <Button variant="outline" onClick={() => navigate("/accounts")}>
          <ArrowLeft className="size-4" />
          Accounts
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>New transfer</CardTitle>
            <CardDescription>Review all details before money leaves the sender account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={handleOpenConfirm}>
              <div className="grid gap-2">
                <Label>From account</Label>
                <Select value={fromAccountNumber} onValueChange={setFromAccountNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.accountNumber}>
                        {account.accountNumber} - {formatMoney(account.balance, account.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="toAccount">Recipient account</Label>
                <Input id="toAccount" value={toAccountNumber} onChange={(event) => setToAccountNumber(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="40817123456789012345" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="paymentAmount">Amount</Label>
                <div className="relative">
                  <Input id="paymentAmount" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1000" className="pr-16" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{selectedCurrencyCode}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="transferMessage">Message</Label>
                <Textarea id="transferMessage" rows={3} maxLength={140} value={transferMessage} onChange={(event) => setTransferMessage(event.target.value)} placeholder="Optional message" />
                <p className="text-xs text-muted-foreground">{transferMessage.length}/140</p>
              </div>

              <Button type="submit" disabled={activeAccounts.length === 0 || isSubmitting}>
                <Send className="size-4" />
                Continue
              </Button>

              {submitError && <StateMessage type="error">{submitError}</StateMessage>}
              {submitSuccess && <StateMessage type="success">{submitSuccess}</StateMessage>}
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Limits</CardTitle>
              <CardDescription>Current transfer limits for this profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {profileLoading && <p className="text-muted-foreground">Loading limits...</p>}
              {!profileLoading && profileError && <StateMessage type="error">{profileError}</StateMessage>}
              {!profileLoading && !profileError && (
                <>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Daily transfer</span>
                    <strong>{formatMoney(dailyLimit, selectedCurrencyName)}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Internet payments</span>
                    <strong>{formatMoney(internetLimit, selectedCurrencyName)}</strong>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[500, 1000, 5000].map((value) => (
                <Button key={value} type="button" variant="outline" onClick={() => setAmount(String(value))}>
                  {formatMoney(value, selectedCurrencyName)}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isConfirmModalOpen} onOpenChange={(open) => (open ? setIsConfirmModalOpen(true) : closeConfirmModal())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review transfer</DialogTitle>
            <DialogDescription>Confirm the recipient and amount before sending.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-lg border p-4 text-sm">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">From</span>
              <strong className="break-all text-right">{pendingTransfer?.fromAccountNumber || "--"}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">To</span>
              <strong className="break-all text-right">{pendingTransfer?.toAccountNumber || "--"}</strong>
            </p>
            <p className="rounded-md bg-muted p-3">
              {isRecipientLoading ? "Loading recipient..." : recipientPreview?.holderFullName || "Account holder was not found"}
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <strong>{formatMoney(pendingTransfer?.amount || 0, pendingTransfer?.senderCurrency || "CZK")}</strong>
            </p>
            {pendingTransfer?.message && (
              <p className="grid gap-1">
                <span className="text-muted-foreground">Message</span>
                <strong>{pendingTransfer.message}</strong>
              </p>
            )}
          </div>

          {confirmError && <StateMessage type="error">{confirmError}</StateMessage>}

          <DialogFooter>
            <Button variant="outline" onClick={closeConfirmModal} disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={handleConfirmTransfer} disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScaffold>
  );
}
