import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { getBoilerCostSettings } from "@/data/boiler-cost-settings-service";
import { Card } from "@/components/ui/Card";
import { BoilerCostSettingsForm } from "@/components/settings/BoilerCostSettingsForm";

export default async function BoilerCostSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/settings");

  const settings = await getBoilerCostSettings();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Boiler Install Costs</h2>
        <p className="mt-1 text-sm text-slate-500">
          Margav&rsquo;s real per-install costs — this is what every boiler quote&rsquo;s Profit card uses as its
          cost price. Admin only, and never shown to customers.
        </p>
      </div>

      <Card className="p-5">
        <BoilerCostSettingsForm settings={settings} />
      </Card>
    </div>
  );
}
