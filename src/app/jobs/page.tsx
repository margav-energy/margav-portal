import Link from "next/link";
import { MapPin } from "lucide-react";
import { requireInstallerUser } from "@/data/current-user";
import { getInstallerJobs } from "@/data/installer-jobs-service";
import { toISODate } from "@/lib/date-utils";
import { formatDate } from "@/lib/format";
import { INSTALL_ACCEPTANCE_STATUS_STYLES, PRODUCT_TYPE_LABELS } from "@/lib/status-colors";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const GRID_COLS = "grid-cols-[2fr_1fr_1fr_1fr]";

/** Upcoming Jobs list — same shape as the Quotes list (a table you click
 *  into for the detail), rather than the old inline cards-with-survey. */
export default async function JobsPage() {
  const user = await requireInstallerUser();

  const jobs = await getInstallerJobs(user.id, toISODate(new Date()));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Upcoming Jobs</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every job you&rsquo;re booked into, nearest first. Open one to see what&rsquo;s being installed, the
          survey, and to accept or reject.
        </p>
      </div>

      {jobs.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">
          No jobs booked in yet — anything the scheduling team books you into will show up here.
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div
            className={`grid items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase ${GRID_COLS}`}
          >
            <span>Customer</span>
            <span>Product</span>
            <span>Install date</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-slate-100">
            {jobs.map((job) => {
              const statusStyle = job.acceptanceStatus ? INSTALL_ACCEPTANCE_STATUS_STYLES[job.acceptanceStatus] : null;
              return (
                <Link
                  key={job.quoteId}
                  href={`/jobs/${job.quoteId}`}
                  className={`grid items-center gap-4 px-5 py-4 hover:bg-slate-50 ${GRID_COLS}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{job.customerName}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {job.address || job.postcode}
                    </p>
                  </div>
                  <span className="text-sm text-slate-600">{PRODUCT_TYPE_LABELS[job.productType]}</span>
                  <span className="text-sm text-slate-600">{formatDate(job.installDate)}</span>
                  <div>{statusStyle && <Pill label={statusStyle.label} className={statusStyle.className} />}</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
