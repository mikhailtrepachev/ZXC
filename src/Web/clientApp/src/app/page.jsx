"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchSession } from "../auth/session";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    fetchSession({ force: true }).then((session) => {
      const isAdmin = session?.roles?.some((role) => role.toLowerCase() === "administrator");
      router.replace(isAdmin ? "/admin" : "/accounts");
    });
  }, [router]);

  return <div />;
}
