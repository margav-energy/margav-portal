import { redirect } from "next/navigation";
import { FileText, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/data/current-user";
import { getQuoteSummary, getQuotesByStage } from "@/data/quotes-service";
import { QUICK_LINKS } from "@/lib/quick-links-config";
import { GreetingRow } from "@/components/dashboard/GreetingRow";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickLinksCard } from "@/components/dashboard/QuickLinksCard";
import { QuotesPanel } from "@/components/dashboard/QuotesPanel";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Belt-and-braces: src/proxy.ts already redirects signed-out requests to
  // /login before this ever renders, but every data-fetching entry point
  // should check for itself too (see node_modules/next/dist/docs/01-app/02-guides/authentication.md).
  if (!user) redirect("/login");

  // Installers have no quotes to manage — the sent-to-sign/signed stats
  // and quote panels below are meaningless to them. Their whole "dashboard"
  // is the availability calendar + whatever job they're booked into, which
  // already lives at /availability (see src/app/availability/page.tsx).
  if (user.role === "installer") redirect("/availability");

  const [summary, sentToSign, signed] = await Promise.all([
    getQuoteSummary(),
    getQuotesByStage("sent_to_sign"),
    getQuotesByStage("signed"),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <GreetingRow firstName={user.firstName} initials={user.initials} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Quotes"
          value={summary.totalQuotes}
          href="/quotes"
          linkLabel="View all quotes"
          icon={FileText}
        />
        <StatCard
          label="Total Signed"
          value={summary.totalSigned}
          href="/quotes?stage=signed"
          linkLabel="View all signed"
          icon={CheckCircle2}
          accent="green"
        />
        <QuickLinksCard items={QUICK_LINKS} />
      </div>

      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Quotes
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuotesPanel
          title="Quotes sent to sign"
          viewAllHref="/quotes?stage=sent_to_sign"
          quotes={sentToSign}
          variant="sent"
        />
        <QuotesPanel
          title="Quotes signed"
          viewAllHref="/quotes?stage=signed"
          quotes={signed}
          variant="signed"
        />
      </div>
    </div>
  );
}
