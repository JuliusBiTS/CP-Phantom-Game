import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CP Phantom — Solo",
  description: "Solo play companion for the CP Phantom homebrew Cyberpunk ruleset.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
