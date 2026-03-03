import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken, getLocalUserProfile, saveLocalUserProfile } from "../auth/session";
import "./PageLayout.css";
import "./UserSettingsPage.css";

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

function getAuthHeaders() {
  const headers = {};
  const token = getAccessToken();

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
      })
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
    [sections]
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
    <div className="page user-settings-page">
      <div className="page__container user-settings-page__container">
        <div className="user-settings-page__head">
          <div>
            <h1 className="page__title">Nastaveni profilu</h1>
            <p className="page__subtitle">
              Zobrazeni vsech dostupnych udaju a lokalni nastaveni jmena ve fronte.
            </p>
          </div>
          <button type="button" className="page__chip" onClick={loadData} disabled={isLoading}>
            {isLoading ? "Nacitam..." : "Obnovit data"}
          </button>
        </div>

        <div className="page__grid user-settings-page__grid">
          <section className="page__panel page__panel--full">
            <h2 className="page__panelTitle">Jmeno v aplikaci</h2>
            <p className="user-settings-page__hint">
              Toto nastaveni je lokalni a pouziva se pro zobrazeni v Headeru a na kartach.
            </p>
            <p className="user-settings-page__email">{profileEmail || "E-mail nebyl nalezen."}</p>

            <div className="user-settings-page__nameForm">
              <label>
                Jmeno
                <input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </label>
              <label>
                Prijmeni
                <input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </label>
            </div>

            <div className="user-settings-page__actions">
              <button type="button" className="page__chip" onClick={handleSaveDisplayName}>
                Ulozit jmeno
              </button>
            </div>

            {saveError && <p className="user-settings-page__state user-settings-page__state--error">{saveError}</p>}
            {saveMessage && <p className="user-settings-page__state user-settings-page__state--ok">{saveMessage}</p>}
          </section>

          {tableSections.map((section) => (
            <section className="page__panel page__panel--full" key={section.id}>
              <div className="user-settings-page__sectionHead">
                <h2 className="page__panelTitle">{section.title}</h2>
                <span className="user-settings-page__endpoint">{section.endpoint}</span>
              </div>

              {section.error && <p className="user-settings-page__state user-settings-page__state--error">{section.error}</p>}

              {!section.error && section.data === null && (
                <p className="user-settings-page__state">Zdroj vratil prazdnou odpoved.</p>
              )}

              {!section.error && section.data !== null && (
                <>
                  <p className="user-settings-page__state">Pocet poli: {section.rows.length}</p>
                  <div className="user-settings-page__table">
                    {section.rows.map((row) => (
                      <div className="user-settings-page__row" key={`${section.id}-${row.path}`}>
                        <span className="user-settings-page__key">{row.path}</span>
                        <span className="user-settings-page__value">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <details className="user-settings-page__raw">
                    <summary>Raw JSON</summary>
                    <pre>{JSON.stringify(section.data, null, 2)}</pre>
                  </details>
                </>
              )}
            </section>
          ))}
        </div>

        <button className="page__button" type="button" onClick={() => navigate("/accounts")}>
          Zpet na ucty
        </button>
      </div>
    </div>
  );
}
