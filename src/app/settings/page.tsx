import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { getProfileById } from "@/data/profiles-service";
import { getMySignatureUrl } from "@/data/profile-signature-service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { SignatureSettingsCard } from "@/components/settings/SignatureSettingsCard";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, signatureUrl] = await Promise.all([getProfileById(user.id), getMySignatureUrl()]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile details and account security.
        </p>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Profile</h3>
        <ProfileForm fullName={profile?.fullName ?? ""} email={user.email} />
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Password</h3>
        <PasswordForm />
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-semibold text-slate-900">My signature</h3>
        <SignatureSettingsCard signatureUrl={signatureUrl} />
      </Card>

      {user.role === "admin" && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <h3 className="font-semibold text-slate-900">Team Members</h3>
            <p className="mt-1 text-sm text-slate-500">
              Set who&rsquo;s an admin, a rep, or an installer.
            </p>
          </div>
          <Button href="/settings/users" variant="secondary">
            Manage
          </Button>
        </Card>
      )}

      {user.role === "admin" && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <h3 className="font-semibold text-slate-900">Presenter Deck</h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload the sales deck reps present to customers.
            </p>
          </div>
          <Button href="/settings/presenter-deck" variant="secondary">
            Manage
          </Button>
        </Card>
      )}

      {user.role === "admin" && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <h3 className="font-semibold text-slate-900">Boiler Install Costs</h3>
            <p className="mt-1 text-sm text-slate-500">
              The cost figures behind every boiler quote&rsquo;s profit calculation.
            </p>
          </div>
          <Button href="/settings/boiler-costs" variant="secondary">
            Manage
          </Button>
        </Card>
      )}
    </div>
  );
}
