"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingPanel } from "@/components/app-shell";
import { getAccessToken, getDashboardPath } from "@/lib/api";

export default function AuthenticationCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing your UTMP sign-in…");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("createSport");
    const sport = requested === "cricket" || requested === "high-jump" ? requested : "";
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void getDashboardPath(sport).then((path) => router.replace(path)).catch(() => {
      setMessage("Your account is ready. Open your profile to continue.");
      router.replace("/profile");
    });
  }, [router]);

  return <main className="workspace-page"><section className="workspace-content"><LoadingPanel message={message} /></section></main>;
}
