import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrewRules™ — The Smart Knowledge Platform for Airline Pilots",
  description:
    "Contract clarity. Mentoring support. Trusted answers — all in one place. Built by airline pilots to simplify complex agreements and support professional growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
