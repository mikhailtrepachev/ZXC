"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calculator, Repeat2 } from "lucide-react";
import { useNavigate, useParams } from "../routing";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PageScaffold, StateMessage } from "../components/PageScaffold";
import {
  extractAccountList,
  formatMoney,
  getAuthHeaders,
  mapAccount,
  readErrorMessage,
} from "../lib/bank";

export default function AccountConversionPage() {
  const navigate = useNavigate();
  const { accountNumber } = useParams();
  const normalizedFromAccountNumber = decodeURIComponent(accountNumber || "").trim();

  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("Conversion between own accounts");
  const [estimate, setEstimate] = useState(null);
  const [estimateError, setEstimateError] = useState("");
  const [isEstimateLoading, setIsEstimateLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourceAccount = useMemo(
    () => accounts.find((item) => item.accountNumber === normalizedFromAccountNumber) || null,
    [accounts, normalizedFromAccountNumber],
  );

  const targetAccounts = useMemo(
    () => accounts.filter((item) => item.accountNumber !== normalizedFromAccountNumber && !item.isFrozen),
    [accounts, normalizedFromAccountNumber],
  );

  const loadAccounts = useCallback(async () => {
    setLoadError("");
    setIsLoading(true);

    if (!normalizedFromAccountNumber) {
      setLoadError("Invalid source account.");
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/Accounts/info", {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setLoadError(await readErrorMessage(response, "Could not load accounts."));
        setAccounts([]);
        return;
      }

      const payload = await response.json().catch(() => null);
      setAccounts(extractAccountList(payload).map(mapAccount));
    } catch {
      setLoadError("Could not load accounts.");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedFromAccountNumber]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!targetAccounts.some((item) => item.accountNumber === toAccountNumber)) {
      setToAccountNumber(targetAccounts[0]?.accountNumber || "");
    }
  }, [targetAccounts, toAccountNumber]);

  useEffect(() => {
    const numericAmount = Number(amount);
    if (!sourceAccount || !toAccountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setEstimate(null);
      setEstimateError("");
      return undefined;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(async () => {
      setIsEstimateLoading(true);
      setEstimateError("");

      try {
        const response = await fetch("/api/Transaction/conversion-estimate", {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            fromAccountNumber: sourceAccount.accountNumber,
            toAccountNumber,
            amount: numericAmount,
          }),
        });

        if (!response.ok) {
          const messageText = await readErrorMessage(response, "Could not calculate conversion.");
          if (!isCancelled) {
            setEstimate(null);
            setEstimateError(messageText);
          }
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!isCancelled) {
          setEstimate(payload && typeof payload === "object" ? payload : null);
        }
      } catch {
        if (!isCancelled) {
          setEstimate(null);
          setEstimateError("Could not calculate conversion.");
        }
      } finally {
        if (!isCancelled) {
          setIsEstimateLoading(false);
        }
      }
    }, 280);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [amount, sourceAccount, toAccountNumber]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!sourceAccount) {
      setSubmitError("Source account was not found.");
      return;
    }

    const target = targetAccounts.find((item) => item.accountNumber === toAccountNumber) || null;
    if (!target) {
      setSubmitError("Select a target account.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError("Enter a positive amount.");
      return;
    }

    if (numericAmount > sourceAccount.balance) {
      setSubmitError("Insufficient source account balance.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Transaction/transfer", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          fromAccountNumber: sourceAccount.accountNumber,
          toAccountNumber: target.accountNumber,
          amount: numericAmount,
          message: String(message || "").trim(),
        }),
      });

      if (!response.ok) {
        setSubmitError(await readErrorMessage(response, "Conversion failed."));
        return;
      }

      setSubmitSuccess("Conversion was completed.");
      setAmount("");
      await loadAccounts();
    } catch {
      setSubmitError("Conversion failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageScaffold
      title="Account conversion"
      description="Move money between your own accounts with an estimated exchange rate."
      actions={
        <Button variant="outline" onClick={() => navigate(`/accounts/${encodeURIComponent(normalizedFromAccountNumber)}`)}>
          <ArrowLeft className="size-4" />
          Account detail
        </Button>
      }
    >
      {isLoading && <StateMessage>Loading accounts...</StateMessage>}
      {!isLoading && loadError && <StateMessage type="error">{loadError}</StateMessage>}

      {!isLoading && !loadError && sourceAccount && (
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Source account</CardTitle>
                <CardDescription>{sourceAccount.accountNumber}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <strong>{formatMoney(sourceAccount.balance, sourceAccount.currency, 2)}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <strong>{sourceAccount.currencyCode}</strong>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Target account</CardTitle>
                <CardDescription>Choose one of your active accounts.</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={toAccountNumber} onValueChange={setToAccountNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetAccounts.length === 0 && <SelectItem value="none">No available account</SelectItem>}
                    {targetAccounts.map((item) => (
                      <SelectItem key={item.accountNumber} value={item.accountNumber}>
                        {item.accountNumber} ({item.currencyCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-5" />
                Conversion parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estimate">Estimated target amount</Label>
                  <Input
                    id="estimate"
                    readOnly
                    value={estimate ? formatMoney(estimate.amountTo, estimate.toCurrency, 2) : isEstimateLoading ? "Calculating..." : "--"}
                  />
                </div>
              </div>

              {estimate && (
                <StateMessage>
                  Rate: 1 {estimate.fromCurrency} = {estimate.conversionRate} {estimate.toCurrency}
                </StateMessage>
              )}
              {estimateError && <StateMessage type="error">{estimateError}</StateMessage>}

              <div className="grid gap-2">
                <Label htmlFor="message">Message</Label>
                <Input id="message" maxLength={140} value={message} onChange={(event) => setMessage(event.target.value)} />
              </div>

              {submitError && <StateMessage type="error">{submitError}</StateMessage>}
              {submitSuccess && <StateMessage type="success">{submitSuccess}</StateMessage>}

              <Button type="submit" className="w-fit" disabled={isSubmitting || targetAccounts.length === 0}>
                <Repeat2 className="size-4" />
                {isSubmitting ? "Converting..." : "Complete conversion"}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </PageScaffold>
  );
}
