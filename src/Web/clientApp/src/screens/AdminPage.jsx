"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileClock,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { EmptyState, FieldGroup, PageScaffold, StateMessage } from "../components/PageScaffold";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { cn } from "../lib/utils";
import { extractAccountList, formatDate, getAuthHeaders, pick, readErrorMessage } from "../lib/bank";

const USERS_ENDPOINT_CANDIDATES = [
  "/api/Admins/users",
  "/api/Admins/clients",
  "/api/Admins/all-users",
  "/api/Admin/users",
  "/api/Admin/clients",
  "/api/admin/users",
  "/api/admin/clients",
  "/api/Clients/list",
  "/api/Users/list",
];
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
    pick(rawUser, "userId", "UserId", "id", "Id", "userID", "targetUserId", "TargetUserId") || "",
  ).trim();
  const email = String(pick(rawUser, "email", "Email", "userName", "UserName", "username") || "").trim();
  const firstName = String(pick(rawUser, "firstName", "FirstName") || "").trim();
  const lastName = String(pick(rawUser, "lastName", "LastName") || "").trim();
  const fullNameCandidate = String(pick(rawUser, "fullName", "FullName", "name", "Name") || "").trim();
  const fullName = fullNameCandidate || `${firstName} ${lastName}`.trim();
  const accounts = extractAccountList(rawUser).map(mapAccount);

  return {
    id: userId || `row-${index}`,
    userId,
    email,
    fullName: fullName || email || userId || `Uzivatel ${index + 1}`,
    accounts,
  };
}

async function discoverUserListEndpoints() {
  try {
    const response = await fetch("/openapi/v1.json", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => null);
    const paths = payload?.paths && typeof payload.paths === "object" ? payload.paths : null;
    if (!paths) {
      return [];
    }

    return Object.entries(paths)
      .filter(([path, methods]) => {
        const normalizedPath = path.toLowerCase();
        const hasGet = methods && typeof methods === "object" && (methods.get || methods.GET);

        return (
          path.startsWith("/api/") &&
          hasGet &&
          normalizedPath.includes("admin") &&
          (normalizedPath.includes("users") || normalizedPath.includes("clients")) &&
          !normalizedPath.includes("logs") &&
          !normalizedPath.includes("manage/info")
        );
      })
      .map(([path]) => path);
  } catch {
    return [];
  }
}

