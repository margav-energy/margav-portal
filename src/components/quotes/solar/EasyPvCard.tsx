"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, RefreshCw, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { importEasyPvItems } from "@/components/quotes/actions";
import {
  createEasyPvProjectForQuote,
  linkEasyPvProject,
  refreshEasyPvSummary,
  searchEasyPvProjects,
  unlinkEasyPvProject,
  saveProposalSkipPages,
  setQuoteImageFromEasyPv,
} from "@/components/quotes/easypv-actions";
import type { EasyPvFile, EasyPvLink, EasyPvProjectOption, EasyPvSummary } from "@/types/easypv";

function easyPvProjectUrl(projectId: number): string {
  return `https://easy-pv.co.uk/?project=${projectId}`;
}

function formatRoof(roof: EasyPvSummary["roofs"][number]): string {
  const parts = [roof.label || "Roof", `${roof.panelCount} panels`];
  if (roof.pitch !== undefined) parts.push(`${roof.pitch}° pitch`);
  if (roof.orientation !== undefined) parts.push(`${roof.orientation}° from south`);
  return parts.join(" · ");
}

/**
 * The quote's link to its Easy PV design: create or link a project, then
 * "Refresh from Easy PV" pulls the system summary and bill of materials
 * (src/data/easypv-service.ts). Easy PV can't notify us of changes, so the
 * summary only updates when someone clicks Refresh — and its bill of
 * materials itself only refreshes when the project overview is opened in
 * Easy PV, so open that first if the numbers look stale.
 */
