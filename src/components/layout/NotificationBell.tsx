import { Bell } from "lucide-react";

export function NotificationBell() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
    >
      <Bell className="h-5 w-5" />
    </button>
  );
}
