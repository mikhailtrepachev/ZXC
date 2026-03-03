import "./AccountsPage.css";

const accounts = [
  { id: "czk", symbol: "Kč", balance: "0 Kč", label: "Běžný účet", card: "••49" },
  { id: "eur", symbol: "€", balance: "0 €", label: "Účet v EUR" },
  { id: "usd", symbol: "$", balance: "0 $", label: "Účet v USD" },
  { id: "invest", symbol: "⛁", balance: "0 Kč", label: "Investice" },
];

const extraCards = [
  { id: "card1", title: "Karta •0678", card: "Debit" },
  { id: "card2", title: "Karta •9435", card: "Debit" },
];

const quickActions = [
  { id: "phone", title: "Platba na telefon", icon: "☎" },
  { id: "iban", title: "Platba na účet", icon: "▣" },
  { id: "mobile", title: "Dobít kredit", icon: "◫" },
  { id: "scan", title: "Naskenovat složenku", icon: "⌁" },
];

const cashbackCards = [
  {
    id: "food",
    title: "Program stravování Premium",
    subtitle: "Cashback až 8 %",
    theme: "violet",
  },
  {
    id: "shop",
    title: "Potraviny a drogerie",
    subtitle: "Cashback 45 %",
    theme: "green",
  },
];

export default function AccountsPage() {
  return (
    <section className="accounts-page">
      <div className="accounts-shell">
        <aside className="accounts-sidebar">
          <h1 className="accounts-title">Dobrý den</h1>

          <div className="accounts-list">
            {accounts.map((item) => (
              <article className="account-card" key={item.id}>
                <div className="account-card__icon">{item.symbol}</div>
                <div className="account-card__content">
                  <p className="account-card__balance">{item.balance}</p>
                  <p className="account-card__label">{item.label}</p>
                  {item.card && <p className="account-card__chip">{item.card}</p>}
                </div>
              </article>
            ))}
          </div>

          <article className="credit-offer">
            <p className="credit-offer__title">Máte předschválenou kreditní kartu</p>
            <p className="credit-offer__text">Dokončete žádost během pár kliknutí.</p>
          </article>

          <div className="accounts-list">
            {extraCards.map((item) => (
              <article className="account-card account-card--compact" key={item.id}>
                <div className="account-card__content">
                  <p className="account-card__balance">{item.title}</p>
                  <p className="account-card__chip">{item.card}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <main className="accounts-main">
          <label className="search-box">
            <span className="search-box__icon">⌕</span>
            <input type="text" placeholder="Hledat" />
          </label>

          <section className="quick-actions">
            {quickActions.map((action) => (
              <button className="quick-action" type="button" key={action.id}>
                <span className="quick-action__icon">{action.icon}</span>
                <span className="quick-action__text">{action.title}</span>
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Cashback a odměny</h2>
              <a href="/">Všechny nabídky</a>
            </div>

            <div className="cashback-grid">
              {cashbackCards.map((item) => (
                <article
                  className={`cashback-card cashback-card--${item.theme}`}
                  key={item.id}
                >
                  <p className="cashback-card__title">{item.title}</p>
                  <p className="cashback-card__subtitle">{item.subtitle}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel operations">
            <div className="panel__head">
              <h2>
                Operace v březnu <span>›</span>
              </h2>
            </div>

            <div className="operations__tabs">
              <button className="tab is-active" type="button">
                Výdaje
              </button>
              <button className="tab" type="button">
                Příjmy
              </button>
            </div>

            <div className="operations__empty">
              <div className="operations__icon">◌</div>
              <p>V březnu zatím nemáte žádné výdaje.</p>
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
