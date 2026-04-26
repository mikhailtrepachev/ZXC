"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, RefreshCcw, Repeat2, Send } from "lucide-react";
import { useNavigate, useParams } from "../routing";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { PageScaffold, StateMessage } from "../components/PageScaffold";
import {
  extractAccountList,
  formatDate,
  formatMoney,
  getAuthHeaders,
  mapAccount,
  pick,
  readErrorMessage,
} from "../lib/bank";

export default function AccountDetailsPage() {
  const navigate = useNavigate();
  const { accountNumber } = useParams();
  const normalizedAccountNumber = decodeURIComponent(accountNumber || "").trim();

  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    setIsLoading(true);

    if (!normalizedAccountNumber) {
      setError("Invalid account number.");
      setAccount(null);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      const [profileResponse, transactionsResponse] = await Promise.all([
        fetch("/api/Accounts/info", {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch("/api/Transaction/history", {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        }),
      ]);

      if (!profileResponse.ok) {
        setError(await readErrorMessage(profileResponse, "Could not load account."));
        setAccount(null);
        setTransactions([]);
        return;
      }

      const profilePayload = await profileResponse.json().catch(() => null);
      const mappedAccounts = extractAccountList(profilePayload).map(mapAccount);
      const selected = mappedAccounts.find((item) => item.accountNumber === normalizedAccountNumber);

      if (!selected) {
        setError("Account was not found.");
        setAccount(null);
        setTransactions([]);
        return;
      }

      setAccount(selected);

      if (!transactionsResponse.ok) {
        setError(await readErrorMessage(transactionsResponse, "Could not load transaction history."));
        setTransactions([]);
        return;
      }

      const transactionsPayload = await transactionsResponse.json().catch(() => []);
      setTransactions(Array.isArray(transactionsPayload) ? transactionsPayload : []);
    } catch {
      setError("Could not load account details.");
      setAccount(null);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedAccountNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const transactionRows = useMemo(() => {
    if (!normalizedAccountNumber) {
      return [];
    }

    return transactions
      .filter((item) => {
        const from = String(pick(item, "fromAccountNumber", "FromAccountNumber") || "").trim();
        const to = String(pick(item, "toAccountNumber", "ToAccountNumber") || "").trim();

        if (from || to) {
          return from === normalizedAccountNumber || to === normalizedAccountNumber;
        }

        return true;
      })
      .slice(0, 80)
      .map((item) => {
        const from = String(pick(item, "fromAccountNumber", "FromAccountNumber") || "").trim();
        const to = String(pick(item, "toAccountNumber", "ToAccountNumber") || "").trim();
        const amount = Number(pick(item, "amount", "Amount"));
        const safeAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;
        const incoming = to === normalizedAccountNumber;
        const counterparty = incoming ? from || item.counterpartyAccount : to || item.counterpartyAccount;

        return {
          id: pick(item, "id", "Id") || `${item.date}-${item.description}`,
          date: formatDate(pick(item, "date", "Date"), true),
          counterparty: counterparty || "--",
          description: pick(item, "description", "Description") || "Transaction",
          amount: `${incoming ? "+" : "-"}${formatMoney(safeAmount, account?.currency || "CZK", 2)}`,
          incoming,
        };
      });
  }, [transactions, normalizedAccountNumber, account?.currency]);

  const handleExportPdf = async () => {
    setExportError("");
    setExportMessage("");

    if (transactionRows.length === 0) {
      setExportError("There is nothing to export for this account.");
      return;
    }

    setIsExportingPdf(true);

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const marginX = 34;
      let y = 42;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Account statement", marginX, y);
      y += 22;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Account: ${account?.accountNumber || normalizedAccountNumber}`, marginX, y);
      y += 16;
      doc.text(`Generated: ${new Date().toLocaleString("cs-CZ")}`, marginX, y);
      y += 24;

      const cols = [
        { key: "date", label: "Date", width: 118 },
        { key: "counterparty", label: "Counterparty", width: 142 },
        { key: "description", label: "Description", width: 220 },
        { key: "amount", label: "Amount", width: 80 },
      ];

      const drawHeader = () => {
        let x = marginX;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        cols.forEach((col) => {
          doc.rect(x, y, col.width, 22);
          doc.text(col.label, x + 6, y + 15);
          x += col.width;
        });
        y += 22;
      };

      drawHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      transactionRows.slice(0, 200).forEach((row) => {
        if (y > 780) {
          doc.addPage();
          y = 42;
          drawHeader();
        }

        let x = marginX;
        cols.forEach((col) => {
          doc.rect(x, y, col.width, 20);
          doc.text(String(row[col.key] || ""), x + 5, y + 13, { maxWidth: col.width - 10 });
          x += col.width;
        });
        y += 20;
      });

      const safeAccount = String(account?.accountNumber || normalizedAccountNumber || "account").replace(/[^\w-]/g, "");
      doc.save(`statement-${safeAccount}-${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportMessage("PDF was generated.");
    } catch {
      setExportError("PDF export failed.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <PageScaffold
      title="Account details"
      description={account?.accountNumber || normalizedAccountNumber || "--"}
      actions={
        <>
          <Button variant="outline" onClick={() => navigate("/accounts")}>
            <ArrowLeft className="size-4" />
            Accounts
          </Button>
          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        </>
      }
    >
      {isLoading && <StateMessage>Loading account data...</StateMessage>}
      {!isLoading && error && <StateMessage type="error">{error}</StateMessage>}

      {!isLoading && !error && account && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Balance</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(account.balance, account.currency, 2)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Currency</CardDescription>
                <CardTitle className="text-2xl">{account.currencyCode}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Type</CardDescription>
                <CardTitle className="text-2xl">{account.type || "--"}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Status</CardDescription>
                <CardTitle>
                  <Badge variant={account.isFrozen ? "destructive" : "secondary"}>
                    {account.isFrozen ? "Frozen" : "Active"}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Transfer money, convert between own accounts, or export a statement.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate(`/payments?from=${encodeURIComponent(normalizedAccountNumber)}`)} disabled={!account}>
                  <Send className="size-4" />
                  Transfer
                </Button>
                <Button variant="outline" onClick={() => navigate(`/accounts/${encodeURIComponent(normalizedAccountNumber)}/conversion`)} disabled={!account}>
                  <Repeat2 className="size-4" />
                  Conversion
                </Button>
                <Button variant="outline" onClick={handleExportPdf} disabled={isExportingPdf || transactionRows.length === 0}>
                  <Download className="size-4" />
                  {isExportingPdf ? "Exporting..." : "PDF"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {exportError && <StateMessage type="error">{exportError}</StateMessage>}
              {exportMessage && <StateMessage type="success">{exportMessage}</StateMessage>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction history</CardTitle>
              <CardDescription>Showing the latest transactions associated with this account.</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions are available for this account.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Counterparty</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionRows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.counterparty}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.date}</TableCell>
                        <TableCell className={item.incoming ? "text-right font-medium text-emerald-600" : "text-right font-medium"}>
                          {item.amount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageScaffold>
  );
}
