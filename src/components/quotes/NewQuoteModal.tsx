"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createQuote, type CreateQuoteInput } from "@/components/quotes/actions";

const EMPTY: CreateQuoteInput = {
  customerName: "",
  postcode: "",
  address: "",
  productType: "solar",
  amount: 0,
  paymentType: "cash",
};

export function NewQuoteModal({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState<CreateQuoteInput>(EMPTY);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  function update<K extends keyof CreateQuoteInput>(field: K, value: CreateQuoteInput[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.customerName.trim()) {
      setError("Customer name is required.");
      return;
    }

    setIsSaving(true);
    setError(undefined);
    const result = await createQuote(values);
    setIsSaving(false);

    if (result.error || !result.id) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    onClose();
    router.push(`/quotes/${result.id}`);
  }

  return (
    <Modal title="New quote" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <FormField label="Customer name" required htmlFor="customerName">
          <input
            id="customerName"
            className={inputClassName}
            value={values.customerName}
            onChange={(event) => update("customerName", event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Postcode" htmlFor="postcode">
          <input
            id="postcode"
            className={inputClassName}
            value={values.postcode}
            onChange={(event) => update("postcode", event.target.value)}
          />
        </FormField>
        <FormField label="Address" htmlFor="address">
          <input
            id="address"
            className={inputClassName}
            value={values.address}
            onChange={(event) => update("address", event.target.value)}
          />
        </FormField>
        <FormField label="Product" required htmlFor="productType">
          <select
            id="productType"
            className={inputClassName}
            value={values.productType}
            onChange={(event) => update("productType", event.target.value as CreateQuoteInput["productType"])}
          >
            <option value="solar">Solar</option>
            <option value="boiler">Boiler</option>
          </select>
        </FormField>
        <FormField label="Amount" required htmlFor="amount">
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            className={inputClassName}
            value={values.amount}
            onChange={(event) => update("amount", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Payment type" required htmlFor="paymentType">
          <select
            id="paymentType"
            className={inputClassName}
            value={values.paymentType}
            onChange={(event) => update("paymentType", event.target.value as CreateQuoteInput["paymentType"])}
          >
            <option value="cash">Cash</option>
            <option value="finance">Finance</option>
            <option value="card">Card</option>
            <option value="bacs">BACS</option>
          </select>
        </FormField>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="success" disabled={isSaving}>
            {isSaving ? "Creating…" : "Create quote"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
