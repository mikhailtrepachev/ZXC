"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  Clock,
  Newspaper,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { PageScaffold } from "../components/PageScaffold";

const categories = [
  { id: "all", label: "All" },
  { id: "markets", label: "Markets" },
  { id: "banking", label: "Banking" },
  { id: "macro", label: "Macro" },
  { id: "technology", label: "Technology" },
];

const newsItems = [
  {
    id: 1,
    category: "markets",
    title: "European equities trade cautiously as yields stay in focus",
    summary:
      "Investors are balancing resilient earnings with higher funding costs, keeping large-cap defensives and banks in the spotlight.",
    source: "ZXC Research",
    time: "08:40",
    readTime: "3 min",
    impact: "Medium",
    sentiment: "neutral",
  },
  {
    id: 2,
    category: "banking",
    title: "Retail banks lean into digital servicing and lower branch costs",
    summary:
      "Cost control remains a priority across consumer banking, with mobile onboarding, payment automation, and card self-service drawing investment.",
    source: "Banking Desk",
    time: "09:15",
    readTime: "4 min",
    impact: "High",
    sentiment: "positive",
  },
  {
    id: 3,
    category: "macro",
    title: "Central-bank guidance keeps currency volatility elevated",
    summary:
      "Rate-path uncertainty is feeding sharper intraday moves in major FX pairs, especially where inflation data remains uneven.",
    source: "Macro Brief",
    time: "10:05",
    readTime: "2 min",
    impact: "High",
    sentiment: "neutral",
  },
  {
    id: 4,
    category: "technology",
    title: "Payment security spending rises as fraud checks move in real time",
    summary:
      "Banks are prioritizing transaction scoring, device fingerprinting, and instant notifications across card and transfer flows.",
    source: "Fintech Wire",
    time: "10:35",
    readTime: "5 min",
    impact: "Medium",
    sentiment: "positive",
  },
  {
    id: 5,
    category: "markets",
    title: "Energy and financials lead sector rotation in early trading",
    summary:
      "Portfolio managers are rotating toward cash-generative sectors while trimming more rate-sensitive growth exposure.",
    source: "Market Desk",
    time: "11:10",
    readTime: "3 min",
    impact: "Low",
    sentiment: "positive",
  },
  {
    id: 6,
    category: "banking",
    title: "Deposit competition keeps pressure on net interest margins",
    summary:
      "Higher savings rates are improving customer retention but narrowing spreads for lenders with slower loan growth.",
    source: "Credit Monitor",
    time: "11:45",
    readTime: "4 min",
    impact: "Medium",
    sentiment: "negative",
  },
];

const marketSnapshot = [
  { label: "Bank index", value: "+0.8%", trend: "up" },
  { label: "EUR/CZK", value: "24.91", trend: "flat" },
  { label: "USD/CZK", value: "23.32", trend: "down" },
  { label: "10Y yield", value: "4.12%", trend: "up" },
];

function sentimentClasses(sentiment) {
  if (sentiment === "positive") {
    return "text-emerald-600";
  }

  if (sentiment === "negative") {
    return "text-destructive";
  }

  return "text-muted-foreground";
}

function TrendIcon({ trend }) {
  if (trend === "down") {
    return <TrendingDown className="size-4 text-destructive" />;
  }

  return <TrendingUp className={trend === "up" ? "size-4 text-emerald-600" : "size-4 text-muted-foreground"} />;
}

