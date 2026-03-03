import { useMemo, useState } from "react";
import "./LoansPage.css";

const PURPOSE_OPTIONS = [
  { id: "cash", label: "Cash loan", baseRate: 5.4 },
  { id: "car", label: "Car purchase", baseRate: 4.9 },
  { id: "home", label: "Home improvement", baseRate: 4.3 },
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
  const rounded = Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1);
  const yearLabel = Number(rounded) === 1 ? "year" : "years";
  return `${rounded} ${yearLabel}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function LoansPage() {
  const [amount, setAmount] = useState(500000);
  const [termMonths, setTermMonths] = useState(36);
  const [purpose, setPurpose] = useState("home");
  const [withInsurance, setWithInsurance] = useState(true);

  const selectedPurpose =
    PURPOSE_OPTIONS.find((item) => item.id === purpose) ?? PURPOSE_OPTIONS[0];

  const result = useMemo(() => {
    const termRateAdjust =
      termMonths > 72
        ? 0.8
        : termMonths > 48
          ? 0.45
          : termMonths < 24
            ? 0.35
            : 0;

    const amountRateAdjust =
      amount < 120000 ? 0.7 : amount > 900000 ? -0.25 : 0;

    const annualRate = Math.max(
      3.9,
      Number(
        (selectedPurpose.baseRate + termRateAdjust + amountRateAdjust).toFixed(
          2,
        ),
      ),
    );

    const monthlyPayment = calculateMonthlyPayment(
      amount,
      annualRate,
      termMonths,
    );
    const insuranceMonthly = withInsurance ? monthlyPayment * 0.09 : 0;
    const monthlyWithInsurance = monthlyPayment + insuranceMonthly;

    const processingFee = amount * 0.012;
    const rpsn =
      annualRate +
      (processingFee / amount) * (12 / termMonths) * 100 +
      (withInsurance ? 0.7 : 0.12);

    const totalPaid = monthlyWithInsurance * termMonths + processingFee;

    return {
      monthlyPayment,
      insuranceMonthly,
      monthlyWithInsurance,
      annualRate,
      rpsn,
      totalPaid,
    };
  }, [amount, termMonths, selectedPurpose.baseRate, withInsurance]);

  return (
    <main className="loan-page">
      <section className="loan-calculator">
        <div className="loan-input-panel">
          <p className="loan-eyebrow">Loan calculator</p>
          <h1>Estimate your monthly payment</h1>
          <p className="loan-intro">
            Adjust amount, term and purpose to get a quick estimate before
            applying.
          </p>

          <div className="field-group">
            <div className="field-header">
              <label htmlFor="loan-amount">Amount</label>
              <span>{formatCzk(amount)}</span>
            </div>
            <input
              id="loan-amount"
              type="range"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step={10000}
              value={amount}
              onChange={(event) =>
                setAmount(
                  clamp(Number(event.target.value), MIN_AMOUNT, MAX_AMOUNT),
                )
              }
            />
            <input
              className="field-number"
              type="number"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step={10000}
              value={amount}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isNaN(next)) return;
                setAmount(clamp(next, MIN_AMOUNT, MAX_AMOUNT));
              }}
            />
          </div>

          <div className="field-group">
            <div className="field-header">
              <label htmlFor="loan-term">Term</label>
              <span>{formatTerm(termMonths)}</span>
            </div>
            <input
              id="loan-term"
              type="range"
              min={MIN_TERM}
              max={MAX_TERM}
              step={TERM_STEP}
              value={termMonths}
              onChange={(event) =>
                setTermMonths(
                  clamp(Number(event.target.value), MIN_TERM, MAX_TERM),
                )
              }
            />
          </div>

          <div className="field-group">
            <div className="field-header">
              <label htmlFor="loan-purpose">Purpose</label>
            </div>
            <select
              id="loan-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
            >
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="insurance-toggle" htmlFor="loan-insurance">
            <input
              id="loan-insurance"
              type="checkbox"
              checked={withInsurance}
              onChange={(event) => setWithInsurance(event.target.checked)}
            />
            Include monthly insurance estimate
          </label>
        </div>

        <aside className="loan-result-panel" aria-live="polite">
          <p className="loan-result-title">Estimated results</p>
          <p className="loan-main-value">{formatCzk(result.monthlyPayment)}</p>
          <p className="loan-main-label">Estimated monthly payment</p>

          <dl className="loan-metrics">
            <div>
              <dt>Monthly payment with insurance</dt>
              <dd>{formatCzk(result.monthlyWithInsurance)}</dd>
            </div>
            <div>
              <dt>Annual interest rate from</dt>
              <dd>{result.annualRate.toFixed(2)} %</dd>
            </div>
            <div>
              <dt>Estimated RPSN from</dt>
              <dd>{result.rpsn.toFixed(2)} %</dd>
            </div>
            <div>
              <dt>Loan insurance (monthly)</dt>
              <dd>{formatCzk(result.insuranceMonthly)}</dd>
            </div>
            <div>
              <dt>Total amount paid</dt>
              <dd>{formatCzk(result.totalPaid)}</dd>
            </div>
          </dl>

          <p className="loan-note">
            This calculator provides an approximate estimate only and is not a
            binding offer. Final rate depends on credit scoring and contract
            details.
          </p>
        </aside>
      </section>
    </main>
  );
}
