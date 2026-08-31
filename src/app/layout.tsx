import type { Metadata } from "next";
import "./globals.css";
import { BootSequence } from "@/components/BootSequence";

export const metadata: Metadata = {
  title: "CP Phantom — Solo",
  description: "Solo play companion for the CP Phantom homebrew Cyberpunk ruleset.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <BootSequence />
        {children}
      </body>
    </html>
  );
}
