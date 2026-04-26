"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PageScaffold } from "../components/PageScaffold";

const PURPOSE_OPTIONS = [
  { id: "cash", label: "Quick cash loan", baseRate: 5.4 },
  { id: "car", label: "Car loan", baseRate: 4.9 },
  { id: "home", label: "Home renovation", baseRate: 4.3 },
  { id: "education", label: "Education", baseRate: 4.6 },
];

const MIN_AMOUNT = 50000;
const MAX_AMOUNT = 2500000;
const MIN_TERM = 12;
const MAX_TERM = 240;
const TERM_STEP = 6;

function calculateMonthlyPayment(amount, annualRate, months) {
  const monthlyRate = annualRate / 12 / 100;

  if (monthlyRate === 0) {
    return amount / months;
  }

  const denominator = 1 - (1 + monthlyRate) ** -months;
  return (amount * monthlyRate) / denominator;
}

function formatCzk(value) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTerm(months) {
  const years = months / 12;
  return `${Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1)} years`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function LoansPage() {
  const [amount, setAmount] = useState(500000);
  const [termMonths, setTermMonths] = useState(36);
  const [purpose, setPurpose] = useState("home");
  const [withInsurance, setWithInsurance] = useState(true);

  const selectedPurpose = PURPOSE_OPTIONS.find((item) => item.id === purpose) ?? PURPOSE_OPTIONS[0];

  const result = useMemo(() => {
    const termRateAdjust = termMonths > 72 ? 0.8 : termMonths > 48 ? 0.45 : termMonths < 24 ? 0.35 : 0;
    const amountRateAdjust = amount < 120000 ? 0.7 : amount > 900000 ? -0.25 : 0;
    const annualRate = Math.max(3.9, Number((selectedPurpose.baseRate + termRateAdjust + amountRateAdjust).toFixed(2)));
    const monthlyPayment = calculateMonthlyPayment(amount, annualRate, termMonths);
    const insuranceMonthly = withInsurance ? monthlyPayment * 0.09 : 0;
    const monthlyWithInsurance = monthlyPayment + insuranceMonthly;
    const processingFee = amount * 0.012;
    const rpsn = annualRate + (processingFee / amount) * (12 / termMonths) * 100 + (withInsurance ? 0.7 : 0.12);
    const totalPaid = monthlyWithInsurance * termMonths + processingFee;

    return { monthlyPayment, insuranceMonthly, monthlyWithInsurance, annualRate, rpsn, totalPaid };
  }, [amount, termMonths, selectedPurpose.baseRate, withInsurance]);

  return (
    <PageScaffold title="Loan calculator" description="Estimate monthly payment, annual rate, APR, insurance, and total repayment.">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
            <CardDescription>Adjust amount, term, purpose, and optional insurance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="loan-amount">Amount</Label>
                <strong>{formatCzk(amount)}</strong>
              </div>
              <input
                id="loan-amount"
                type="range"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={10000}
                value={amount}
                onChange={(event) => setAmount(clamp(Number(event.target.value), MIN_AMOUNT, MAX_AMOUNT))}
                className="accent-primary"
              />
              <Input type="number" min={MIN_AMOUNT} max={MAX_AMOUNT} step={10000} value={amount} onChange={(event) => setAmount(clamp(Number(event.target.value) || MIN_AMOUNT, MIN_AMOUNT, MAX_AMOUNT))} />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="loan-term">Term</Label>
                <strong>{formatTerm(termMonths)}</strong>
              </div>
              <input
                id="loan-term"
                type="range"
                min={MIN_TERM}
                max={MAX_TERM}
                step={TERM_STEP}
                value={termMonths}
                onChange={(event) => setTermMonths(clamp(Number(event.target.value), MIN_TERM, MAX_TERM))}
                className="accent-primary"
              />
            </div>

            <div className="grid gap-2">
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={withInsurance} onCheckedChange={(value) => setWithInsurance(Boolean(value))} />
              Include estimated monthly insurance
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Calculator className="size-6" />
            </div>
            <CardTitle className="text-3xl">{formatCzk(result.monthlyPayment)}</CardTitle>
            <CardDescription>Estimated monthly payment</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {[
              ["With insurance", formatCzk(result.monthlyWithInsurance)],
              ["Annual rate from", `${result.annualRate.toFixed(2)} %`],
              ["APR from", `${result.rpsn.toFixed(2)} %`],
              ["Insurance monthly", formatCzk(result.insuranceMonthly)],
              ["Total paid", formatCzk(result.totalPaid)],
            ].map(([label, value]) => (
              <p key={label} className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <strong>{value}</strong>
              </p>
            ))}
            <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              This calculator is indicative only and does not represent a binding offer.
            </p>
            <Button>Continue application</Button>
          </CardContent>
        </Card>
      </div>
    </PageScaffold>
  );
}
