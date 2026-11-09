import type { Metadata } from "next";
import { ClerkClientProvider } from "@/components/clerk-client-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "UTMP — Universal Tournament Platform",
  description: "Discover sports, follow tournament schedules and results, and find your next competition.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  return (
    <html lang="en">
      <body><ClerkClientProvider enabled={clerkConfigured}>{children}</ClerkClientProvider></body>
    </html>
  );
}
