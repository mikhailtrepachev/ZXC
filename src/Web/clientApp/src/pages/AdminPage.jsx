import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../auth/session";
import "./PageLayout.css";
import "./AdminPage.css";

const USERS_ENDPOINTS = [
  "/api/Admins/users",
  "/api/Admins/clients",
  "/api/Admins/database-users",
  "/api/Admins/all-users",
];

const SOFT_DELETE_STORAGE_KEY = "zxc_admin_soft_deleted_accounts";

function getAuthHeaders(includeJson = false) {
  const headers = {};
  const token = getAccessToken();

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function pick(obj, ...keys) {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }

  return undefined;
}

function parseJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function extractAccountList(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const directCandidates = [
    payload.accounts,
    payload.Accounts,
    payload.clientAccounts,
    payload.ClientAccounts,
    payload.bankAccounts,
    payload.BankAccounts,
  ];

  for (const value of directCandidates) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(payload)) {
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }

    const first = value[0];
    if (!first || typeof first !== "object") {
      continue;
    }

    if ("accountNumber" in first || "AccountNumber" in first || "isFrozen" in first || "IsFrozen" in first) {
      return value;
    }
  }

  return [];
}

function mapAccount(rawItem) {
  const id = Number(pick(rawItem, "id", "Id", "accountId", "AccountId"));
  const accountNumber = String(pick(rawItem, "accountNumber", "AccountNumber") || "").trim();
  const isFrozen = Boolean(pick(rawItem, "isFrozen", "IsFrozen"));
  const type = String(pick(rawItem, "type", "Type") || "");
  const currency = String(pick(rawItem, "currency", "Currency") || "");
  const balance = Number(pick(rawItem, "balance", "Balance"));

  return {
    id: Number.isFinite(id) ? id : null,
    accountNumber,
    isFrozen,
    type,
    currency,
    balance: Number.isFinite(balance) ? balance : null,
  };
}

function mapUser(rawUser, index) {
  const userId = String(
    pick(rawUser, "userId", "UserId", "id", "Id", "userID", "targetUserId", "TargetUserId") || ""
  ).trim();
  const email = String(pick(rawUser, "email", "Email", "userName", "UserName", "username") || "").trim();
  const firstName = String(pick(rawUser, "firstName", "FirstName") || "").trim();
  const lastName = String(pick(rawUser, "lastName", "LastName") || "").trim();
  const fullNameCandidate = String(pick(rawUser, "fullName", "FullName", "name", "Name") || "").trim();
  const fullName = fullNameCandidate || `${firstName} ${lastName}`.trim();
  const accountList = extractAccountList(rawUser);
  const accounts = Array.isArray(accountList) ? accountList.map(mapAccount) : [];

  return {
    id: userId || `row-${index}`,
    userId,
    email,
    fullName: fullName || email || userId || `Uzivatel ${index + 1}`,
    accounts,
  };
}

