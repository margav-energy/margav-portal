/** The customer-facing trading name: "MarGav Solar" for solar quotes, "Margav Heating" for boilers and anything else. */
export function brandNameForProduct(productTypeLabel: string | undefined | null): string {
  return productTypeLabel && productTypeLabel !== "Boiler" ? "MarGav Solar" : "Margav Heating";
}