export default function AdminPage() {
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

  const [softDeletedMap, setSoftDeletedMap] = useState({});

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId],
  );

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

    try {
      const discovered = await discoverUserListEndpoints();
      const endpoints = Array.from(new Set([...USERS_ENDPOINT_CANDIDATES, ...discovered]));

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "include",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            continue;
          }

          if (response.status === 401 || response.status === 403) {
            setUsers([]);
            setSelectedUserId("");
            setUsersError("Nemate opravneni ke cteni seznamu uzivatelu (Administrator).");
            return;
          }

          const message = await readErrorMessage(response, "Nepodarilo se nacist seznam uzivatelu.");
          setUsers([]);
          setSelectedUserId("");
          setUsersError(`${message} (HTTP ${response.status})`);
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
        setSelectedUserId(mappedUsers[0]?.id || "");
        setManualUserId(mappedUsers[0]?.userId || "");
        return;
      }
    } catch {
      // Fallback message is set below after all candidates fail.
    } finally {
      setUsersLoading(false);
    }

    setUsers([]);
    setSelectedUserId("");
    setUsersError("Backend nyni neexponuje GET endpoint pro seznam uzivatelu.");
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
        const message = await readErrorMessage(response, "Nepodarilo se nacist logy uzivatele.");
        setLogsError(message);
        return;
      }

      const payload = await response.json().catch(() => []);
      setLogs(Array.isArray(payload) ? payload : []);
      setManualUserId(normalizedId);
    } catch {
      setLogsError("Nepodarilo se nacist logy uzivatele.");
    } finally {
      setLogsLoading(false);
    }
  };

  const applyFreezeState = (accountId, freeze) => {
    setUsers((previous) =>
      previous.map((user) => ({
        ...user,
        accounts: user.accounts.map((account) =>
          account.id === accountId ? { ...account, isFrozen: freeze } : account,
        ),
      })),
    );
  };

  const freezeAccount = async (accountId, freeze) => {
    if (!Number.isFinite(accountId) || accountId <= 0) {
      setActionError("Neplatne AccountId.");
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
          freeze ? "Zmrazeni uctu se nepodarilo." : "Rozmrazeni uctu se nepodarilo.",
        );
        setActionError(message);
        return false;
      }

      applyFreezeState(accountId, freeze);
      setActionMessage(freeze ? "Ucet byl zmrazen." : "Ucet byl rozmrazen.");
      return true;
    } catch {
      setActionError(freeze ? "Zmrazeni uctu se nepodarilo." : "Rozmrazeni uctu se nepodarilo.");
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
    setActionMessage("Ucet byl docasne skryt lokalne a zmrazen.");
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
    setActionMessage("Docasne skryti bylo zruseno a ucet je aktivni.");
  };

  const manualAccountNumber = Number(manualAccountId);

  return (
    <PageScaffold
      title="Administrace"
      description="Sprava uzivatelu, bankovnich uctu, zmrazeni a docasneho skryti."
      actions={
        <Button type="button" variant="outline" onClick={loadUsers} disabled={usersLoading}>
          <RefreshCw className={cn(usersLoading && "animate-spin")} />
          {usersLoading ? "Nacitam" : "Obnovit"}
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(280px,380px)_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  Seznam uzivatelu
                </CardTitle>
                <CardDescription className="mt-2 break-all">
                  Zdroj: {usersEndpoint || "nenalezeno"}
                </CardDescription>
              </div>
              <Badge variant="secondary">{users.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {usersLoading && <StateMessage>Nacitam uzivatele...</StateMessage>}
            {!usersLoading && usersError && <StateMessage type="error">{usersError}</StateMessage>}
            {!usersLoading && !usersError && users.length === 0 && (
              <EmptyState title="Zadni uzivatele" description="Backend vratil prazdny seznam uzivatelu." />
            )}
            {!usersLoading && !usersError && users.length > 0 && (
              <div className="grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={cn(
                      "grid gap-1 rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent",
                      selectedUserId === user.id && "border-primary bg-primary/5",
                    )}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setManualUserId(user.userId || "");
                      setLogs([]);
                      setLogsError("");
                    }}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <UserRound className="size-4 text-muted-foreground" />
                      {user.fullName}
                    </span>
                    <span className="break-all text-xs text-muted-foreground">UserId: {user.userId || "--"}</span>
                    <span className="text-xs text-muted-foreground">Ucty v odpovedi: {user.accounts.length}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5 text-primary" />
              Ucty uzivatele
            </CardTitle>
            <CardDescription>
              {selectedUser ? selectedUser.fullName : "Vyberte uzivatele ze seznamu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedUser && <EmptyState title="Vyberte uzivatele" description="Detail uctu se zobrazi zde." />}
            {selectedUser && accountsView.length === 0 && (
              <StateMessage type="warning">
                Endpoint vraci pouze zakladni data. Spravu uctu provedte pomoci AccountId nize.
              </StateMessage>
            )}
            {selectedUser && accountsView.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                {accountsView.map((account) => (
                  <Card key={account.id || account.accountNumber} className="gap-4 border-muted py-4 shadow-none">
                    <CardHeader className="px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            {account.accountNumber || `Account #${account.id || "-"}`}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            ID: {account.id || "--"} | {account.type || "--"} | {account.currency || "--"}
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            account.isFrozen
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {account.isFrozen ? "Zmrazeny" : "Aktivni"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4">
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">Docasne skryti: {account.isSoftDeleted ? "Ano" : "Ne"}</Badge>
                        <Badge variant="secondary">Balance: {account.balance ?? "--"}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => freezeAccount(account.id, true)}
                          disabled={isActionLoading || !account.id}
                        >
                          <LockKeyhole />
                          Zamrazit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => freezeAccount(account.id, false)}
                          disabled={isActionLoading || !account.id}
                        >
                          <UnlockKeyhole />
                          Rozmrazit
                        </Button>
                        {!account.isSoftDeleted ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => softDeleteAccount(account.id)}
                            disabled={isActionLoading || !account.id}
                          >
                            <Trash2 />
                            Skryt
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => restoreSoftDeletedAccount(account.id)}
                            disabled={isActionLoading || !account.id}
                          >
                            <RotateCcw />
                            Obnovit
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Rucni sprava podle ID
          </CardTitle>
          <CardDescription>Rychle akce pro logy uzivatele a stav konkretniho uctu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-end">
            <FieldGroup label="UserId pro logy">
              <Input
                type="text"
                value={manualUserId}
                onChange={(event) => setManualUserId(event.target.value)}
                placeholder="guid uzivatele"
              />
            </FieldGroup>
            <Button type="button" variant="outline" onClick={() => loadUserLogs(manualUserId)} disabled={logsLoading}>
              <Search className={cn(logsLoading && "animate-spin")} />
              {logsLoading ? "Nacitam" : "Nacist logy"}
            </Button>
            <FieldGroup label="AccountId">
              <Input
                type="number"
                min="1"
                step="1"
                value={manualAccountId}
                onChange={(event) => setManualAccountId(event.target.value)}
                placeholder="napr. 12"
              />
            </FieldGroup>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => freezeAccount(manualAccountNumber, true)} disabled={isActionLoading}>
                <LockKeyhole />
                Zamrazit
              </Button>
              <Button type="button" variant="outline" onClick={() => freezeAccount(manualAccountNumber, false)} disabled={isActionLoading}>
                <UnlockKeyhole />
                Rozmrazit
              </Button>
              <Button type="button" variant="secondary" onClick={() => softDeleteAccount(manualAccountNumber)} disabled={isActionLoading}>
                <Trash2 />
                Skryt
              </Button>
              <Button type="button" variant="secondary" onClick={() => restoreSoftDeletedAccount(manualAccountNumber)} disabled={isActionLoading}>
                <RotateCcw />
                Obnovit
              </Button>
            </div>
          </div>
          <StateMessage type="error">{actionError}</StateMessage>
          <StateMessage type="success">{actionMessage}</StateMessage>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileClock className="size-5 text-primary" />
            Logy uzivatele
          </CardTitle>
          <CardDescription>Audit prihlaseni a zarizeni pro vybraneho uzivatele.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logsError && <StateMessage type="error">{logsError}</StateMessage>}
          {!logsError && logsLoading && <StateMessage>Nacitam logy...</StateMessage>}
          {!logsError && !logsLoading && logs.length === 0 && (
            <EmptyState title="Logy nejsou nactene" description="Vyberte uzivatele nebo zadejte UserId rucne." />
          )}
          {!logsError && !logsLoading && logs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zarizeni</TableHead>
                  <TableHead>Lokace</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Cas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((item, index) => (
                  <TableRow key={item.id || `${item.created}-${index}`}>
                    <TableCell className="font-medium">{item.deviceInfo || "--"}</TableCell>
                    <TableCell>{item.location || "--"}</TableCell>
                    <TableCell>{item.ipAddress || "--"}</TableCell>
                    <TableCell className="text-right">{formatDate(item.created, true)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageScaffold>
  );
}
