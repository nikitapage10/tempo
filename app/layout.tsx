import type { Metadata, Viewport } from "next";
import { Inter, Jura } from "next/font/google";
import { LightfieldRoot } from "@/components/lightfield";
import { FirstOpenReveal } from "@/components/origin/first-open-reveal";
import { Providers } from "@/components/providers";
import "./globals.css";

const jura = Jura({
  subsets: ["latin"],
  variable: "--font-jura",
  weight: "variable",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500"],
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
  return (
    <html
      lang="en"
      className={`${jura.variable} ${inter.variable}`}
    >
      <body>
        <Providers>
          <LightfieldRoot>{children}</LightfieldRoot>
          <FirstOpenReveal />
        </Providers>
      </body>
    </html>
  );
}
