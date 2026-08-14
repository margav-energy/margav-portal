import { Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export function GreetingRow({
  firstName,
  initials,
}: {
  firstName: string;
  initials: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar initials={initials} />
      <h2 className="flex-1 text-2xl font-semibold text-slate-900">
        Hi, {firstName}
      </h2>
      <Button href="/settings" variant="secondary">
        <Settings className="h-4 w-4" />
        Settings
      </Button>
    </div>
  );
}
