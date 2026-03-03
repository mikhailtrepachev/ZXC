import "./PageLayout.css";
import { useNavigate } from "react-router-dom";

const activeLoans = [
  {
    id: "mortgage",
    title: "Hypotekarni uver",
    remaining: "2 410 000 Kc",
    payment: "14 950 Kc / mesic",
    nextPayment: "15 Mar 2026",
    rate: "4.79 % p.a.",
    progress: 32,
  },
  {
    id: "car",
    title: "Auto uver",
    remaining: "186 400 Kc",
    payment: "6 420 Kc / mesic",
    nextPayment: "20 Mar 2026",
    rate: "6.10 % p.a.",
    progress: 58,
  },
];

const offers = [
  {
    id: "cash",
    title: "Spotrebitelsky uver",
    text: "Predschvaleno az do 300 000 Kc bez zajisteni.",
  },
  {
    id: "refi",
    title: "Refinancovani",
    text: "Snizte splatku sloucenim stavajicich uveru.",
  },
];

const reminders = [
  "Muzete uhradit mimoradnou splatku bez poplatku jednou rocne.",
  "Sazba se aktualizuje pri refixaci za 18 mesicu.",
  "Nastavte si upozorneni 3 dny pred splatkou.",
];

export default function LoansPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page__container">
        <h1 className="page__title">Uvery</h1>
        <p className="page__subtitle">Prehled aktivnich uveru, splatky a nove nabidky.</p>

        <div className="page__grid">
          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Aktivni uvery</h2>
            <div className="page__cardsList">
              {activeLoans.map((loan) => (
                <article className="page__itemCard" key={loan.id}>
                  <div className="page__itemTop">
                    <div>
                      <p className="page__itemTitle">{loan.title}</p>
                      <p className="page__itemSubtitle">Zbyva doplatit: {loan.remaining}</p>
                    </div>
                    <span className="page__badge page__badge--ok">Aktivni</span>
                  </div>

                  <div className="page__itemMeta">
                    <span>{loan.payment}</span>
                    <span>Dalsi splatka: {loan.nextPayment}</span>
                    <span>Urok: {loan.rate}</span>
                  </div>

                  <div className="page__progress">
                    <span style={{ width: `${loan.progress}%` }} />
                  </div>
                  <p className="page__helperText">Splaceno {loan.progress} %</p>
                </article>
              ))}
            </div>
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Nabidky</h2>
            <div className="page__cardsList">
              {offers.map((offer) => (
                <article className="page__itemCard" key={offer.id}>
                  <p className="page__itemTitle">{offer.title}</p>
                  <p className="page__itemSubtitle">{offer.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Pripomenuti</h2>
            <ul className="page__list">
              {reminders.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <button className="page__button" onClick={() => navigate("/accounts")}>
          Zpet na ucty
        </button>
      </div>
    </div>
  );
}
