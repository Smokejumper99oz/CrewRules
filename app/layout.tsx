import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Whisper } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const whisper = Whisper({ weight: "400", subsets: ["latin"], variable: "--font-whisper" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.crewrules.com"),

  title: "CrewRules™ — The Smart Knowledge Platform for Airline Crew",

  description:
    "Contract clarity and real-world answers for pilots and flight attendants — with verified source citations. Built by airline crew.",

  openGraph: {
    title: "CrewRules™ — The Smart Knowledge Platform for Airline Crew",
    description:
      "Contract clarity and real-world answers for pilots and flight attendants — with verified source citations.",
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
    title: "CrewRules™ — The Smart Knowledge Platform for Airline Crew",
    description:
      "Contract clarity and real-world answers for pilots and flight attendants — with verified source citations.",
    images: ["https://www.crewrules.com/og/crewrules-og.png"],
  },

  icons: {
    icon: "/icons/apple-touch-icon.png",
    shortcut: "/icons/apple-touch-icon.png",
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
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const colorMode = (cookieStore.get("crewrules-color-mode")?.value as "dark" | "light" | "system") ?? "dark";

  return (
    <html lang="en" className={whisper.variable} data-theme={colorMode === "system" ? "dark" : colorMode} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-white" suppressHydrationWarning>
        <ThemeProvider initialTheme={colorMode}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
