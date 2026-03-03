import "./PageLayout.css";
import { useNavigate } from "react-router-dom";

const scheduledPayments = [
  {
    id: "rent",
    recipient: "Bytove druzstvo Alfa",
    amount: "12 500 Kc",
    date: "10 Mar 2026",
    type: "Trvaly prikaz",
  },
  {
    id: "energy",
    recipient: "Energo Plus",
    amount: "2 190 Kc",
    date: "12 Mar 2026",
    type: "Inkaso",
  },
];

const paymentTemplates = [
  "Najem",
  "Elektrina",
  "Internet",
  "Mobilni tarif",
  "Sportovni krouzek",
];

const paymentHistory = [
  { id: "ph1", recipient: "Rohlik.cz", date: "03 Mar 2026", amount: "-1 460 Kc" },
  { id: "ph2", recipient: "MHD Praha", date: "02 Mar 2026", amount: "-550 Kc" },
  { id: "ph3", recipient: "Prijem od zamestnavatele", date: "01 Mar 2026", amount: "+41 800 Kc" },
  { id: "ph4", recipient: "Vodafone", date: "28 Feb 2026", amount: "-799 Kc" },
];

export default function PaymentsPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page__container">
        <h1 className="page__title">Platby</h1>
        <p className="page__subtitle">Naplanovane platby, sablony a historie transakci.</p>

        <div className="page__grid">
          <section className="page__panel">
            <h2 className="page__panelTitle">Naplanovane platby</h2>
            <div className="page__cardsList">
              {scheduledPayments.map((payment) => (
                <article className="page__itemCard" key={payment.id}>
                  <div className="page__itemTop">
                    <div>
                      <p className="page__itemTitle">{payment.recipient}</p>
                      <p className="page__itemSubtitle">{payment.type}</p>
                    </div>
                    <span className="page__badge">{payment.amount}</span>
                  </div>
                  <div className="page__itemMeta">
                    <span>Termin: {payment.date}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Sablony plateb</h2>
            <div className="page__actions">
              {paymentTemplates.map((template) => (
                <button className="page__chip" type="button" key={template}>
                  {template}
                </button>
              ))}
            </div>
          </section>

          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Posledni pohyby</h2>
            <div className="page__table">
              {paymentHistory.map((payment) => (
                <div className="page__row" key={payment.id}>
                  <span>{payment.recipient}</span>
                  <span>{payment.date}</span>
                  <span className={`page__amount ${payment.amount.startsWith("+") ? "page__amount--in" : ""}`}>
                    {payment.amount}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <button className="page__button" onClick={() => navigate("/accounts")}>
          Zpet na ucty
        </button>
      </div>
    </div>
  );
}
