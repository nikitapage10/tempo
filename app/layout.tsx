import type { Metadata, Viewport } from "next";
import { Inter, Jura } from "next/font/google";
import { LightfieldRoot } from "@/components/lightfield";
import { FirstOpenReveal } from "@/components/origin/first-open-reveal";
import { Providers } from "@/components/providers";
import "./globals.css";

/* Jura carries the UI; Inter is kept only for numerals (Jura's dotted zero). */
const jura = Jura({
  subsets: ["latin"],
  variable: "--font-jura",
  weight: "variable",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TEMPO",
  description: "Music project management for working artists",
  applicationName: "TEMPO",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TEMPO",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
  colorScheme: "dark",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang="en" className={`${jura.variable} ${inter.variable}`}>
      <head>
        {supabaseUrl ? (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        ) : null}
      </head>
      <body>
        <Providers>
          <LightfieldRoot>{children}</LightfieldRoot>
          <FirstOpenReveal />
        </Providers>
      </body>
    </html>
  );
}
