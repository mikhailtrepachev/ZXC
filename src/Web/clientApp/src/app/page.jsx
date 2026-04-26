"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasRole } from "../auth/session";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasRole("Administrator") ? "/admin" : "/accounts");
  }, [router]);

  return <div />;
}
