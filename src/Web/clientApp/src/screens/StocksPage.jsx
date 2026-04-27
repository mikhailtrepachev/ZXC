"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Search, ShoppingCart, TrendingUp } from "lucide-react";
import { useNavigate } from "../routing";
import { Badge } from "../components/ui/badge";
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
  pick,
  readErrorMessage,
} from "../lib/bank";

function mapStock(rawItem) {
  return {
    id: Number(pick(rawItem, "id", "Id")),
    tickerName: String(pick(rawItem, "tickerName", "TickerName", "ticker", "Ticker") || "").trim().toUpperCase(),
    companyName: String(pick(rawItem, "companyName", "CompanyName", "name", "Name") || "").trim(),
    price: Number(pick(rawItem, "price", "Price", "currentPrice", "CurrentPrice")) || 0,
  };
}

function mapPortfolioItem(rawItem) {
  const quantity = Number(pick(rawItem, "quantity", "Quantity")) || 0;
  const averagePurchasePrice = Number(pick(rawItem, "averagePurchasePrice", "AveragePurchasePrice")) || 0;
  const currentPrice = Number(pick(rawItem, "currentPrice", "CurrentPrice")) || averagePurchasePrice;

  return {
    tickerName: String(pick(rawItem, "tickerName", "TickerName", "ticker", "Ticker") || "").trim().toUpperCase(),
    companyName: String(pick(rawItem, "companyName", "CompanyName", "name", "Name") || "").trim(),
    quantity,
    averagePurchasePrice,
    currentPrice,
    marketValue: Number(pick(rawItem, "marketValue", "MarketValue")) || currentPrice * quantity,
    gainLoss: Number(pick(rawItem, "gainLoss", "GainLoss")) || (currentPrice - averagePurchasePrice) * quantity,
  };
}

function mapAccountForStocks(rawItem) {
  const mapped = mapAccount(rawItem);
  const accountId = Number(pick(rawItem, "id", "Id"));

  return {
    ...mapped,
    id: Number.isFinite(accountId) ? accountId : null,
  };
}

function accountOptionLabel(account) {
  const tail = String(account.accountNumber || "").slice(-4);
  return `${account.label || account.type || "Account"} (*${tail}) - ${formatMoney(account.balance, account.currency)}`;
}

function extractListPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.Items)) {
    return payload.Items;
  }

  return [];
}

