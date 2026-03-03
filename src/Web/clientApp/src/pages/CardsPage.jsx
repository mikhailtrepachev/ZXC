import "./PageLayout.css";
import { useNavigate } from "react-router-dom";

const cards = [
  {
    id: "main-debit",
    name: "Hlavni debetni karta",
    type: "Visa Classic",
    number: "**** 4921",
    status: "Aktivni",
    balance: "24 380 Kc",
    expires: "11/28",
  },
  {
    id: "travel",
    name: "Cestovni karta",
    type: "Mastercard Gold",
    number: "**** 1834",
    status: "Aktivni",
    balance: "1 240 EUR",
    expires: "03/29",
  },
  {
    id: "virtual",
    name: "Virtualni karta pro online platby",
    type: "Visa Virtual",
    number: "**** 9077",
    status: "Docasne blokovana",
    balance: "15 000 Kc",
    expires: "08/27",
  },
];

const actions = [
  "Nastavit limity",
  "Zobrazit PIN",
  "Docasne blokovat kartu",
  "Pridat kartu do Apple/Google Pay",
];

const lastTransactions = [
  { id: "tx1", merchant: "Alza.cz", date: "03 Mar 2026", amount: "-2 390 Kc" },
  { id: "tx2", merchant: "Shell", date: "02 Mar 2026", amount: "-1 120 Kc" },
  { id: "tx3", merchant: "Spotify", date: "01 Mar 2026", amount: "-169 Kc" },
  { id: "tx4", merchant: "Zasilkovna", date: "28 Feb 2026", amount: "-89 Kc" },
];

export default function CardsPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page__container">
        <h1 className="page__title">Karty</h1>
        <p className="page__subtitle">Sprava platebnich karet a jejich operaci.</p>

        <div className="page__grid">
          <section className="page__panel">
            <h2 className="page__panelTitle">Moje karty</h2>
            <div className="page__cardsList">
              {cards.map((card) => (
                <article className="page__itemCard" key={card.id}>
                  <div className="page__itemTop">
                    <div>
                      <p className="page__itemTitle">{card.name}</p>
                      <p className="page__itemSubtitle">
                        {card.type} - {card.number}
                      </p>
                    </div>
                    <span
                      className={`page__badge ${
                        card.status === "Aktivni" ? "page__badge--ok" : ""
                      }`}
                    >
                      {card.status}
                    </span>
                  </div>

                  <div className="page__itemMeta">
                    <span>Dostupny zustatek: {card.balance}</span>
                    <span>Platnost: {card.expires}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Rychle akce</h2>
            <div className="page__actions">
              {actions.map((action) => (
                <button className="page__chip" type="button" key={action}>
                  {action}
                </button>
              ))}
            </div>
          </section>

          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Posledni transakce kartou</h2>
            <div className="page__table">
              {lastTransactions.map((tx) => (
                <div className="page__row" key={tx.id}>
                  <span>{tx.merchant}</span>
                  <span>{tx.date}</span>
                  <span className="page__amount">{tx.amount}</span>
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