export function EasyPvCard({ quoteId, link: initial }: { quoteId: string; link: EasyPvLink }) {
  const [projectId, setProjectId] = useState(initial.projectId);
  const [summary, setSummary] = useState(initial.summary);
  const [syncedAt, setSyncedAt] = useState(initial.syncedAt);
  const [files, setFiles] = useState<EasyPvFile[]>(initial.files);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPicking, setIsPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EasyPvProjectOption[] | null>(null);
  const [showBom, setShowBom] = useState(false);
  const router = useRouter();
  const [markup, setMarkup] = useState("");
  const [skipPages, setSkipPages] = useState(initial.proposalSkipPages ?? "");
  const [skipSaved, setSkipSaved] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  if (!initial.configured) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">Easy PV design</h3>
        <p className="mt-2 text-sm text-slate-500">
          Easy PV isn&rsquo;t connected yet — an admin needs to add the Easy PV API key to the server settings.
        </p>
      </Card>
    );
  }

  function run(work: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      await work();
    });
  }

  function handleCreate() {
    run(async () => {
      const result = await createEasyPvProjectForQuote(quoteId);
      if (!result.ok) return setError(result.error);
      setProjectId(result.projectId);
    });
  }

  function handleSearch() {
    run(async () => {
      const result = await searchEasyPvProjects(quoteId, query);
      if (!result.ok) return setError(result.error);
      setResults(result.projects);
    });
  }

  function handleLink(id: number) {
    run(async () => {
      const result = await linkEasyPvProject(quoteId, id);
      if (!result.ok) return setError(result.error);
      setProjectId(id);
      setSummary(result.summary);
      setFiles(result.files);
      setSyncedAt(new Date().toISOString());
      setIsPicking(false);
      setResults(null);
      router.refresh();
    });
  }

  function handleRefresh() {
    run(async () => {
      const result = await refreshEasyPvSummary(quoteId);
      if (!result.ok) return setError(result.error);
      setSummary(result.summary);
      setFiles(result.files);
      setSyncedAt(new Date().toISOString());
      // The solar design image above may have changed too.
      router.refresh();
    });
  }

  function handleImport() {
    const markupPct = Number(markup);
    if (markup.trim() === "" || !Number.isFinite(markupPct) || markupPct < 0) {
      setError("Enter the markup to add to Midsummer's cost (0 for none).");
      return;
    }
    if (
      !window.confirm(
        "Replace this quote's solar arrays, equipment and extras with the Easy PV items? Standard additionals and free-text extras are kept, and you can add or remove items afterwards.",
      )
    ) {
      return;
    }
    run(async () => {
      const result = await importEasyPvItems(quoteId, markupPct);
      if (!result.ok) return setError(result.error);
      setImportNote(
        `Imported — cost ${formatCurrency(result.costTotal)}, selling ${formatCurrency(result.sellTotal)}.${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`,
      );
      // The quote's arrays/equipment/pricing live in client state further up the page; reload so they all show the new items.
      window.setTimeout(() => window.location.reload(), 1500);
    });
  }

  function handleSaveSkipPages() {
    setSkipSaved(false);
    run(async () => {
      const result = await saveProposalSkipPages(quoteId, skipPages);
      if (!result.ok) return setError(result.error);
      setSkipSaved(true);
    });
  }

  function handleUnlink() {
    if (!window.confirm("Unlink this quote from its Easy PV project? The project itself isn't deleted.")) return;
    run(async () => {
      const result = await unlinkEasyPvProject(quoteId);
      if (!result.ok) return setError(result.error);
      setProjectId(undefined);
      setSummary(undefined);
      setFiles([]);
      setSyncedAt(undefined);
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Easy PV design</h3>
          {projectId && (
            <p className="mt-0.5 text-xs text-slate-500">
              Project {projectId}
              {syncedAt ? ` · refreshed ${formatDateTime(syncedAt)}` : " · not refreshed yet"}
            </p>
          )}
        </div>
        {projectId && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" href={easyPvProjectUrl(projectId)} target="_blank" className="gap-1.5 px-3 py-1.5 text-xs">
              Open in Easy PV
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="primary" onClick={handleRefresh} disabled={isPending} className="gap-1.5 px-3 py-1.5 text-xs">
              <RefreshCw className={isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh from Easy PV
            </Button>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!projectId && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">Not linked to an Easy PV project yet.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleCreate} disabled={isPending}>
              Create in Easy PV
            </Button>
            <Button variant="secondary" onClick={() => setIsPicking((open) => !open)} disabled={isPending}>
              Link existing project
            </Button>
          </div>

          {isPicking && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                  placeholder="Customer name, address or postcode"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-blue"
                />
                <Button variant="secondary" onClick={handleSearch} disabled={isPending} className="gap-1.5">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>
              {results && results.length === 0 && <p className="text-sm text-slate-500">No matching projects.</p>}
              {results && results.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {results.map((project) => (
                    <li key={project.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{project.projectName || `Project ${project.id}`}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[project.customerName, project.address, project.postcode].filter(Boolean).join(" · ") || "No customer details"}
                        </p>
                      </div>
                      <Button variant="secondary" onClick={() => handleLink(project.id)} disabled={isPending} className="shrink-0 px-3 py-1.5 text-xs">
                        Link
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {projectId && !summary && (
        <p className="text-sm text-slate-500">
          Click &ldquo;Refresh from Easy PV&rdquo; to bring in the design once it&rsquo;s been saved in Easy PV.
        </p>
      )}

      {projectId && files.length > 0 && (
        <EasyPvFiles
          files={files}
          disabled={isPending}
          skipPages={skipPages}
          onSkipPagesChange={(value) => {
            setSkipPages(value);
            setSkipSaved(false);
          }}
          onSaveSkipPages={handleSaveSkipPages}
          skipSaved={skipSaved}
          onUseAsQuoteImage={(fileId) =>
            run(async () => {
              const result = await setQuoteImageFromEasyPv(quoteId, fileId);
              if (!result.ok) return setError(result.error);
              router.refresh();
            })
          }
        />
      )}

      {summary && (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            {summary.systemKwp !== undefined && (
              <div>
                <dt className="text-xs text-slate-500">System size</dt>
                <dd className="font-medium text-slate-900">{summary.systemKwp} kWp</dd>
              </div>
            )}
            {summary.batteryKwh !== undefined && (
              <div>
                <dt className="text-xs text-slate-500">Battery</dt>
                <dd className="font-medium text-slate-900">{summary.batteryKwh} kWh</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">Materials (ex VAT)</dt>
              <dd className="font-medium text-slate-900">{formatCurrency(summary.materialsTotal)}</dd>
            </div>
          </dl>

          {[
            ["Panels", summary.panels],
            ["Inverter", summary.inverters],
            ["Battery", summary.batteries],
          ].map(([label, items]) =>
            (items as EasyPvSummary["panels"]).length > 0 ? (
              <div key={label as string}>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label as string}</p>
                <ul className="mt-1 text-sm text-slate-800">
                  {(items as EasyPvSummary["panels"]).map((item) => (
                    <li key={item.name}>
                      {item.qty} &times; {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}

          {summary.roofs.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Roofs</p>
              <ul className="mt-1 text-sm text-slate-800">
                {summary.roofs.map((roof, index) => (
                  <li key={`${roof.label}-${index}`}>{formatRoof(roof)}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.otherItems.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowBom((open) => !open)} className="text-xs font-medium text-brand-blue hover:underline">
                {showBom ? "Hide" : "Show"} mounting &amp; electrical items ({summary.otherItems.length})
              </button>
              {showBom && (
                <ul className="mt-1 text-sm text-slate-800">
                  {summary.otherItems.map((item) => (
                    <li key={item.name}>
                      {item.qty} &times; {item.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {initial.tally && <TallyCheck tally={initial.tally} />}

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Use these items on the quote</p>
            {summary.cart && summary.cart.length > 0 ? (
              <>
                <p className="text-xs text-slate-500">
                  Easy PV prices are Midsummer&rsquo;s cost, ex VAT. Quotes are VAT-inclusive, so include VAT in the markup
                  (e.g. 20% VAT and a 30% margin is about 56%).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    Markup
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={markup}
                      onChange={(event) => setMarkup(event.target.value)}
                      placeholder="%"
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
                    />
                  </label>
                  <Button variant="primary" onClick={handleImport} disabled={isPending}>
                    Import items into quote
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Click &ldquo;Refresh from Easy PV&rdquo; to load the priced items first.</p>
            )}
            {importNote && <p className="text-sm text-brand-green-mid">{importNote}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {summary.midsummerOrderLink && (
              <Button variant="secondary" href={summary.midsummerOrderLink} target="_blank" className="gap-1.5 px-3 py-1.5 text-xs">
                Order kit from Midsummer
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            <button type="button" onClick={handleUnlink} disabled={isPending} className="text-xs text-slate-400 hover:text-red-600">
              Unlink project
            </button>
          </div>
        </div>
      )}

      {projectId && !summary && (
        <button type="button" onClick={handleUnlink} disabled={isPending} className="w-fit text-xs text-slate-400 hover:text-red-600">
          Unlink project
        </button>
      )}
    </Card>
  );
}

/** Does the quote still hold everything in Easy PV's cart? Shows what's missing or changed, and how the totals compare. */
function TallyCheck({ tally }: { tally: NonNullable<EasyPvLink["tally"]> }) {
  const matches = tally.differences.length === 0;
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border p-3 text-sm ${matches ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"}`}
    >
      <p className={`text-xs font-semibold tracking-wide uppercase ${matches ? "text-brand-green-mid" : "text-amber-700"}`}>
        {matches ? "Quote matches Easy PV" : "Quote differs from Easy PV"}
      </p>
      {!matches && (
        <ul className="text-sm text-slate-800">
          {tally.differences.map((difference) => (
            <li key={difference.name}>
              {difference.name}: Easy PV {difference.easyPvQty}, quote {difference.quoteQty}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-600">
        Easy PV materials {formatCurrency(tally.easyPvCost)}
        {tally.expectedSell !== undefined && tally.markupPct !== undefined
          ? ` → ${formatCurrency(tally.expectedSell)} with the ${tally.markupPct}% markup`
          : ""}
        . Those items on the quote: {formatCurrency(tally.quoteSell)}.
      </p>
      {!matches && (
        <p className="text-xs text-slate-600">
          If a line was removed or changed on purpose that&rsquo;s fine; otherwise re-import the items.
        </p>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Design views (the JPG snapshots), the proposal / report PDFs, and the satellite maps, as copied from Easy PV. */
function EasyPvFiles({
  files,
  disabled,
  skipPages,
  onSkipPagesChange,
  onSaveSkipPages,
  skipSaved,
  onUseAsQuoteImage,
}: {
  files: EasyPvFile[];
  disabled: boolean;
  skipPages: string;
  onSkipPagesChange: (value: string) => void;
  onSaveSkipPages: () => void;
  skipSaved: boolean;
  onUseAsQuoteImage: (fileId: string) => void;
}) {
  const designViews = files.filter((file) => file.category === "images" && file.contentType === "image/jpeg");
  const maps = files.filter((file) => file.category === "images" && file.contentType !== "image/jpeg");
  const documents = files.filter((file) => file.category === "uploads");

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
      {designViews.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Design views</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {designViews.map((file) => (
              <div key={file.id} className="flex flex-col gap-1">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${file.name}`}
                  className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a next/image candidate. */}
                  <img src={file.url} alt="Easy PV design view" className="h-full w-full object-cover" />
                </a>
                <button
                  type="button"
                  onClick={() => onUseAsQuoteImage(file.id)}
                  disabled={disabled}
                  className="w-fit text-xs font-medium text-brand-blue hover:underline disabled:opacity-50"
                >
                  Use as quote image
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Easy PV documents</p>
          <ul className="mt-1 flex flex-col gap-1">
            {documents.map((file) => (
              <li key={file.id}>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-brand-blue hover:underline"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{file.name.replace("~", " – ")}</span>
                  <span className="shrink-0 text-xs font-normal text-slate-400">{formatSize(file.sizeBytes)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {maps.length > 0 && (
        <p className="text-xs text-slate-500">
          Site maps:{" "}
          {maps.map((file, index) => (
            <span key={file.id}>
              {index > 0 && ", "}
              <a href={file.url} target="_blank" rel="noreferrer" className="font-medium text-brand-blue hover:underline">
                {index === 0 ? "satellite view" : `view ${index + 1}`}
              </a>
            </span>
          ))}
        </p>
      )}

      {documents.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            The customer is sent this proposal with the portal&rsquo;s quote sheet (your prices, extras and discount) added
            at the end. Leave out Easy PV&rsquo;s own Quote page &mdash; and any other page showing Easy PV&rsquo;s prices
            &mdash; by entering its page number(s) from the proposal&rsquo;s contents.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Pages to leave out
              <input
                value={skipPages}
                onChange={(event) => onSkipPagesChange(event.target.value)}
                placeholder="e.g. 9-11"
                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
              />
            </label>
            <Button variant="secondary" onClick={onSaveSkipPages} disabled={disabled} className="px-3 py-1.5 text-xs">
              Save
            </Button>
            {skipSaved && <span className="text-xs text-brand-green-mid">Saved</span>}
          </div>
        </div>
      )}

      {documents.length === 0 && (
        <p className="text-xs text-slate-500">
          No proposal PDF yet — in Easy PV, open Customer Proposal and click Save, then refresh here.
        </p>
      )}
    </div>
  );
}
