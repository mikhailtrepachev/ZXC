"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { getAccessToken, persistSession, saveLocalUserProfile } from "../auth/session";
import { useNavigate } from "../routing";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { StateMessage } from "../components/PageScaffold";
import { extractAccountList, readErrorMessage } from "../lib/bank";

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const NAME_REGEX = /^[\p{L}][\p{L}' -]{1,59}$/u;
const CZECH_PHONE_LOCAL_DIGITS = 9;
const CZECH_PHONE_PREFIX = "420";
const MAX_STREET_LENGTH = 120;
const MAX_COUNTRY_LENGTH = 80;
const PHOTON_API_URL = "https://photon.komoot.io/api/";
const CZECH_REPUBLIC_BBOX = "12.09,48.55,18.86,51.06";

function sanitizePhoneInput(value) {
  const trimmed = String(value || "").trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    return `+${digits.slice(0, CZECH_PHONE_PREFIX.length + CZECH_PHONE_LOCAL_DIGITS)}`;
  }

  return digits.slice(0, CZECH_PHONE_LOCAL_DIGITS);
}

function normalizePhoneForSubmit(value) {
  const trimmed = String(value || "").trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return digits.length === 12 && digits.startsWith(CZECH_PHONE_PREFIX) ? `+${digits}` : "";
  }

  return digits.length === CZECH_PHONE_LOCAL_DIGITS ? `+${CZECH_PHONE_PREFIX}${digits}` : "";
}

function validateRegistration(form) {
  const normalized = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phoneNumber: normalizePhoneForSubmit(form.phoneNumber),
    stateName: form.stateName.trim(),
    street: form.street.trim(),
  };

  if (!NAME_REGEX.test(normalized.firstName)) {
    return { error: "First name must be 2-60 letters.", normalized };
  }

  if (!NAME_REGEX.test(normalized.lastName)) {
    return { error: "Last name must be 2-60 letters.", normalized };
  }

  if (!EMAIL_REGEX.test(normalized.email) || normalized.email.length > 254) {
    return { error: "Enter a valid email address.", normalized };
  }

  if (!normalized.phoneNumber) {
    return { error: "Use a Czech phone number: 9 digits or +420 plus 9 digits.", normalized };
  }

  if (normalized.stateName.length < 2 || normalized.stateName.length > MAX_COUNTRY_LENGTH) {
    return { error: "Country must be 2-80 characters.", normalized };
  }

  if (normalized.street.length < 5 || normalized.street.length > MAX_STREET_LENGTH) {
    return { error: "Street address must be 5-120 characters.", normalized };
  }

  if (form.password !== form.confirmPassword) {
    return { error: "Passwords do not match.", normalized };
  }

  if (!PASSWORD_POLICY_REGEX.test(form.password)) {
    return {
      error: "Password must contain upper/lower case letters, a number, and a special character.",
      normalized,
    };
  }

  return { error: "", normalized };
}

function shouldBiasToCzechRepublic(country) {
  const normalized = String(country || "").trim().toLowerCase();
  return !normalized || normalized === "cz" || normalized.includes("czech") || normalized.includes("cesk");
}

function formatAddressPart(...parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}

function mapPhotonFeature(feature, index) {
  const properties = feature?.properties || {};
  const name = String(properties.name || "").trim();
  const streetName = String(properties.street || properties.road || "").trim();
  const houseNumber = String(properties.housenumber || "").trim();
  const postcode = String(properties.postcode || "").trim();
  const city = String(
    properties.city ||
      properties.town ||
      properties.village ||
      properties.locality ||
      properties.district ||
      properties.county ||
      "",
  ).trim();
  const country = String(properties.country || "").trim();
  const road = streetName || name;

  if (!road) {
    return null;
  }

  const line1 = houseNumber && !road.includes(houseNumber) ? `${road} ${houseNumber}` : road;
  const line2 = formatAddressPart(city, postcode);
  const street = formatAddressPart(line1, line2);
  const label = formatAddressPart(street, country);

  return {
    id: `${properties.osm_type || "osm"}-${properties.osm_id || index}`,
    label,
    street,
    stateName: country,
  };
}

