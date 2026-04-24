import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriPilot",
  description: "Calculate and optimize the meals you already want to cook.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script
          src="https://developer.edamam.com/attribution/badge.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
