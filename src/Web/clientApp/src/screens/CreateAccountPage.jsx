"use client";

import { useState } from "react";
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

  const updateField = (field) => (event) => {
    setForm((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalized = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      stateName: form.stateName.trim(),
      street: form.street.trim(),
    };

    if (!normalized.firstName || !normalized.lastName) {
      setError("Fill in first and last name.");
      return;
    }

    if (!/^\+?[0-9\s\-()]{7,20}$/.test(normalized.phoneNumber)) {
      setError("Enter a valid phone number.");
      return;
    }

    if (!normalized.stateName || !normalized.street) {
      setError("Fill in country and street.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!PASSWORD_POLICY_REGEX.test(form.password)) {
      setError("Password must contain upper/lower case letters, a number, and a special character.");
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
        persistSession(payload);
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
    <main className="min-h-[calc(100vh-8rem)] bg-muted/30 px-4 py-10">
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
                <Input id="firstName" value={form.firstName} onChange={updateField("firstName")} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={form.lastName} onChange={updateField("lastName")} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={updateField("email")} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={form.phoneNumber} onChange={updateField("phoneNumber")} placeholder="+420 123 456 789" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stateName">Country</Label>
                <Input id="stateName" value={form.stateName} onChange={updateField("stateName")} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="street">Street</Label>
                <Input id="street" value={form.street} onChange={updateField("street")} required />
              </div>
             <div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" minLength={6} value={form.password} onChange={updateField("password")} required />
                <p className="text-xs text-muted-foreground">Min. 6 characters with upper/lower case, number, and special character.</p>
              </div>
              <div className="grid gap-2 mt-5 ">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={updateField("confirmPassword")} required />
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
