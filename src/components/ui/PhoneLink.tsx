export function PhoneLink({ phone }: { phone: string }) {
  // Blank when the viewer isn't allowed to see it — see `canViewCustomerPhone`.
  if (!phone) return <span className="text-sm text-slate-400">—</span>;
  return (
    <a
      href={`tel:${phone.replace(/\s+/g, "")}`}
      className="text-sm font-medium text-brand-blue hover:underline"
    >
      {phone}
    </a>
  );
}
