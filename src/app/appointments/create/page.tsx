import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { getAppointmentForRebook } from "@/data/appointments-service";
import { CreateAppointmentForm } from "@/components/appointments/CreateAppointmentForm";

// Admin-only — reps work appointments an admin has already booked, they
// don't create new ones (same "admin creates, rep works" split as quotes —
// see `createQuote`'s role check in src/components/quotes/actions.ts).
export default async function CreateAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const firstName = typeof params.firstName === "string" ? params.firstName : undefined;
  const lastName = typeof params.lastName === "string" ? params.lastName : undefined;
  const rebookFrom = typeof params.rebookFrom === "string" ? params.rebookFrom : undefined;

  // Fetched here (server-side) rather than in the client form, so "Rebook" links
  // (Recently Cancelled table, a quote's "Rebook App" button) prefill the whole
  // form — not just the name — instead of asking for everything again.
  const rebookDetails = rebookFrom ? await getAppointmentForRebook(rebookFrom) : null;
  const initialValues = rebookDetails ?? (firstName || lastName ? { firstName, lastName } : undefined);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">
        Create a Calendar Appointment
      </h2>
      <CreateAppointmentForm initialValues={initialValues} rebookFrom={rebookFrom} />
    </div>
  );
}
