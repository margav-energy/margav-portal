import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AppShellClient } from "@/components/layout/AppShellClient";
import { SupabaseSetupNotice } from "@/components/setup/SupabaseSetupNotice";
import { getCurrentUser } from "@/data/current-user";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Margav Portal",
  description: "Margav Heating internal operations portal",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;

  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen font-sans antialiased">
        {configured ? (
          <AppShellClient user={user}>{children}</AppShellClient>
        ) : (
          <SupabaseSetupNotice />
        )}
      </body>
    </html>
  );
}
