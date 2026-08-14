import { Users } from "lucide-react";

export function TeamMembersBadge({ count }: { count: number }) {
  return (
    <button
      type="button"
      aria-label={`${count} team members`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
    >
      <Users className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-green-gradient px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