function dedupeAddressSuggestions(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.street}|${item.stateName}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function waitForGeneratedAccounts() {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch("/api/Accounts/info", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const payload = await response.json().catch(() => null);
        const accounts = extractAccountList(payload);
        if (accounts.length > 0) {
          return true;
        }
      }
    } catch {
      // Retry below.
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
}

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    stateName: "",
    street: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressSuggestionsOpen, setIsAddressSuggestionsOpen] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState("");

  const updateField = (field) => (event) => {
    setForm((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const updatePhone = (event) => {
    setForm((previous) => ({
      ...previous,
      phoneNumber: sanitizePhoneInput(event.target.value),
    }));
  };

  const updateStreet = (event) => {
    const value = event.target.value;
    setForm((previous) => ({
      ...previous,
      street: value,
    }));
    setIsAddressSuggestionsOpen(true);
  };

  const selectAddressSuggestion = (suggestion) => {
    setForm((previous) => ({
      ...previous,
      stateName: suggestion.stateName,
      street: suggestion.street,
    }));
    setIsAddressSuggestionsOpen(false);
  };

  useEffect(() => {
    const query = form.street.trim();

    if (query.length < 3) {
      setAddressSuggestions([]);
      setIsAddressLoading(false);
      setAddressSearchError("");
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsAddressLoading(true);
      setAddressSearchError("");

      try {
        const params = new URLSearchParams({
          q: formatAddressPart(query, form.stateName),
          limit: "6",
          lang: "en",
        });

        params.append("layer", "house");
        params.append("layer", "street");

        if (shouldBiasToCzechRepublic(form.stateName)) {
          params.set("bbox", CZECH_REPUBLIC_BBOX);
        }

        const response = await fetch(`${PHOTON_API_URL}?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Address lookup failed.");
        }

        const payload = await response.json().catch(() => null);
        const features = Array.isArray(payload?.features) ? payload.features : [];
        const mapped = dedupeAddressSuggestions(features.map(mapPhotonFeature).filter(Boolean));
        setAddressSuggestions(mapped);
      } catch (lookupError) {
        if (lookupError.name !== "AbortError") {
          setAddressSuggestions([]);
          setAddressSearchError("Address suggestions are unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsAddressLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [form.stateName, form.street]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const { error: validationError, normalized } = validateRegistration(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Clients/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          email: normalized.email,
          password: form.password,
          phoneNumber: normalized.phoneNumber,
          state: normalized.stateName,
          street: normalized.street,
        }),
      });

      if (!response.ok) {
        setError(await readErrorMessage(response, "Registration failed."));
        return;
      }

      saveLocalUserProfile({
        email: normalized.email,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
      });

      const loginResponse = await fetch("/api/Clients/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalized.email,
          password: form.password,
        }),
      });

      if (loginResponse.ok) {
        const payload = await loginResponse.text().catch(() => "");
        const saved = persistSession(payload);
        if (!saved) {
          setSuccess("Account was created. Please sign in.");
          return;
        }

        await waitForGeneratedAccounts();
        navigate("/accounts", { replace: true });
        return;
      }

      setSuccess("Account was created. Please sign in.");
    } catch {
      setError("Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 bg-muted/30 px-4 py-10">
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <Button variant="ghost" className="mb-2 w-fit px-0" onClick={() => navigate("/login")}>
            <ArrowLeft className="size-4" />
            Back to login
          </Button>
          <CardTitle>Open a ZXC Bank account</CardTitle>
          <CardDescription>Create a client profile and your initial bank accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={updateField("firstName")}
                  autoComplete="given-name"
                  minLength={2}
                  maxLength={60}
                  pattern="[\p{L}' -]{2,60}"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={updateField("lastName")}
                  autoComplete="family-name"
                  minLength={2}
                  maxLength={60}
                  pattern="[\p{L}' -]{2,60}"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={updateField("email")}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phoneNumber}
                  onChange={updatePhone}
                  placeholder="+420123456789"
                  maxLength={13}
                  required
                />
                <p className="text-xs text-muted-foreground">Use 9 digits or +420 followed by 9 digits.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stateName">Country</Label>
                <Input
                  id="stateName"
                  name="zxc-country"
                  value={form.stateName}
                  onChange={updateField("stateName")}
                  autoComplete="off"
                  minLength={2}
                  maxLength={MAX_COUNTRY_LENGTH}
                  required
                />
              </div>
              <div className="relative grid gap-2">
                <Label htmlFor="street">Street</Label>
                <Input
                  id="street"
                  name="zxc-street"
                  value={form.street}
                  onChange={updateStreet}
                  onFocus={() => setIsAddressSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setIsAddressSuggestionsOpen(false), 120)}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={isAddressSuggestionsOpen}
                  minLength={5}
                  maxLength={MAX_STREET_LENGTH}
                  required
                />
                {isAddressSuggestionsOpen && form.street.trim().length >= 3 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 border bg-popover text-popover-foreground shadow-lg ring-1 ring-border">
                    {isAddressLoading && <p className="px-3 py-3 text-sm text-muted-foreground">Searching real addresses...</p>}
                    {!isAddressLoading && addressSearchError && (
                      <p className="px-3 py-3 text-sm text-destructive">{addressSearchError}</p>
                    )}
                    {!isAddressLoading && !addressSearchError && addressSuggestions.length === 0 && (
                      <p className="px-3 py-3 text-sm text-muted-foreground">No real addresses found.</p>
                    )}
                    {!isAddressLoading &&
                      !addressSearchError &&
                      addressSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectAddressSuggestion(item);
                          }}
                        >
                          <span className="block font-medium">{item.street}</span>
                          <span className="block text-xs text-muted-foreground">{item.stateName || "Unknown country"}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
             <div className="md:col-span-2">
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  value={form.password}
                  onChange={updateField("password")}
                  required
                />
                <p className="text-xs text-muted-foreground">Min. 6 characters with upper/lower case, number, and special character.</p>
              </div>
              <div className="grid gap-2 mt-5 ">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={form.confirmPassword}
                  onChange={updateField("confirmPassword")}
                  required
                />
              </div>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full md:w-fit">
              <CheckCircle2 className="size-4" />
              {isSubmitting ? "Creating..." : "Create account"}
            </Button>

            {error && <StateMessage type="error">{error}</StateMessage>}
            {success && <StateMessage type="success">{success}</StateMessage>}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
