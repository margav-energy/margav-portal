import { User, Mail, Phone, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { CopyButton } from "@/components/ui/CopyButton";
import type { CustomerDetails } from "@/types/quote-detail-shared";

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1 text-sm text-slate-700">{children}</div>
    </div>
  );
}

/** Read-only counterpart of the admin/rep `CustomerCard` — same layout, no
 *  Edit button. Installers need the contact details to reach the customer
 *  but have no reason to change them from this page. */
export function InstallerCustomerCard({ customer }: { customer: CustomerDetails }) {
  const address = customer.addressLines.join("\n");

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Customer details</h3>
      <div className="flex flex-col gap-3">
        <Row icon={<User className="h-4 w-4" />}>
          <span className="font-medium text-slate-900">{customer.name}</span>
        </Row>
        {customer.email && (
          <Row icon={<Mail className="h-4 w-4" />}>
            <div className="flex items-center gap-1.5">
              <a href={`mailto:${customer.email}`} className="truncate text-brand-blue hover:underline">
                {customer.email}
              </a>
              <CopyButton value={customer.email} />
            </div>
          </Row>
        )}
        {customer.phone && (
          <Row icon={<Phone className="h-4 w-4" />}>
            <div className="flex items-center gap-1.5">
              <PhoneLink phone={customer.phone} />
              <CopyButton value={customer.phone} />
            </div>
          </Row>
        )}
        {address && (
          <Row icon={<MapPin className="h-4 w-4" />}>
            <div className="flex items-start gap-1.5">
              <p className="whitespace-pre-line">{address}</p>
              <CopyButton value={address} />
            </div>
          </Row>
        )}
      </div>
    </Card>
  );
}