async function readErrorMessage(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);

    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }

    if (payload?.detail) {
      return payload.detail;
    }

    if (payload?.title) {
      return payload.title;
    }
  }

  const text = await response.text().catch(() => "");
  if (!text?.trim() || text.includes("<!DOCTYPE") || text.includes("<html")) {
    return fallbackMessage;
  }

  return text;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminPage() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [usersEndpoint, setUsersEndpoint] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [manualUserId, setManualUserId] = useState("");
  const [manualAccountId, setManualAccountId] = useState("");

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [softDeletedMap, setSoftDeletedMap] = useState(() =>
    parseJsonStorage(SOFT_DELETE_STORAGE_KEY, {})
  );

  useEffect(() => {
    localStorage.setItem(SOFT_DELETE_STORAGE_KEY, JSON.stringify(softDeletedMap));
  }, [softDeletedMap]);

  const selectedUser = useMemo(() => {
    return users.find((user) => user.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const accountsView = useMemo(() => {
    if (!selectedUser) {
      return [];
    }

    return selectedUser.accounts.map((account) => ({
      ...account,
      isSoftDeleted: Boolean(account.id && softDeletedMap[String(account.id)]),
    }));
  }, [selectedUser, softDeletedMap]);

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    setUsersEndpoint("");

    const headers = getAuthHeaders();

    for (const endpoint of USERS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            continue;
          }

          const message = await readErrorMessage(response, "Nepodařilo se načíst databázi uživatelů.");
          setUsersError(message);
          setUsers([]);
          setUsersLoading(false);
          return;
        }

        const payload = await response.json().catch(() => []);
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.Items)
              ? payload.Items
              : [];

        const mappedUsers = list.map(mapUser).filter((user) => user.id);
        setUsers(mappedUsers);
        setUsersEndpoint(endpoint);
        if (mappedUsers.length > 0) {
          setSelectedUserId(mappedUsers[0].id);
          setManualUserId(mappedUsers[0].userId || "");
        } else {
          setSelectedUserId("");
        }
        setUsersLoading(false);
        return;
      } catch {
        // try next endpoint
      }
    }

    setUsers([]);
    setUsersError(
      "Backend neexponuje endpoint pro výpis všech uživatelů. Pro logy použijte UserId ručně."
    );
    setUsersLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUserLogs = async (targetUserId) => {
    const normalizedId = String(targetUserId || "").trim();
    if (!normalizedId) {
      setLogsError("Zadejte UserId.");
      setLogs([]);
      return;
    }

    setLogsLoading(true);
    setLogsError("");
    setLogs([]);

    try {
      const response = await fetch(`/api/Admins/logs/${encodeURIComponent(normalizedId)}`, {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Nepodařilo se načíst logy uživatele.");
        setLogsError(message);
        return;
      }

      const payload = await response.json().catch(() => []);
      const list = Array.isArray(payload) ? payload : [];
      setLogs(list);
      setManualUserId(normalizedId);
    } catch {
      setLogsError("Nepodařilo se načíst logy uživatele.");
    } finally {
      setLogsLoading(false);
    }
  };

  const applyFreezeState = (accountId, freeze) => {
    setUsers((previous) =>
      previous.map((user) => ({
        ...user,
        accounts: user.accounts.map((account) =>
          account.id === accountId ? { ...account, isFrozen: freeze } : account
        ),
      }))
    );
  };

  const freezeAccount = async (accountId, freeze) => {
    if (!Number.isFinite(accountId) || accountId <= 0) {
      setActionError("Neplatné AccountId.");
      return false;
    }

    setIsActionLoading(true);
    setActionError("");
    setActionMessage("");

    try {
      const response = await fetch(`/api/Admins/account/${accountId}/freeze`, {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ freeze }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          freeze ? "Zmrazení účtu se nepodařilo." : "Rozmrazení účtu se nepodařilo."
        );
        setActionError(message);
        return false;
      }

      applyFreezeState(accountId, freeze);
      setActionMessage(freeze ? "Účet byl zmrazen." : "Účet byl rozmrazen.");
      return true;
    } catch {
      setActionError(freeze ? "Zmrazení účtu se nepodařilo." : "Rozmrazení účtu se nepodařilo.");
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  const softDeleteAccount = async (accountId) => {
    const ok = await freezeAccount(accountId, true);
    if (!ok) {
      return;
    }

    setSoftDeletedMap((previous) => ({
      ...previous,
      [String(accountId)]: true,
    }));
    setActionMessage("Účet byl dočasně skryt (lokálně skrytý a zmrazený).");
  };

  const restoreSoftDeletedAccount = async (accountId) => {
    const ok = await freezeAccount(accountId, false);
    if (!ok) {
      return;
    }

    setSoftDeletedMap((previous) => {
      const next = { ...previous };
      delete next[String(accountId)];
      return next;
    });
    setActionMessage("Dočasné skrytí bylo zrušeno a účet je aktivní.");
  };

  const handleManualFreeze = () => {
    const accountId = Number(manualAccountId);
    freezeAccount(accountId, true);
  };

  const handleManualUnfreeze = () => {
    const accountId = Number(manualAccountId);
    freezeAccount(accountId, false);
  };

  const handleManualSoftDelete = () => {
    const accountId = Number(manualAccountId);
    softDeleteAccount(accountId);
  };

  const handleManualRestore = () => {
    const accountId = Number(manualAccountId);
    restoreSoftDeletedAccount(accountId);
  };

  return (
    <div className="page admin-page">
      <div className="page__container admin-page__container">
        <div className="admin-page__head">
          <div>
            <h1 className="page__title">Administrace</h1>
            <p className="page__subtitle">Správa uživatelů, účtů, zmrazení a dočasného skrytí.</p>
          </div>
          <button className="page__chip" type="button" onClick={loadUsers} disabled={usersLoading}>
            {usersLoading ? "Načítám..." : "Obnovit"}
          </button>
        </div>

        <div className="page__grid admin-page__grid">
          <section className="page__panel">
            <h2 className="page__panelTitle">Databáze uživatelů</h2>
            {usersEndpoint && <p className="admin-page__hint">Zdroj: {usersEndpoint}</p>}

            {usersLoading && <p className="admin-page__state">Načítám uživatele...</p>}
            {!usersLoading && usersError && <p className="admin-page__state admin-page__state--error">{usersError}</p>}
            {!usersLoading && !usersError && users.length === 0 && (
              <p className="admin-page__state">Backend vrátil prázdný seznam uživatelů.</p>
            )}

            {!usersLoading && !usersError && users.length > 0 && (
              <div className="admin-page__usersList">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`admin-page__userRow ${selectedUserId === user.id ? "is-active" : ""}`}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setManualUserId(user.userId || "");
                      setLogs([]);
                      setLogsError("");
                    }}
                  >
                    <span className="admin-page__userName">{user.fullName}</span>
                    <span className="admin-page__userMeta">{user.email || user.userId || user.id}</span>
                    <span className="admin-page__userMeta">Účty: {user.accounts.length}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="page__panel">
            <h2 className="page__panelTitle">Účty uživatele</h2>
            {!selectedUser && <p className="admin-page__state">Vyberte uživatele.</p>}

            {selectedUser && accountsView.length === 0 && (
              <p className="admin-page__state">Pro vybraného uživatele nejsou dostupné žádné účty.</p>
            )}

            {selectedUser && accountsView.length > 0 && (
              <div className="admin-page__accountsList">
                {accountsView.map((account) => (
                  <article key={account.id || account.accountNumber} className="admin-page__accountCard">
                    <div className="admin-page__accountTop">
                      <strong>{account.accountNumber || `Account #${account.id || "-"}`}</strong>
                      <span className={`admin-page__badge ${account.isFrozen ? "is-frozen" : "is-active"}`}>
                        {account.isFrozen ? "Zmrazený" : "Aktivní"}
                      </span>
                    </div>

                    <p className="admin-page__accountMeta">
                      ID: {account.id || "--"} | {account.type || "--"} | {account.currency || "--"}
                    </p>
                    <p className="admin-page__accountMeta">
                      Dočasné skrytí: {account.isSoftDeleted ? "Ano" : "Ne"}
                    </p>

                    <div className="admin-page__actions">
                      <button type="button" className="page__chip" onClick={() => freezeAccount(account.id, true)} disabled={isActionLoading || !account.id}>
                        Zamrazit
                      </button>
                      <button type="button" className="page__chip" onClick={() => freezeAccount(account.id, false)} disabled={isActionLoading || !account.id}>
                        Rozmrazit
                      </button>
                      {!account.isSoftDeleted ? (
                        <button type="button" className="page__chip" onClick={() => softDeleteAccount(account.id)} disabled={isActionLoading || !account.id}>
                          Dočasně skrýt
                        </button>
                      ) : (
                        <button type="button" className="page__chip" onClick={() => restoreSoftDeletedAccount(account.id)} disabled={isActionLoading || !account.id}>
                          Obnovit
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Ruční správa podle ID</h2>
            <div className="admin-page__manualGrid">
              <label>
                UserId (pro logy)
                <input
                  type="text"
                  value={manualUserId}
                  onChange={(event) => setManualUserId(event.target.value)}
                  placeholder="např. guid uživatele"
                />
              </label>
              <button type="button" className="page__chip" onClick={() => loadUserLogs(manualUserId)} disabled={logsLoading}>
                {logsLoading ? "Načítám logy..." : "Načíst logy"}
              </button>

              <label>
                AccountId
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={manualAccountId}
                  onChange={(event) => setManualAccountId(event.target.value)}
                  placeholder="např. 12"
                />
              </label>
              <div className="admin-page__actions">
                <button type="button" className="page__chip" onClick={handleManualFreeze} disabled={isActionLoading}>
                  Zamrazit
                </button>
                <button type="button" className="page__chip" onClick={handleManualUnfreeze} disabled={isActionLoading}>
                  Rozmrazit
                </button>
                <button type="button" className="page__chip" onClick={handleManualSoftDelete} disabled={isActionLoading}>
                  Dočasně skrýt
                </button>
                <button type="button" className="page__chip" onClick={handleManualRestore} disabled={isActionLoading}>
                  Obnovit
                </button>
              </div>
            </div>

            {actionError && <p className="admin-page__state admin-page__state--error">{actionError}</p>}
            {actionMessage && <p className="admin-page__state admin-page__state--ok">{actionMessage}</p>}
          </section>

          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Logy uživatele</h2>
            {logsError && <p className="admin-page__state admin-page__state--error">{logsError}</p>}
            {!logsError && logsLoading && <p className="admin-page__state">Načítám logy...</p>}
            {!logsError && !logsLoading && logs.length === 0 && (
              <p className="admin-page__state">Logy zatím nejsou načteny nebo jsou prázdné.</p>
            )}

            {!logsError && !logsLoading && logs.length > 0 && (
              <div className="page__table">
                {logs.map((item) => (
                  <div className="page__row" key={item.id}>
                    <span>{item.deviceInfo || "--"}</span>
                    <span>{item.location || "--"} | {item.ipAddress || "--"}</span>
                    <span>{formatDateTime(item.created)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <button className="page__button" type="button" onClick={() => navigate("/accounts")}>
          Zpět na banku
        </button>
      </div>
    </div>
  );
}
