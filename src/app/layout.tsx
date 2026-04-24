import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
