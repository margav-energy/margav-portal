import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AppShellClient } from "@/components/layout/AppShellClient";
import { getCurrentUser } from "@/data/current-user";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Margav Portal",
  description: "Margav Energy internal operations portal",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AppShellClient user={user}>{children}</AppShellClient>
      </body>
    </html>
  );
}