export default function StocksPage() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [buyError, setBuyError] = useState("");
  const [buySuccess, setBuySuccess] = useState("");

  const accounts = useMemo(
    () =>
      extractAccountList(profile)
        .map(mapAccountForStocks)
        .filter((account) => !account.isFrozen && Number.isFinite(account.id)),
    [profile],
  );
  const selectedStock = useMemo(
    () => stocks.find((stock) => stock.tickerName === selectedTicker) || null,
    [selectedTicker, stocks],
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => String(account.id) === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );
  const quantityValue = Number(quantity);
  const buyQuantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 0;
  const activePrice = Number(quote?.currentPrice) > 0 ? Number(quote.currentPrice) : selectedStock?.price || 0;
  const totalCost = activePrice * buyQuantity;
  const filteredStocks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return stocks;
    }

    return stocks.filter(
      (stock) =>
        stock.tickerName.toLowerCase().includes(normalized) ||
        stock.companyName.toLowerCase().includes(normalized),
    );
  }, [query, stocks]);

  const loadStocksData = async () => {
    setError("");
    setIsLoading(true);

    try {
      const [stocksResponse, portfolioResponse, profileResponse] = await Promise.all([
        fetch("/api/Stocks/list?pageNumber=1&pageSize=50", {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch("/api/Stocks/portfolio", {
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

      const errors = [];

      if (stocksResponse.ok) {
        const stocksPayload = await stocksResponse.json().catch(() => []);
        setStocks(extractListPayload(stocksPayload).map(mapStock).filter((item) => item.tickerName));
      } else {
        errors.push(await readErrorMessage(stocksResponse, "Could not load stocks."));
        setStocks([]);
      }

      if (portfolioResponse.ok) {
        const portfolioPayload = await portfolioResponse.json().catch(() => []);
        setPortfolio(extractListPayload(portfolioPayload).map(mapPortfolioItem).filter((item) => item.tickerName));
      } else {
        errors.push(await readErrorMessage(portfolioResponse, "Could not load portfolio."));
        setPortfolio([]);
      }

      if (profileResponse.ok) {
        setProfile(await profileResponse.json().catch(() => null));
      } else {
        errors.push(await readErrorMessage(profileResponse, "Could not load accounts."));
        setProfile(null);
      }

      setError(errors[0] || "");
    } catch {
      setError("Could not load stocks.");
      setStocks([]);
      setPortfolio([]);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStocksData();
  }, []);

  useEffect(() => {
    if (!selectedTicker && stocks.length > 0) {
      setSelectedTicker(stocks[0].tickerName);
    }
  }, [selectedTicker, stocks]);

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(String(accounts[0].id));
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    setQuote(null);
    setQuoteError("");
  }, [selectedTicker]);

  const loadQuote = async () => {
    if (!selectedTicker) {
      return;
    }

    setQuoteError("");
    setIsQuoteLoading(true);

    try {
      const response = await fetch(`/api/Stocks/${encodeURIComponent(selectedTicker)}`, {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setQuoteError(await readErrorMessage(response, "Live quote is unavailable."));
        return;
      }

      setQuote(await response.json().catch(() => null));
    } catch {
      setQuoteError("Live quote is unavailable.");
    } finally {
      setIsQuoteLoading(false);
    }
  };

  const handleBuyStock = async (event) => {
    event.preventDefault();
    setBuyError("");
    setBuySuccess("");

    if (!selectedStock) {
      setBuyError("Select a stock.");
      return;
    }

    if (!selectedAccount) {
      setBuyError("Select a funding account.");
      return;
    }

    if (buyQuantity <= 0) {
      setBuyError("Quantity must be positive.");
      return;
    }

    if (totalCost > selectedAccount.balance) {
      setBuyError("Insufficient funds for this order.");
      return;
    }

    setIsBuying(true);

    try {
      const response = await fetch("/api/Stocks/buy", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          accountId: selectedAccount.id,
          tickerName: selectedStock.tickerName,
          quantity: buyQuantity,
        }),
      });

      if (!response.ok) {
        setBuyError(await readErrorMessage(response, "Stock order failed."));
        return;
      }

      setBuySuccess(`Bought ${buyQuantity} ${selectedStock.tickerName}.`);
      setQuantity("1");
      await loadStocksData();
    } catch {
      setBuyError("Stock order failed.");
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <PageScaffold
      title="Stocks"
      description="Search available securities, review your portfolio, and place buy orders through the backend."
      actions={
        <>
          <Button variant="outline" onClick={() => navigate("/payments")}>
            <ArrowLeft className="size-4" />
            Payments
          </Button>
          <Button variant="outline" onClick={loadStocksData} disabled={isLoading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </>
      }
    >
      {error && <StateMessage type="error">{error}</StateMessage>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="grid gap-6 pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search holdings or tickers..."
                  className="pl-9"
                />
              </div>

              <Badge variant="outline">{filteredStocks.length} stocks</Badge>
            </div>

            <div className="grid gap-3">
              {isLoading && <p className="border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">Loading stocks...</p>}
              {!isLoading && filteredStocks.length === 0 && (
                <p className="border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">No stocks match this search.</p>
              )}

              {!isLoading &&
                filteredStocks.map((stock) => (
                  <button
                    key={stock.tickerName}
                    type="button"
                    onClick={() => setSelectedTicker(stock.tickerName)}
                    className="grid gap-4 border bg-muted/30 p-4 text-left transition-colors hover:bg-muted sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <span className="flex size-14 items-center justify-center border bg-background font-heading text-base font-semibold">
                      {stock.tickerName}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-heading text-sm font-semibold uppercase tracking-wider">
                        {stock.companyName}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">Backend market list</span>
                    </span>
                    <span className="flex items-end justify-between gap-6 sm:flex-col sm:justify-center sm:text-right">
                      <Badge variant={selectedTicker === stock.tickerName ? "default" : "outline"}>Stock</Badge>
                      <span>
                        <span className="block text-xs uppercase tracking-widest text-muted-foreground">Price</span>
                        <strong>{formatMoney(stock.price, "Dollar", 2)}</strong>
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Buy stock</CardTitle>
              <CardDescription>Orders use the selected backend account balance.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleBuyStock}>
                <div className="grid gap-2">
                  <Label>Stock</Label>
                  <Select value={selectedTicker} onValueChange={setSelectedTicker} disabled={isLoading || isBuying}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ticker" />
                    </SelectTrigger>
                    <SelectContent>
                      {stocks.map((stock) => (
                        <SelectItem key={stock.tickerName} value={stock.tickerName}>
                          {stock.tickerName} - {stock.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Funding account</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={isLoading || isBuying}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {accountOptionLabel(account)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="stockQuantity">Quantity</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    disabled={isBuying}
                  />
                </div>

                <div className="grid gap-3 bg-muted/40 p-4 text-sm">
                  <p className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Ticker</span>
                    <strong>{selectedStock?.tickerName || "--"}</strong>
                  </p>
                  <p className="flex justify-between gap-4 border-t pt-3">
                    <span className="text-muted-foreground">Price</span>
                    <strong>{formatMoney(activePrice, "Dollar", 2)}</strong>
                  </p>
                  {quote && (
                    <p className="flex justify-between gap-4 border-t pt-3">
                      <span className="text-muted-foreground">Change</span>
                      <strong>{Number(quote.changePercent || 0).toFixed(2)}%</strong>
                    </p>
                  )}
                  <p className="flex justify-between gap-4 border-t pt-3">
                    <span>Total order</span>
                    <strong>{formatMoney(totalCost, "Dollar", 2)}</strong>
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={loadQuote} disabled={!selectedTicker || isQuoteLoading}>
                    <TrendingUp className="size-4" />
                    {isQuoteLoading ? "Loading..." : "Live quote"}
                  </Button>
                  <Button type="submit" disabled={isBuying || !selectedStock || !selectedAccount}>
                    <ShoppingCart className="size-4" />
                    {isBuying ? "Buying..." : "Buy"}
                  </Button>
                </div>

                {quoteError && <StateMessage type="warning">{quoteError}</StateMessage>}
                {buyError && <StateMessage type="error">{buyError}</StateMessage>}
                {buySuccess && <StateMessage type="success">{buySuccess}</StateMessage>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio</CardTitle>
              <CardDescription>Loaded from `/api/Stocks/portfolio`.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {portfolio.length === 0 && (
                <p className="text-sm text-muted-foreground">No positions yet. Buy a stock to create one.</p>
              )}
              {portfolio.map((item) => (
                <div key={item.tickerName} className="grid gap-1 border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{item.tickerName}</strong>
                    <span>{formatMoney(item.marketValue, "Dollar", 2)}</span>
                  </div>
                  <p className="truncate text-muted-foreground">{item.companyName}</p>
                  <p className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.quantity} shares</span>
                    <span className={item.gainLoss >= 0 ? "text-emerald-600" : "text-destructive"}>
                      {formatMoney(item.gainLoss, "Dollar", 2)}
                    </span>
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}
