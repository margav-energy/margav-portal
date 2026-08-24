import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { getAllProfiles } from "@/data/profiles-service";
import { Card } from "@/components/ui/Card";
import { UserRoleManager } from "@/components/settings/UserRoleManager";

export default async function TeamMembersSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/settings");

  const profiles = await getAllProfiles();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Team Members</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set who&rsquo;s an admin, a rep, or an installer. Installers get their own &ldquo;My Availability&rdquo;
          page instead of the rep/admin nav. Admin only.
        </p>
      </div>

      <Card className="p-5">
        <UserRoleManager profiles={profiles} currentUserId={user.id} />
      </Card>
    </div>
  );
}
