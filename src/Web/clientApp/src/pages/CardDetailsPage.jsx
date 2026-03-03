import { useMemo, useState } from "react";
import "./CardDetailsPage.css";

const tabs = [
  { id: "transactions", label: "Transaction history" },
  { id: "security", label: "Card details" },
  { id: "limits", label: "Card limits" },
  { id: "profile", label: "Card profile" },
];

const transactions = [
  {
    id: 1,
    merchant: "Amazon",
    date: "Mar 2, 2026",
    amount: "- $84.99",
    status: "Completed",
  },
  {
    id: 2,
    merchant: "Starbucks",
    date: "Mar 1, 2026",
    amount: "- $6.20",
    status: "Completed",
  },
  {
    id: 3,
    merchant: "Salary payout",
    date: "Feb 29, 2026",
    amount: "+ $2,300.00",
    status: "Incoming",
  },
  {
    id: 4,
    merchant: "Netflix",
    date: "Feb 27, 2026",
    amount: "- $14.99",
    status: "Completed",
  },
];

const cardDetails = [
  { label: "Card number", value: "4587 9921 7003 4418" },
  { label: "Valid to", value: "11/29" },
  { label: "CVC", value: "761" },
  { label: "Card holder", value: "Jane Doe" },
];

const cardLimits = [
  { name: "ATM withdrawal", used: 350, max: 1000, currency: "$" },
  { name: "Online payments", used: 1240, max: 3000, currency: "$" },
  { name: "POS payments", used: 760, max: 2500, currency: "$" },
];

const cardProfile = [
  { label: "Card type", value: "Physical" },
  { label: "Linked to", value: "Main Account: 8891 0022" },
  { label: "Card name", value: "Daily Expenses" },
];

function TransactionsTab() {
  return (
    <section className="card-details-panel">
      <h2>Transaction history</h2>
      <div className="card-details-list">
        {transactions.map((tx) => (
          <article className="tx-row" key={tx.id}>
            <div>
              <p className="tx-merchant">{tx.merchant}</p>
              <p className="tx-date">{tx.date}</p>
            </div>
            <div className="tx-right">
              <p
                className={`tx-amount ${tx.amount.startsWith("+") ? "incoming" : "outgoing"}`}
              >
                {tx.amount}
              </p>
              <p className="tx-status">{tx.status}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InfoGrid({ title, items }) {
  return (
    <section className="card-details-panel">
      <h2>{title}</h2>
      <div className="info-grid">
        {items.map((item) => (
          <article className="info-card" key={item.label}>
            <p className="info-label">{item.label}</p>
            <p className="info-value">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LimitsTab() {
  return (
    <section className="card-details-panel">
      <h2>Card limits</h2>
      <div className="limits-list">
        {cardLimits.map((limit) => {
          const percent = Math.round((limit.used / limit.max) * 100);

          return (
            <article className="limit-card" key={limit.name}>
              <div className="limit-header">
                <p>{limit.name}</p>
                <p>
                  {limit.currency}
                  {limit.used} / {limit.currency}
                  {limit.max}
                </p>
              </div>
              <div
                className="limit-track"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function CardDetailsPage() {
  const [activeTab, setActiveTab] = useState("transactions");

  const panel = useMemo(() => {
    if (activeTab === "transactions") {
      return <TransactionsTab />;
    }

    if (activeTab === "security") {
      return <InfoGrid title="Card details" items={cardDetails} />;
    }

    if (activeTab === "limits") {
      return <LimitsTab />;
    }

    return <InfoGrid title="Card profile" items={cardProfile} />;
  }, [activeTab]);

  return (
    <main className="card-details-page">
      <div className="card-details-shell">
        <aside className="card-sidebar">
          <article className="bank-card-preview" aria-label="Card preview">
            <p className="chip" />
            <p className="preview-name">Daily Expenses</p>
            <p className="preview-number">
              **** **** **** {cardDetails[0].value.slice(-4)}
            </p>
            <p className="preview-holder">{cardDetails[3].value}</p>
          </article>

          <nav aria-label="Card sections" className="card-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`card-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="card-main-content">{panel}</section>
      </div>
    </main>
  );
}
