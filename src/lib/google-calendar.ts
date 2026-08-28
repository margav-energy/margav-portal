import "server-only";

/**
 * Google Calendar — creates an event on Lucy's calendar the moment an
 * appointment is booked, so she can see the customer's name, address,
 * contact details, and notes at a glance without opening the portal.
 *
 * Authenticates as Lucy herself via a standard OAuth2 refresh token (a
 * plain "web application" OAuth client + `https://oauth2.googleapis.com/token`
 * refresh-token exchange) — not a service account. The org's Cloud IAM
 * policy blocks service-account key creation
 * (`iam.disableServiceAccountKeyCreation`), which the original
 * domain-wide-delegation design depended on; this refreshtoken approach
 * doesn't need a service account or a key at all, so that policy doesn't
 * apply here.
 *
 * The refresh token is obtained once, manually, via Google's OAuth
 * Playground (developers.google.com/oauthplayground) — not through an
 * in-app consent route, since this is a one-time setup step for one person
 * (Lucy), not a recurring per-user flow. See .env.local.example for the
 * exact steps.
 *
 * Same "server-only, raw fetch, fail-soft" style as
 * src/lib/address-lookup.ts and src/lib/google-street-view.ts: if
 * unconfigured or the API call fails, this logs and returns `null` rather
 * than throwing, so a calendar hiccup can never fail the appointment
 * booking itself — see the fire-and-forget call site in
 * src/components/appointments/actions.ts.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIME_ZONE = "Europe/London";
const DEFAULT_DURATION_MINUTES = 60;

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
  );
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/** Exchanges the long-lived refresh token for a short-lived access token, cached in-process until shortly before it expires. */
async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN!,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    console.error("Google Calendar token refresh failed", response.status, await response.text());
    return null;
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

export interface AppointmentCalendarEventInput {
  customerName: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  product: string;
  notes: string;
  source?: string;
  medium?: string;
  /** appointment_date, e.g. "2026-08-16" */
  date: string;
  /** start_time, "HH:mm" or "HH:mm:ss" */
  startTime: string;
  /** end_time if one's been set — defaults to start + DEFAULT_DURATION_MINUTES otherwise, same fallback as the calendar view (src/data/appointments-service.ts addHour). */
  endTime?: string | null;
}

function toHHmmss(time: string): string {
  return time.length >= 8 ? time : `${time}:00`;
}

function addMinutes(hhmmss: string, minutes: number): string {
  const [hours, mins, secs] = hhmmss.split(":").map(Number);
  const totalMinutes = ((hours * 60 + mins + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(secs ?? 0).padStart(2, "0")}`;
}

/** Everything Lucy needs at a glance, without opening the portal. */
function buildDescription(input: AppointmentCalendarEventInput): string {
  const lines = [
    `Name: ${input.customerName}`,
    `Address: ${input.address}${input.postcode ? ` (${input.postcode})` : ""}`,
    `Phone: ${input.phone}`,
    `Email: ${input.email || "—"}`,
    `Product: ${input.product}`,
  ];
  if (input.source || input.medium) {
    lines.push(`Source: ${[input.source, input.medium].filter(Boolean).join(" / ")}`);
  }
  lines.push("", `Notes: ${input.notes || "—"}`);
  return lines.join("\n");
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink: string;
}

/**
 * Creates the calendar event. Returns `null` (after logging) on any failure
 * — including "not configured" — so callers can always fire this and move
 * on; see createAppointmentAction in src/components/appointments/actions.ts.
 */
export async function createAppointmentCalendarEvent(
  input: AppointmentCalendarEventInput,
): Promise<CreatedCalendarEvent | null> {
  if (!isGoogleCalendarConfigured()) return null;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const startTime = toHHmmss(input.startTime);
    const endTime = input.endTime ? toHHmmss(input.endTime) : addMinutes(startTime, DEFAULT_DURATION_MINUTES);
    // Defaults to "primary" — Lucy's own primary calendar, since the access
    // token above was issued directly to her Google account.
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: `${input.product} appointment — ${input.customerName}`,
          location: `${input.address}${input.postcode ? `, ${input.postcode}` : ""}`,
          description: buildDescription(input),
          start: { dateTime: `${input.date}T${startTime}`, timeZone: TIME_ZONE },
          end: { dateTime: `${input.date}T${endTime}`, timeZone: TIME_ZONE },
        }),
      },
    );

    if (!response.ok) {
      console.error("Google Calendar event creation failed", response.status, await response.text());
      return null;
    }

    const event = (await response.json()) as { id: string; htmlLink: string };
    return { id: event.id, htmlLink: event.htmlLink };
  } catch (error) {
    console.error("Google Calendar event creation failed", error);
    return null;
  }
}
