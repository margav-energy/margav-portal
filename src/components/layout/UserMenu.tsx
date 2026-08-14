import { Avatar } from "@/components/ui/Avatar";

export function UserMenu({
  firstName,
  initials,
}: {
  firstName: string;
  initials: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar initials={initials} className="h-8 w-8 text-xs" />
      <span className="hidden text-sm font-medium text-slate-700 sm:inline">
        {firstName}
      </span>
    </div>
  );
}
