export function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/\s+/g, "")}`}
      className="text-sm font-medium text-brand-blue hover:underline"
    >
      {phone}
    </a>
  );
}
