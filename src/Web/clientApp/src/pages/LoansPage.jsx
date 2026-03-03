import { useMemo, useState } from "react";
import "./LoansPage.css";

const PURPOSE_OPTIONS = [
  { id: "cash", label: "Minutová půjčka", baseRate: 5.4 },
  { id: "car", label: "Půjčka na auto", baseRate: 4.9 },
  { id: "home", label: "Úvěr na rekonstrukci", baseRate: 4.3 },
  { id: "education", label: "Vzdělání", baseRate: 4.6 },
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

  let yearLabel = "let";
  if (Number(rounded) === 1) yearLabel = "rok";
  else if (Number(rounded) > 1 && Number(rounded) < 5) yearLabel = "roky";

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
          <p className="loan-eyebrow">Kalkulačka úvěru</p>
          <h1>Spočítejte si svou měsíční splátku</h1>
          <p className="loan-intro">
            Upravte částku, dobu splácení a účel úvěru pro rychlý orientační
            výpočet před podáním žádosti.
          </p>

          <div className="field-group">
            <div className="field-header">
              <label htmlFor="loan-amount">Částka</label>
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
              <label htmlFor="loan-term">Doba splácení</label>
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
              <label htmlFor="loan-purpose">Účel úvěru</label>
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
            Zahrnout odhad měsíčního pojištění
          </label>
        </div>

        <aside className="loan-result-panel" aria-live="polite">
          <p className="loan-result-title">Odhadované výsledky</p>
          <p className="loan-main-value">{formatCzk(result.monthlyPayment)}</p>
          <p className="loan-main-label">Odhadovaná měsíční splátka</p>

          <dl className="loan-metrics">
            <div>
              <dt>Měsíční splátka s pojištěním</dt>
              <dd>{formatCzk(result.monthlyWithInsurance)}</dd>
            </div>
            <div>
              <dt>Roční úroková sazba od</dt>
              <dd>{result.annualRate.toFixed(2)} %</dd>
            </div>
            <div>
              <dt>Odhadované RPSN od</dt>
              <dd>{result.rpsn.toFixed(2)} %</dd>
            </div>
            <div>
              <dt>Pojištění úvěru (měsíčně)</dt>
              <dd>{formatCzk(result.insuranceMonthly)}</dd>
            </div>
            <div>
              <dt>Celkem zaplatíte</dt>
              <dd>{formatCzk(result.totalPaid)}</dd>
            </div>
          </dl>

          <p className="loan-note">
            Tato kalkulačka poskytuje pouze orientační výpočet a nepředstavuje
            závaznou nabídku. Konečná úroková sazba závisí na výsledku posouzení
            úvěruschopnosti a smluvních podmínkách.
          </p>
        </aside>
      </section>
    </main>
  );
}
