import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.crewrules.com"),

  title: "CrewRules™ — The Smart Knowledge Platform for Airline Pilots",

  description:
    "Contract clarity, mentoring support, and trusted answers — all in one place. Built by airline pilots.",

  openGraph: {
    title: "CrewRules™ — The Smart Knowledge Platform for Airline Pilots",
    description:
      "Contract clarity, mentoring support, and trusted answers for airline pilots.",
    url: "https://www.crewrules.com",
    siteName: "CrewRules™",
    images: [
      {
        url: "https://www.crewrules.com/og/crewrules-og.png",
        width: 1792,
        height: 1024,
        alt: "CrewRules™ Pilot Knowledge Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "CrewRules™ — The Smart Knowledge Platform for Airline Pilots",
    description:
      "Contract clarity, mentoring support, and trusted answers.",
    images: ["https://www.crewrules.com/og/crewrules-og.png"],
  },

  icons: {
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  applicationName: "CrewRules™",

  appleWebApp: {
    title: "CrewRules™",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-white antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