export default function FinancialNewsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [impactFilter, setImpactFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(newsItems[0].id);
  const [savedIds, setSavedIds] = useState([]);

  const filteredNews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return newsItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const matchesImpact = impactFilter === "all" || item.impact.toLowerCase() === impactFilter;
      const matchesQuery =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.summary.toLowerCase().includes(normalizedQuery) ||
        item.source.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesImpact && matchesQuery;
    });
  }, [activeCategory, impactFilter, query]);

  const selectedArticle = useMemo(
    () => newsItems.find((item) => item.id === selectedId) || filteredNews[0] || newsItems[0],
    [filteredNews, selectedId],
  );
  const selectedArticleSaved = savedIds.includes(selectedArticle.id);

  const toggleSavedArticle = () => {
    setSavedIds((previous) =>
      previous.includes(selectedArticle.id)
        ? previous.filter((id) => id !== selectedArticle.id)
        : [...previous, selectedArticle.id],
    );
  };

  return (
    <PageScaffold
      title="Financial news"
      description="Market briefings, banking updates, and macro signals for ZXC Bank clients."
      actions={
        <Button
          variant="outline"
          onClick={() => {
            setQuery("");
            setActiveCategory("all");
            setImpactFilter("all");
          }}
        >
          <Newspaper className="size-4" />
          Reset feed
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <Badge variant="secondary">Market briefing</Badge>
                  <CardTitle className="max-w-3xl text-2xl">{selectedArticle.title}</CardTitle>
                  <CardDescription className="max-w-3xl">{selectedArticle.summary}</CardDescription>
                </div>
                <div className="grid min-w-36 gap-1 text-sm text-muted-foreground lg:text-right">
                  <span className="inline-flex items-center gap-2 lg:justify-end">
                    <CalendarDays className="size-4" />
                    Apr 27, 2026
                  </span>
                  <span className="inline-flex items-center gap-2 lg:justify-end">
                    <Clock className="size-4" />
                    {selectedArticle.time}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="mt-1 font-semibold">{selectedArticle.source}</p>
                </div>
                <div className="border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Impact</p>
                  <p className="mt-1 font-semibold">{selectedArticle.impact}</p>
                </div>
                <div className="border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Read time</p>
                  <p className="mt-1 font-semibold">{selectedArticle.readTime}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={toggleSavedArticle}>
                  {selectedArticleSaved ? "Saved" : "Save brief"}
                </Button>
                {savedIds.length > 0 && <Badge variant="secondary">{savedIds.length} saved</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                  <TabsList className="h-auto flex-wrap justify-start">
                    {categories.map((category) => (
                      <TabsTrigger key={category.id} value={category.id}>
                        {category.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search news..."
                      className="pl-7"
                    />
                  </div>
                  <Select value={impactFilter} onValueChange={setImpactFilter}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="Impact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All impact</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {filteredNews.length === 0 && (
                <p className="border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">No news match this filter.</p>
              )}

              {filteredNews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`grid gap-4 border p-4 text-left transition-colors hover:bg-muted/50 ${
                    selectedArticle.id === item.id ? "bg-muted/50 ring-1 ring-primary/30" : "bg-background"
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{item.category}</Badge>
                    <span>{item.source}</span>
                    <span>{item.time}</span>
                    <span>{item.readTime}</span>
                  </span>
                  <span className="grid gap-2">
                    <strong className="text-base">{item.title}</strong>
                    <span className="text-sm leading-relaxed text-muted-foreground">{item.summary}</span>
                  </span>
                  <span className="flex items-center justify-between gap-4 text-sm">
                    <span>Impact: {item.impact}</span>
                    <span className={sentimentClasses(item.sentiment)}>{item.sentiment}</span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle>Market snapshot</CardTitle>
              <CardDescription>Intraday indicators for quick scanning.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {marketSnapshot.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendIcon trend={item.trend} />
                    {item.label}
                  </span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banking watchlist</CardTitle>
              <CardDescription>Topics most relevant to accounts, transfers, cards, and investments.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {["Rate sensitivity", "Card fraud controls", "Deposit pricing", "Digital onboarding"].map((item) => (
                <div key={item} className="flex items-center justify-between gap-3 border bg-muted/20 px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Banknote className="size-4 text-muted-foreground" />
                    {item}
                  </span>
                  <Badge variant="secondary">Watch</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editorial note</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>Market commentary is informational and reflects a compact editorial brief.</p>
              <Separator />
              <p>Nothing here is investment advice.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}
