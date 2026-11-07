import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "github-metrics | GitHub Contribution Analytics",
  description:
    "A minimal GitHub analytics dashboard for visualizing contributions and developer activity.",
  openGraph: {
    title: "github-metrics",
    description: "A closer look at the work, one contribution at a time.",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
