import "server-only";
import { summariseProjectData } from "@/lib/easypv-summary";
import type { EasyPvProjectOption, EasyPvSummary } from "@/types/easypv";

/**
 * Thin client for the Easy PV Pro Open API (https://easy-pv.co.uk/api/v1).
 * Server-only: the key is team-wide (it can read every project, including
 * customer names and addresses), so it must never reach the browser.
 *
 * Every call also needs `userEmail` — a team member with access to the
 * project (the key is shared by the whole team, access is per project). We
 * use one team admin account for all calls, so every project must be shared
 * with it. See EASYPV_API_KEY / EASYPV_API_USER_EMAIL in .env.local.example.
 */

const BASE_URL = "https://easy-pv.co.uk/api/v1";

export function isEasyPvConfigured(): boolean {
  return Boolean(process.env.EASYPV_API_KEY && process.env.EASYPV_API_USER_EMAIL);
}

export function easyPvProjectUrl(projectId: number): string {
  return `https://easy-pv.co.uk/?project=${projectId}`;
}

export class EasyPvError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function easyPvFetch(path: string, init: { method?: string; query?: Record<string, string | number>; body?: unknown } = {}): Promise<Response> {
  const key = process.env.EASYPV_API_KEY;
  const userEmail = process.env.EASYPV_API_USER_EMAIL;
  if (!key || !userEmail) throw new EasyPvError("Easy PV isn't configured (EASYPV_API_KEY / EASYPV_API_USER_EMAIL).");

  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries({ userEmail, ...init.query })) url.searchParams.set(name, String(value));

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "X-API-KEY": key, accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("easyPvFetch network error", path, error);
    throw new EasyPvError("Couldn't reach Easy PV.");
  }
  if (!response.ok) {
    // Never log the URL's query or headers as a whole — only the path and status.
    console.error("easyPvFetch failed", path, response.status);
    throw new EasyPvError(
      response.status === 401 || response.status === 403
        ? "Easy PV rejected the API key."
        : response.status === 404
          ? "Easy PV couldn't find that project — is it shared with the portal's Easy PV account?"
          : `Easy PV returned an error (${response.status}).`,
      response.status,
    );
  }
  return response;
}

/** Projects the portal's Easy PV account can see, newest first. `POST /projects/list`. */
export async function listEasyPvProjects(): Promise<EasyPvProjectOption[]> {
  const today = new Date();
  const end = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const response = await easyPvFetch("/projects/list", {
    method: "POST",
    body: { userEmail: process.env.EASYPV_API_USER_EMAIL, start: "2020-01-01", end },
  });
  const json = (await response.json()) as { projects?: Record<string, unknown>[] };
  return (json.projects ?? [])
    .map((project) => ({
      id: Number(project.ID),
      projectName: String(project.projectName ?? ""),
      customerName: String(project.customerName ?? ""),
      address: String(project.address ?? ""),
      postcode: String(project.postcode ?? ""),
      dateModified: String(project.dateModified ?? ""),
    }))
    .sort((a, b) => b.dateModified.localeCompare(a.dateModified));
}

/** `GET /projects/data`, reduced to what the quote page shows. */
export async function fetchEasyPvSummary(projectId: number): Promise<EasyPvSummary> {
  const response = await easyPvFetch("/projects/data", { query: { projectId } });
  return summariseProjectData((await response.json()) as Record<string, unknown>);
}

export interface EasyPvFileEntry {
  category: "images" | "uploads";
  groupName: string;
  name: string;
  modified?: string;
}

/**
 * Files saved to the project, from `GET /files/list`. Easy PV nests them as
 * `fileRegistry.<category>.<group>[]` — we only keep the two categories the
 * quote page uses: `images` (design snapshots + satellite maps) and `uploads`
 * (the customer proposal and other generated PDFs, which only exist once
 * someone has clicked Save in Easy PV).
 */
export async function listEasyPvFiles(projectId: number): Promise<EasyPvFileEntry[]> {
  const response = await easyPvFetch("/files/list", { query: { type: "projects", id: projectId } });
  const json = (await response.json()) as {
    fileRegistry?: Record<string, Record<string, { name?: string; modified?: string }[]>>;
  };
  const entries: EasyPvFileEntry[] = [];
  for (const category of ["images", "uploads"] as const) {
    for (const [groupName, files] of Object.entries(json.fileRegistry?.[category] ?? {})) {
      for (const file of Array.isArray(files) ? files : []) {
        if (file.name) entries.push({ category, groupName, name: file.name, modified: file.modified });
      }
    }
  }
  return entries;
}

/** `GET /files/file` (raw bytes). */
export async function downloadEasyPvFile(
  projectId: number,
  category: "images" | "uploads",
  name: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await easyPvFetch("/files/file", {
    query: { type: "projects", id: projectId, fileCategory: category, file: name, responseFormat: "raw" },
  });
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "" };
}

/** `POST /projects/create` — owned by the portal's Easy PV account. Returns the new project's id. */
export async function createEasyPvProject(meta: {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address: string;
  postcode: string;
  crmReference: string;
}): Promise<number> {
  const response = await easyPvFetch("/projects/create", {
    method: "POST",
    body: {
      owner: process.env.EASYPV_API_USER_EMAIL,
      meta: { projectType: "three-d-model", status: "Quote", ...meta },
    },
  });
  const json = (await response.json()) as { projectId?: number | string };
  const projectId = Number(json.projectId);
  if (!projectId) throw new EasyPvError("Easy PV didn't return a project id.");
  return projectId;
}
