export const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-blue focus:bg-white focus:ring-1 focus:ring-brand-blue";

export function FormField({
  label,
  required,
  htmlFor,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[180px_1fr] sm:items-start sm:gap-4">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-600 sm:pt-2 sm:text-right"
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="flex flex-col gap-1">
        {children}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
