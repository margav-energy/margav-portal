"use client";

import { useState } from "react";
import { User, Mail, Phone, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { CopyButton } from "@/components/ui/CopyButton";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { updateQuoteCustomer } from "@/components/quotes/actions";
import type { CustomerDetails } from "@/types/quote-detail-shared";

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
        <div className="min-w-0 text-sm text-slate-700">{children}</div>
      </div>
    </div>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onSave,
}: {
  customer: CustomerDetails;
  onClose: () => void;
  onSave: (customer: CustomerDetails) => void;
}) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.addressLines.join("\n"));

  function handleSave() {
    if (!name.trim()) return;
    const updated: CustomerDetails = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      addressLines: address
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
    onSave(updated);
    onClose();
  }

  return (
    <Modal title="Edit customer details" onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <FormField label="Name" htmlFor="customer-name" required>
          <input
            id="customer-name"
            className={inputClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField label="Email" htmlFor="customer-email">
          <input
            id="customer-email"
            type="email"
            className={inputClassName}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField label="Phone" htmlFor="customer-phone">
          <input
            id="customer-phone"
            className={inputClassName}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </FormField>
        <FormField label="Address" htmlFor="customer-address">
          <textarea
            id="customer-address"
            rows={4}
            className={inputClassName}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="One line per address line"
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

export function CustomerCard({
  quoteId,
  customer,
  onUpdated,
}: {
  quoteId: string;
  customer: CustomerDetails;
  onUpdated: (customer: CustomerDetails) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const address = customer.addressLines.join("\n");

  function handleSave(updated: CustomerDetails) {
    onUpdated(updated);
    void updateQuoteCustomer(quoteId, updated);
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Customer details</h3>
        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <Row icon={<User className="h-4 w-4" />}>
          <span className="font-medium text-slate-900">{customer.name}</span>
        </Row>
        <Row icon={<Mail className="h-4 w-4" />}>
          <div className="flex items-center gap-1.5">
            <a href={`mailto:${customer.email}`} className="truncate text-brand-blue hover:underline">
              {customer.email}
            </a>
            <CopyButton value={customer.email} />
          </div>
        </Row>
        <Row icon={<Phone className="h-4 w-4" />}>
          <div className="flex items-center gap-1.5">
            <PhoneLink phone={customer.phone} />
            <CopyButton value={customer.phone} />
          </div>
        </Row>
        <Row icon={<MapPin className="h-4 w-4" />}>
          <div className="flex items-start gap-1.5">
            <p className="whitespace-pre-line">{address}</p>
            <CopyButton value={address} />
          </div>
        </Row>
      </div>

      {isEditing && (
        <EditCustomerModal customer={customer} onClose={() => setIsEditing(false)} onSave={handleSave} />
      )}
    </Card>
  );
}
