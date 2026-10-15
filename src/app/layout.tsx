import type { Metadata } from "next";
import { Caveat, Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({ variable: "--nf-display", subsets: ["latin"], weight: ["500", "700", "900"] });
const sans = Instrument_Sans({ variable: "--nf-ui", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ variable: "--nf-numbers", subsets: ["latin"], weight: ["400", "600"] });
const hand = Caveat({ variable: "--nf-hand", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Routewell",
  description: "Pay contractors and staff expenses anywhere. Checked by AI, paid through PayPal or PYUSD.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
