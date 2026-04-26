"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Database, RefreshCw, Save, UserCog } from "lucide-react";
import { EmptyState, FieldGroup, PageScaffold, StateMessage } from "../components/PageScaffold";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { getLocalUserProfile, saveLocalUserProfile } from "../auth/session";
import { useNavigate } from "../routing";
import { getAuthHeaders, pick, readErrorMessage } from "../lib/bank";
import { cn } from "../lib/utils";

const SOURCES = [
  {
    id: "user",
    title: "Profil uzivatele",
    endpoint: "/api/Users/manage/info",
    fallbackError: "Nepodarilo se nacist profil uzivatele.",
  },
  {
    id: "account",
    title: "Bankovni profil",
    endpoint: "/api/Accounts/info",
    fallbackError: "Nepodarilo se nacist bankovni data.",
  },
];

function formatValue(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : "<empty string>";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function flattenFields(value, parentPath = "", rows = []) {
  if (value === null || value === undefined) {
    rows.push({ path: parentPath || "(root)", value: formatValue(value) });
    return rows;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push({ path: parentPath || "(root)", value: "[]" });
      return rows;
    }

    value.forEach((entry, index) => {
      const nextPath = parentPath ? `${parentPath}[${index}]` : `[${index}]`;
      flattenFields(entry, nextPath, rows);
    });

    return rows;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);

    if (keys.length === 0) {
      rows.push({ path: parentPath || "(root)", value: "{}" });
      return rows;
    }

    keys.forEach((key) => {
      const nextPath = parentPath ? `${parentPath}.${key}` : key;
      flattenFields(value[key], nextPath, rows);
    });

    return rows;
  }

  rows.push({ path: parentPath || "(root)", value: formatValue(value) });
  return rows;
}

function parseFallbackName(value) {
  const fullName = String(value || "").trim();
  if (!fullName) {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function UserSettingsPage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setSaveMessage("");
    setSaveError("");

    const headers = getAuthHeaders();
    const loaded = await Promise.all(
      SOURCES.map(async (source) => {
        try {
          const response = await fetch(source.endpoint, {
            method: "GET",
            credentials: "include",
            headers,
          });

          if (!response.ok) {
            const message = await readErrorMessage(response, source.fallbackError);
            return { ...source, data: null, error: message };
          }

          const payload = await response.json().catch(() => null);
          return { ...source, data: payload, error: "" };
        } catch {
          return { ...source, data: null, error: source.fallbackError };
        }
      }),
    );

    setSections(loaded);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const profileEmail = useMemo(() => {
    for (const section of sections) {
      const value = pick(section.data, "email", "Email", "userName", "UserName", "username");
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return "";
  }, [sections]);

  useEffect(() => {
    const local = getLocalUserProfile(profileEmail);

    if (local?.firstName || local?.lastName) {
      setFirstName(local.firstName || "");
      setLastName(local.lastName || "");
      return;
    }

    const section = sections.find((entry) => entry.data);
    const fullName = pick(section?.data, "fullName", "FullName", "name", "Name");
    const parsed = parseFallbackName(fullName);

    setFirstName(parsed.firstName);
    setLastName(parsed.lastName);
  }, [profileEmail, sections]);

  const tableSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        rows: section.data !== null ? flattenFields(section.data) : [],
      })),
    [sections],
  );

  const handleSaveDisplayName = () => {
    setSaveMessage("");
    setSaveError("");

    if (!profileEmail) {
      setSaveError("Nelze ulozit jmeno, protoze neni dostupny e-mail uzivatele.");
      return;
    }

    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();

    if (!nextFirstName || !nextLastName) {
      setSaveError("Vyplnte jmeno i prijmeni.");
      return;
    }

    const saved = saveLocalUserProfile({
      email: profileEmail,
      firstName: nextFirstName,
      lastName: nextLastName,
    });

    if (!saved) {
      setSaveError("Ulozeni se nezdarilo.");
      return;
    }

    setSaveMessage("Jmeno pro zobrazeni bylo ulozeno.");
  };

  return (
    <PageScaffold
      title="Nastaveni profilu"
      description="Dostupna profilova data z backendu a lokalni jmeno zobrazovane ve frontendu."
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => navigate("/accounts")}>
            <ArrowLeft />
            Zpet
          </Button>
          <Button type="button" variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            {isLoading ? "Nacitam" : "Obnovit"}
          </Button>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-primary" />
            Jmeno v aplikaci
          </CardTitle>
          <CardDescription>
            Toto nastaveni je lokalni a pouziva se pro zobrazeni v hlavicce a na kartach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{profileEmail || "E-mail nebyl nalezen"}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup label="Jmeno">
              <Input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </FieldGroup>
            <FieldGroup label="Prijmeni">
              <Input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </FieldGroup>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSaveDisplayName}>
              <Save />
              Ulozit jmeno
            </Button>
          </div>
          <StateMessage type="error">{saveError}</StateMessage>
          <StateMessage type="success">{saveMessage}</StateMessage>
        </CardContent>
      </Card>

      {isLoading && sections.length === 0 && <StateMessage>Nacitam profilova data...</StateMessage>}

      {tableSections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="size-5 text-primary" />
                  {section.title}
                </CardTitle>
                <CardDescription className="mt-2 break-all">{section.endpoint}</CardDescription>
              </div>
              <Badge variant="outline">{section.rows.length} poli</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.error && <StateMessage type="error">{section.error}</StateMessage>}

            {!section.error && section.data === null && (
              <EmptyState title="Prazdna odpoved" description="Zdroj vratil prazdnou odpoved." />
            )}

            {!section.error && section.data !== null && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[36%]">Pole</TableHead>
                      <TableHead>Hodnota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.rows.map((row) => (
                      <TableRow key={`${section.id}-${row.path}`}>
                        <TableCell className="max-w-[18rem] font-mono text-xs text-muted-foreground">
                          {row.path}
                        </TableCell>
                        <TableCell className="max-w-[34rem] whitespace-normal break-words font-mono text-xs">
                          {row.value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <details className="rounded-lg border bg-muted/30 p-4">
                  <summary className="cursor-pointer text-sm font-medium">Surovy JSON</summary>
                  <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-background p-4 text-xs text-muted-foreground">
                    {JSON.stringify(section.data, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </PageScaffold>
  );
}
