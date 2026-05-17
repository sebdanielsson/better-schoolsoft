const BASE = "/schoolsoft";

const APP_HEADERS = {
  appversion: "2.3.2",
  appos: "android",
} as const;

/* ---------- Legacy app token (used by the older REST endpoints below;
 * issued during OAuth-bootstrapped sessions via fetchToken). ---------- */

export interface TokenResponse {
  token: string;
  expiryDate: string;
}

export type UserType = "0" | "1" | "2";
const USER_LABEL: Record<UserType, string> = {
  "0": "Staff",
  "1": "Student",
  "2": "Guardian",
};

export function userTypeLabel(t: UserType): string {
  return USER_LABEL[t];
}

export async function fetchToken(school: string, appKey: string): Promise<TokenResponse> {
  const res = await fetch(`${BASE}/${school}/rest/app/token`, {
    headers: { ...APP_HEADERS, appkey: appKey, deviceid: "" },
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  return res.json() as Promise<TokenResponse>;
}

export function isTokenExpired(expiryDate: string): boolean {
  const clean = expiryDate.replace(/\.\d+$/, "");
  const expiry = new Date(clean.replace(" ", "T"));
  return Date.now() + 5 * 60 * 1000 > expiry.getTime();
}

function authHeaders(token: string): HeadersInit {
  return { ...APP_HEADERS, token };
}

/* ---------- Data types ---------- */

export interface LunchWeek {
  week: number;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  dates: string[];
}

export interface Lesson {
  id: number;
  subjectId: number;
  subjectName?: string;
  startTime: string;
  endTime?: string;
  teacherName?: string;
  groupName?: string;
  location?: string;
  weeks?: number;
}

export interface CalendarEvent {
  id: number;
  eventStart: number;
  eventEnd?: number;
  title: string;
  description?: string;
  eventTypeInfo?: string;
  noticeType?: string;
}

/** New-style "Eva" types (mirrors the captured iOS API). */
export interface EvaParent {
  guid: string;
  userId: number;
  firstName: string;
  lastName: string;
  children: EvaChild[];
}

export interface EvaChild {
  studentId: number;
  firstName: string;
  lastName: string;
  picture?: string;
  guid?: string;
  schools: Array<{ orgId: number; name: string; className: string }>;
  username?: string;
}

export interface EvaLunchMeal {
  mealType: string;
  description: string;
}

/** A single day from `/eva/api/v1/schools/{orgId}/lunchmenu/{week}`. dayId is Mon=1 … Fri=5. */
export interface EvaLunchDay {
  week: number;
  dayId: number;
  dishes: EvaLunchMeal[];
}

export interface EvaNewsLatest {
  newsId: number;
  title: string;
  description: string;
  fromDate: string;
}

export interface EvaNewsAuthor {
  id: number;
  name: string;
  /** Resource filename like "teacher9840.jpg", or "" if no picture. */
  picture: string;
}

export interface EvaNewsItem {
  id: number;
  title: string;
  description: string;
  creDate: string;
  toDate?: string;
  category?: string;
  author?: EvaNewsAuthor;
  read?: boolean;
  response?: boolean;
  hasAttachment?: boolean;
  newsConfirm?: unknown;
}

/** A message sender. id = -1 indicates a system message from SchoolSoft itself. */
export interface EvaMessageSender {
  id: number;
  firstName: string;
  lastName: string;
  /** Resource filename like "teacher9840.jpg", or "" for system messages. */
  picture: string;
}

/** Inbox-list summary of a message. */
export interface EvaMessageInbox {
  id: number;
  subject: string;
  /** Short preview/first line of the message body. */
  message: string;
  isRead: boolean;
  sender: EvaMessageSender;
  /** ISO datetime. */
  date: string;
  hasFiles: boolean;
}

/** Full message detail. */
export interface EvaMessageDetail {
  id: number;
  subject: string;
  message: string;
  sender: EvaMessageSender;
  replyTo: boolean;
  isRead: boolean;
  date: string;
  recipients: Array<{ id: number; firstName: string; lastName: string; picture?: string }>;
  attachments: Array<{ id?: number; name?: string; size?: number }>;
  sentByUser: boolean;
}

/** OAuth-style token response from `/{school}/rest-api/login/token`. */
export interface EvaTokenResponse {
  access_token: string;
  refresh_token: string;
  type: "Bearer";
  expires: number;
}

/* ---------- Data fetchers (legacy app API — works with appKey/token auth) ---------- */

async function getJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Request failed (${res.status}) ${url}`);
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export function fetchLunch(school: string, token: string, orgId: number): Promise<LunchWeek[]> {
  return getJson(`${BASE}/${school}/api/lunchmenus/student/${orgId}`, token);
}

export function fetchLessons(school: string, token: string, orgId: number): Promise<Lesson[]> {
  return getJson(`${BASE}/${school}/api/lessons/student/${orgId}`, token);
}

const NOTICE_TYPES = "calendar,schoolcalendar,privatecalendar";

export function fetchCalendar(
  school: string,
  token: string,
  orgId: number,
  days = 30,
): Promise<CalendarEvent[]> {
  const now = Date.now();
  const end = now + days * 24 * 60 * 60 * 1000;
  const url = `${BASE}/${school}/api/notices/student/${orgId}/${now}/${end}/${NOTICE_TYPES}`;
  return getJson(url, token);
}

/** Fetch all kinds of notices over a window — useful for "news" feed.
 *  Mirrors the iOS app's news/latest endpoint by accepting flexible types.
 */
export function fetchNotices(
  school: string,
  token: string,
  orgId: number,
  types: string,
  daysBack = 14,
  daysAhead = 30,
): Promise<CalendarEvent[]> {
  const now = Date.now();
  const start = now - daysBack * 24 * 60 * 60 * 1000;
  const end = now + daysAhead * 24 * 60 * 60 * 1000;
  const url = `${BASE}/${school}/api/notices/student/${orgId}/${start}/${end}/${types}`;
  return getJson(url, token);
}

/* ---------- Eva (modern OAuth) API ---------- */

/** Refresh an Eva access token using a refresh token. */
export async function refreshEvaToken(
  school: string,
  refreshToken: string,
): Promise<EvaTokenResponse> {
  const url =
    `${BASE}/${school}/rest-api/login/token` +
    `?clientId=vApp&grantType=refresh_token&refreshToken=${encodeURIComponent(refreshToken)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Eva token refresh failed (${res.status})`);
  return res.json() as Promise<EvaTokenResponse>;
}

/** Exchange an OAuth code (from the authorize redirect) for an Eva token pair. */
export async function exchangeEvaCode(
  school: string,
  code: string,
  codeVerifier: string,
): Promise<EvaTokenResponse> {
  const url =
    `${BASE}/${school}/rest-api/login/token` +
    `?clientId=vApp&grantType=code&code=${encodeURIComponent(code)}` +
    `&codeVerifier=${encodeURIComponent(codeVerifier)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Eva code exchange failed (${res.status})`);
  return res.json() as Promise<EvaTokenResponse>;
}

async function evaGet<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Eva request failed (${res.status}) ${url}`);
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

/** Fetch a week's lunch menu from the modern Eva endpoint. */
export function fetchEvaLunchWeek(
  school: string,
  accessToken: string,
  orgId: number,
  week: number,
): Promise<EvaLunchDay[]> {
  return evaGet(`${BASE}/${school}/eva/api/v1/schools/${orgId}/lunchmenu/${week}`, accessToken);
}

/** Convert Eva lunch days (Mon=1…Fri=5) into the legacy LunchWeek shape so existing UI works. */
export function evaLunchToWeek(days: EvaLunchDay[]): LunchWeek | null {
  if (!days.length) return null;
  const week = days[0]?.week ?? 0;
  const byDay: Record<number, string> = {};
  for (const d of days) {
    const text = d.dishes
      .filter((dish) => dish.description.trim())
      .map((dish) => `${dish.mealType} · ${dish.description.trim()}`)
      .join("\n");
    byDay[d.dayId] = text;
  }
  return {
    week,
    monday: byDay[1] ?? "",
    tuesday: byDay[2] ?? "",
    wednesday: byDay[3] ?? "",
    thursday: byDay[4] ?? "",
    friday: byDay[5] ?? "",
    saturday: "",
    sunday: "",
    dates: [],
  };
}

/* ---------- Eva data fetchers (mirroring the iOS app's calls) ---------- */

export interface EvaParentProfile {
  fName: string;
  lName: string;
  email?: string;
  socialNumber?: string;
  mobile?: string;
  homePhone?: string;
  workPhone?: string;
  address1?: string;
  address2?: string;
  poCode?: string;
  city?: string;
  contactInfo?: string;
  notPublish?: boolean;
}

export interface EvaProfilePermissions {
  allowNameChange: boolean;
  allowAddressChange: boolean;
}

export function fetchEvaParent(school: string, accessToken: string): Promise<EvaParent> {
  return evaGet(`${BASE}/${school}/eva/api/v1/parent`, accessToken);
}

export function fetchEvaParentProfile(
  school: string,
  accessToken: string,
  userId: number,
): Promise<EvaParentProfile> {
  return evaGet(`${BASE}/${school}/eva/api/v1/parent/${userId}/profile`, accessToken);
}

export function fetchEvaChildren(
  school: string,
  accessToken: string,
  userId: number,
): Promise<EvaChild[]> {
  return evaGet(`${BASE}/${school}/eva/api/v1/parent/${userId}/children`, accessToken);
}

/** Single-day lunch (per-meal-type). Matches `/lunchmenu/week/{week}/day/{day}` in the iOS app. */
export function fetchEvaLunchDay(
  school: string,
  accessToken: string,
  orgId: number,
  week: number,
  day: number,
): Promise<EvaLunchMeal[]> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/schools/${orgId}/lunchmenu/week/${week}/day/${day}`,
    accessToken,
  );
}

/** Latest news headline for the student. Returns null body (204) when none. */
export function fetchEvaLatestNews(
  school: string,
  accessToken: string,
  userId: number,
  orgId: number,
  studentId: number,
): Promise<EvaNewsLatest | null> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/parent/${userId}/schools/${orgId}/news/latest?studentId=${studentId}`,
    accessToken,
  );
}

/** Full news list (the iOS app's News page uses this). */
export function fetchEvaNews(
  school: string,
  accessToken: string,
  userId: number,
  orgId: number,
  studentId: number,
  langId = 1,
): Promise<EvaNewsItem[]> {
  return evaGet(
    `${BASE}/${school}/eva/api/v2/parent/${userId}/schools/${orgId}/news?studentId=${studentId}&langId=${langId}`,
    accessToken,
  );
}

/** Fetch a binary image resource as a Blob using the Bearer JWT.
 *  `<img>` tags can't carry custom headers, so this is required for the avatars. */
export async function fetchEvaResource(
  school: string,
  accessToken: string,
  filename: string,
): Promise<Blob> {
  const res = await fetch(`${BASE}/${school}/eva/api/v1/resource/${encodeURIComponent(filename)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Resource fetch failed (${res.status}) ${filename}`);
  return res.blob();
}

export interface EvaCalendarEvent {
  newsId?: number;
  title: string;
  description?: string;
  fromDate: string;
  toDate?: string;
  eventTypeInfo?: string;
}

/** "Next calendar event" tile data. Returns null body when none scheduled. */
export function fetchEvaNextCalendarEvent(
  school: string,
  accessToken: string,
  userId: number,
  orgId: number,
  studentId: number,
): Promise<EvaCalendarEvent | null> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/parent/${userId}/schools/${orgId}/news/calendarevent/next?studentId=${studentId}`,
    accessToken,
  );
}

export interface EvaLessonTile {
  lessonId?: number;
  subjectName?: string;
  groupName?: string;
  teacherName?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
}

/** Current lesson tile (returns null body when no lesson is in progress). */
export function fetchEvaCurrentLesson(
  school: string,
  accessToken: string,
  orgId: number,
  studentId: number,
  week: number,
  day: number,
): Promise<EvaLessonTile | null> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/schools/${orgId}/student/${studentId}/lessons/week/${week}/day/${day}/current?langId=1`,
    accessToken,
  );
}

/** Next upcoming lesson tile (returns null body when none today). */
export function fetchEvaNextLesson(
  school: string,
  accessToken: string,
  orgId: number,
  studentId: number,
  week: number,
  day: number,
): Promise<EvaLessonTile | null> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/schools/${orgId}/student/${studentId}/lessons/week/${week}/day/${day}/next?langId=1`,
    accessToken,
  );
}

/** All lessons for one day. The iOS app only fetches "current"/"next" tiles — the full schedule
 *  view is delegated to a webview — but this endpoint shape mirrors the lunch pattern and
 *  appears to return all dishes^Wlessons for the day. We fall back gracefully if it 404s. */
export function fetchEvaLessonsDay(
  school: string,
  accessToken: string,
  orgId: number,
  studentId: number,
  week: number,
  day: number,
): Promise<EvaLessonTile[]> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/schools/${orgId}/student/${studentId}/lessons/week/${week}/day/${day}?langId=1`,
    accessToken,
  );
}

/** Probe a few endpoint shapes that might return the full week of lessons. The iOS app
 *  itself uses a webview here, so we don't have a confirmed URL — try the most plausible
 *  variants in order and return the first one with data. */
export async function fetchEvaLessonsWeek(
  school: string,
  accessToken: string,
  orgId: number,
  studentId: number,
  week: number,
): Promise<EvaLessonTile[]> {
  const base = `${BASE}/${school}/eva/api/v1/schools/${orgId}/student/${studentId}/lessons`;
  const candidates = [
    `${base}/week/${week}?langId=1`,
    `${base}/week/${week}/all?langId=1`,
    `${base}?week=${week}&langId=1`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text) continue;
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length) return data as EvaLessonTile[];
    } catch {
      /* try next */
    }
  }
  /* Fall back to fetching each weekday tile-by-tile via the day endpoint. */
  const days = [1, 2, 3, 4, 5];
  const settled = await Promise.allSettled(
    days.map((d) => fetchEvaLessonsDay(school, accessToken, orgId, studentId, week, d)),
  );
  const all: EvaLessonTile[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) all.push(...r.value);
  }
  return all;
}

/** Unread message count. */
export function fetchEvaUnreadMessages(
  school: string,
  accessToken: string,
  userId: number,
  orgId: number,
): Promise<number> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/parent/${userId}/schools/${orgId}/messages/unread`,
    accessToken,
  );
}

/** Inbox listing — newest first. */
export function fetchEvaInbox(
  school: string,
  accessToken: string,
  userId: number,
  orgId: number,
): Promise<EvaMessageInbox[]> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/parent/${userId}/schools/${orgId}/messages/inbox`,
    accessToken,
  );
}

/** Full message detail by id. */
export function fetchEvaMessage(
  school: string,
  accessToken: string,
  userId: number,
  orgId: number,
  messageId: number,
): Promise<EvaMessageDetail> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/parent/${userId}/schools/${orgId}/messages/${messageId}`,
    accessToken,
  );
}

export interface EvaBadgeCounts {
  news?: number;
  bookings?: number;
  subjectrooms?: number;
  holisticassessments?: number;
}

/** Fetch the four badge counts shown beside the iOS app's menu items. */
export async function fetchEvaBadgeCounts(
  school: string,
  accessToken: string,
  userId: number,
  orgId: number,
  studentId: number,
): Promise<EvaBadgeCounts> {
  const base = `${BASE}/${school}/eva/api/v1/schools/${orgId}/parents/${userId}/badge`;
  const qs = `?studentId=${studentId}`;
  const kinds = ["news", "bookings", "subjectrooms", "holisticassessments"] as const;
  const results = await Promise.allSettled(
    kinds.map((k) => evaGet<number>(`${base}/${k}${qs}`, accessToken)),
  );
  const out: EvaBadgeCounts = {};
  kinds.forEach((k, i) => {
    const r = results[i];
    if (r && r.status === "fulfilled") out[k] = r.value ?? 0;
  });
  return out;
}

/** Resolve a student picture URL via the Eva resource endpoint. */
export function evaResourceUrl(school: string, filename: string): string {
  return `${BASE}/${school}/eva/api/v1/resource/${encodeURIComponent(filename)}`;
}

/** Fetch which profile fields the school lets the parent edit. */
export async function fetchEvaProfilePermissions(
  school: string,
  accessToken: string,
  orgId: number,
): Promise<EvaProfilePermissions> {
  const base = `${BASE}/${school}/eva/api/v1/schools/${orgId}/parameters/parent/profile`;
  const [name, address] = await Promise.all([
    evaGet<boolean>(`${base}/allow-name-change`, accessToken).catch(() => false),
    evaGet<boolean>(`${base}/allow-address-and-po-code-change`, accessToken).catch(() => false),
  ]);
  return { allowNameChange: !!name, allowAddressChange: !!address };
}

async function evaPut(url: string, accessToken: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${url} failed (${res.status})`);
}

export function updateEvaProfileAddress(
  school: string,
  accessToken: string,
  userId: number,
  body: { address1: string; address2: string; poCode: string; city: string },
): Promise<void> {
  return evaPut(`${BASE}/${school}/eva/api/v1/parent/${userId}/profile/address`, accessToken, body);
}

export function updateEvaProfileName(
  school: string,
  accessToken: string,
  userId: number,
  body: { fName: string; lName: string },
): Promise<void> {
  return evaPut(`${BASE}/${school}/eva/api/v1/parent/${userId}/profile/name`, accessToken, body);
}

export function updateEvaProfileContact(
  school: string,
  accessToken: string,
  userId: number,
  body: {
    email: string;
    mobile: string;
    homePhone: string;
    workPhone: string;
    contactInfo: string;
    orgId: number;
  },
): Promise<void> {
  return evaPut(`${BASE}/${school}/eva/api/v1/parent/${userId}/profile/contact`, accessToken, body);
}

/** Toggle "hide my profile". The captured request body sends the desired new value as `active`:
 *  pass `true` to hide the profile, `false` to make it visible. */
export function updateEvaProfileNotPublish(
  school: string,
  accessToken: string,
  userId: number,
  hide: boolean,
): Promise<void> {
  return evaPut(`${BASE}/${school}/eva/api/v1/parent/${userId}/profile/notPublish`, accessToken, {
    active: hide,
  });
}

/* ---------- Staff (Eva) ---------- */

export interface EvaStaffMember {
  teacherId: number;
  firstName: string;
  lastName: string;
  /** Resource filename like "teacher10689.jpg", or empty string when no picture. */
  picture: string;
}

export interface EvaStaffGroup {
  /** Localised group label from the API: "Lärare", "Skolledare", "Övrig personal", "Elevvårdare", … */
  type: string;
  data: EvaStaffMember[];
}

export interface EvaStaffDetail {
  firstName: string;
  lastName: string;
  email?: string;
  mobile?: string;
  picture?: string;
  contactInfo?: string;
  type?: string;
  roles?: string[];
}

/** Full staff directory grouped by role (Lärare, Skolledare, …). */
export function fetchEvaStaff(
  school: string,
  accessToken: string,
  orgId: number,
  langId = 1,
): Promise<EvaStaffGroup[]> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/schools/${orgId}/staff?langId=${langId}`,
    accessToken,
  );
}

/** Detail view for a single staff member (contact info + roles). */
export function fetchEvaStaffDetail(
  school: string,
  accessToken: string,
  orgId: number,
  teacherId: number,
  langId = 1,
): Promise<EvaStaffDetail> {
  return evaGet(
    `${BASE}/${school}/eva/api/v1/schools/${orgId}/staff/${teacherId}?langId=${langId}`,
    accessToken,
  );
}

/* ---------- Holistic assessment (uses session cookies, not Bearer auth) ----------
 *
 * The /rest-api/parent/holistic_assessment/rows endpoint is served from the
 * SchoolSoft React webview rather than Eva, so it authenticates via JSESSIONID +
 * hash cookies. Those cookies are set by hitting /eva-apps/auth/login/parent
 * with the Eva JWT in a `token:` header — that endpoint 303s with a Set-Cookie
 * payload. Our proxy rewrites Path attributes so the browser sends the cookies
 * back on subsequent /schoolsoft/... requests.
 */

export interface HolisticAssessmentRow {
  title: string;
  subTitle: string;
  color: string;
  subjectWarning: boolean;
  updatedAt: string;
  friendlyUpdatedAt: string;
  holisticAssessmentId: number;
  published: boolean;
  read: boolean;
}

/** Cache of schools we've already exchanged an Eva JWT for cookies on. The
 *  cookies live on the browser; this just avoids re-running the bootstrap. */
const bootstrappedSchools = new Set<string>();

/** Trade the Eva JWT for JSESSIONID + hash cookies on the SchoolSoft React
 *  webview's session. Cheap, idempotent on the client (we deduplicate per
 *  school), and required before any /rest-api/* call. */
export async function bootstrapSchoolsoftSession(
  school: string,
  evaToken: string,
  userId: number,
  orgId: number,
  studentId: number,
): Promise<void> {
  if (bootstrappedSchools.has(school)) return;
  const res = await fetch(`${BASE}/${school}/eva-apps/auth/login/parent`, {
    method: "GET",
    credentials: "include",
    redirect: "manual",
    headers: {
      token: evaToken,
      userId: String(userId),
      orgId: String(orgId),
      childInFocus: String(studentId),
      userOS: "android",
      language: "sw",
    },
  });
  /* manual redirect → opaqueredirect response (status 0, type 'opaqueredirect').
   * Cookies are applied regardless. Any non-redirect status that isn't 2xx
   * means the bootstrap failed and we shouldn't mark the school as ready. */
  if (res.type !== "opaqueredirect" && !res.ok) {
    throw new Error(`SchoolSoft session bootstrap failed (${res.status})`);
  }
  bootstrappedSchools.add(school);
}

export async function fetchHolisticAssessments(
  school: string,
): Promise<HolisticAssessmentRow[]> {
  return cookieGet<HolisticAssessmentRow[]>(
    `${BASE}/${school}/rest-api/parent/holistic_assessment/rows`,
  );
}

export interface HolisticAssessmentDetail {
  id: number;
  activityName: string;
  groupName: string;
  studentName: string;
  studentId: number;
  publishDate: string;
  publishStatus: string;
}

export interface HolisticAssessmentSubjectWarning {
  active: boolean;
  comment: string;
  createdAt: string;
  holisticAssessmentId: number;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  published: boolean;
  publishedAt: string;
}

/** Guardian acknowledgement state for a subject warning. `hasConfirmed` is the
 *  source of truth for whether to show the "I confirm" button — the warning's
 *  own `active` field tracks whether the warning itself is published, not the
 *  guardian's read-receipt. */
export interface HolisticAssessmentConfirmStatus {
  hasConfirmed: boolean;
  confirmedAt: string;
  name: string;
}

export interface HolisticAssessmentKnowledgeDevelopment {
  value: string;
  supportMeasures: string;
  updatedByInfo: string;
}

/** Section enums the /sections/published endpoint can return. The list drives
 *  which panels the detail UI tries to render. */
export type HolisticAssessmentSection =
  | "ATTENDANCE"
  | "FORMATIVE_COMMENT"
  | "KNOWLEDGE_DEVELOPMENT"
  | "SUBJECT_WARNING";

export function fetchHolisticAssessmentDetail(
  school: string,
  id: number,
): Promise<HolisticAssessmentDetail> {
  return cookieGet(`${BASE}/${school}/rest-api/parent/holistic_assessment/${id}`);
}

export function fetchHolisticAssessmentSubjectWarning(
  school: string,
  id: number,
): Promise<HolisticAssessmentSubjectWarning | null> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/holistic_assessment/${id}/subject_warning`,
  );
}

export function fetchHolisticAssessmentConfirmStatus(
  school: string,
  id: number,
): Promise<HolisticAssessmentConfirmStatus | null> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/holistic_assessment/${id}/subject_warning/confirm`,
  );
}

export function fetchHolisticAssessmentKnowledgeDevelopment(
  school: string,
  id: number,
): Promise<HolisticAssessmentKnowledgeDevelopment | null> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/holistic_assessment/${id}/knowledge_development/view`,
  );
}

export function fetchHolisticAssessmentSections(
  school: string,
  id: number,
): Promise<HolisticAssessmentSection[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/holistic_assessment/${id}/sections/published`,
  );
}

/** Mark a subject warning as acknowledged by the guardian. GET on the same URL
 *  reads the current confirmation state; POST flips it to confirmed. */
export async function confirmHolisticAssessmentSubjectWarning(
  school: string,
  id: number,
): Promise<void> {
  const res = await fetch(
    `${BASE}/${school}/rest-api/parent/holistic_assessment/${id}/subject_warning/confirm`,
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) throw new Error(`Subject warning confirm failed (${res.status})`);
}

/* ---------- Subject-room assignments (Planning/Schedule "PS" module) ----------
 *
 * Same cookie-auth flow as the holistic assessment endpoints — call
 * `bootstrapSchoolsoftSession` first, then GET with credentials.
 */

export type AssignmentSubmissionStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "EXPIRED_NOT_SUBMITTED"
  | "EXPIRED_SUBMITTED";

export type AssignmentResultStatus = "NOT_REPORTED" | "REPORTED";

export interface AssignmentRow {
  activityId: number;
  id: number;
  read: boolean;
  resultReportStatus: AssignmentResultStatus | string;
  sortDate: string;
  subTitle: string;
  submissionStatus: AssignmentSubmissionStatus | string;
  title: string;
}

export function fetchAssignmentsThisWeek(
  school: string,
  week: number,
  year: number,
): Promise<AssignmentRow[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/assignments/start-page?week=${week}&year=${year}`,
  );
}

export interface AssignmentView {
  id: number;
  title: string;
  type: string;
  subTitle: string;
  subjectNames: string;
  description: string;
  publishDate: string;
  integrationType: string | null;
  contents: unknown[];
}

export type AssignmentSectionType =
  | "SUBMISSION"
  | "RESULTREPORT"
  | "MATERIAL"
  | string;

export interface AssignmentSection {
  id: number;
  type: AssignmentSectionType;
}

export interface AssignmentSubmission {
  allowLateHandIn: boolean;
  closeDate: string;
  description: string | null;
  expireDate: string;
  groupHandIn: boolean;
  handInType: "PHYSICAL" | "DIGITAL" | string;
  plagiarismCheck: boolean;
  submissionStatus: {
    groupSubmissionId: number;
    studentSubmissionId: number;
    submitted: boolean;
  };
}

export interface AssignmentAssessment {
  review: string;
  studentComment: string;
  teacherComment: string;
  assessedCriteriaTabs: unknown[];
  assessmentPartialMoments: unknown[];
}

export interface ConnectedPlanning {
  id: number;
  title: string;
  subTitle: string;
  planningId: number | null;
  read: boolean;
  sortDate: string | null;
}

export function fetchAssignmentView(school: string, id: number): Promise<AssignmentView> {
  return cookieGet(`${BASE}/${school}/rest-api/parent/ps/assignments/${id}/view`);
}

export function fetchAssignmentSections(
  school: string,
  id: number,
): Promise<AssignmentSection[]> {
  return cookieGet(`${BASE}/${school}/rest-api/parent/ps/assignments/${id}/sections`);
}

export function fetchAssignmentConnectedPlannings(
  school: string,
  id: number,
): Promise<ConnectedPlanning[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/assignments/${id}/connected_plannings`,
  );
}

export function fetchAssignmentSubmission(
  school: string,
  submissionSectionId: number,
): Promise<AssignmentSubmission> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/submission/${submissionSectionId}?groupwork_id=0`,
  );
}

export function fetchAssignmentAssessment(
  school: string,
  assignmentId: number,
): Promise<AssignmentAssessment> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/assignment/${assignmentId}/assessment`,
  );
}

/* ---------- Plannings ---------- */

export interface PlanningRow {
  activityId: number;
  id: number;
  planningId: number;
  read: boolean;
  subTitle: string;
  title: string;
}

export interface PlanningView {
  title: string;
  subjectNames: string;
  contents: unknown[];
}

export interface PlanningPartTab {
  id: number;
  order: number;
  title: string;
}

export interface PlanningPartView {
  title: string;
  subtitle: string;
  description: string;
  publishDate: string;
}

export interface ConnectedAssignment {
  id: number;
  title: string;
  subTitle: string;
  planningId: number | null;
  read: boolean;
  sortDate: string | null;
}

export function fetchPlanningsThisWeek(
  school: string,
  week: number,
  year: number,
): Promise<PlanningRow[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/planning_parts/start-page?week=${week}&year=${year}`,
  );
}

export function fetchPlanningView(
  school: string,
  planningId: number,
): Promise<PlanningView> {
  return cookieGet(`${BASE}/${school}/rest-api/parent/ps/plannings/${planningId}/view`);
}

export function fetchPlanningTabs(
  school: string,
  planningId: number,
): Promise<PlanningPartTab[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/plannings/${planningId}/planning_parts/tabs`,
  );
}

export function fetchPlanningPartView(
  school: string,
  partId: number,
): Promise<PlanningPartView> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/planning_parts/${partId}/view`,
  );
}

export function fetchPlanningConnectedAssignments(
  school: string,
  partId: number,
): Promise<ConnectedAssignment[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/planning_parts/${partId}/connected_assignments`,
  );
}

/* ---------- Schedule (lessons + events) — cookie-auth ---------- */

export interface StudentLessonStatus {
  absence: number;
  comment: string;
  lessonId: number;
  name: string;
  reason: string;
  status: number;
  statusType: number;
  week: number;
}

export interface ScheduleLesson {
  allDay: boolean;
  category: "lesson" | string;
  dayId: number;
  description: string;
  editable: boolean;
  endDate: string;
  eventColor: string;
  eventId: number;
  name: string;
  room: string;
  roomBooking: boolean;
  startDate: string;
  status: number;
  studentLessonStatus: StudentLessonStatus | null;
  teacher: string;
  teachingGroup: string;
}

export function fetchScheduleLessons(
  school: string,
  week: number,
): Promise<ScheduleLesson[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/calendar/lessons/week/${week}`,
  );
}

/* ---------- Material file metadata (used by assignment detail) ---------- */

export interface MaterialFile {
  fileId: number;
  fileName: string;
}

/** Despite the `/file` suffix, this endpoint returns JSON metadata about the
 *  file(s) attached to a material (name + id), not the binary itself. */
export function fetchMaterialFiles(
  school: string,
  materialId: number,
): Promise<MaterialFile[]> {
  return cookieGet(
    `${BASE}/${school}/rest-api/parent/ps/material/${materialId}/file`,
  );
}

/* ---------- Feature parameters (gates PS-module features) ---------- */

export interface SchoolsoftParameters {
  useFunctionPS: boolean;
  /* Other fields exist (scheduleStart, scheduleEnd, useGuardian, …); only the
   * gates we currently consume are typed. The endpoint returns more. */
}

const parametersCache = new Map<string, SchoolsoftParameters>();

/** Fetch /rest-api/parameters once per school + per session-load and cache the
 *  result. Bootstraps the cookie session if needed so callers don't have to
 *  thread it through. */
export async function getSchoolsoftParameters(
  school: string,
  evaToken: string,
  userId: number,
  orgId: number,
  studentId: number,
): Promise<SchoolsoftParameters> {
  const cached = parametersCache.get(school);
  if (cached) return cached;
  await bootstrapSchoolsoftSession(school, evaToken, userId, orgId, studentId);
  const params = await cookieGet<SchoolsoftParameters>(
    `${BASE}/${school}/rest-api/parameters`,
  );
  parametersCache.set(school, params);
  return params;
}

async function cookieGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Schoolsoft request failed (${res.status}) ${url}`);
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

/* ---------- School list ---------- */

export interface SchoolListEntry {
  name: string;
  orgId: number;
  evaUrl?: string;
  discoveryUrl?: string;
}

export async function fetchSchoolList(): Promise<SchoolListEntry[]> {
  /* Internal endpoint used by the modern iOS app — richer data than /rest/app/schoollist/prod. */
  const res = await fetch(`${BASE}/internal/rest-api/login/schoollist`);
  if (!res.ok) throw new Error(`School list fetch failed (${res.status})`);
  return res.json() as Promise<SchoolListEntry[]>;
}

/** A school grouped for display: many `SchoolListEntry` rows share a tenant slug
 *  (one row per sub-school / orgId) but the login flow only needs the slug. */
export interface SchoolOption {
  slug: string;
  primaryName: string;
  subNames: string[];
}

/** Extract the tenant slug ("myschool") from an evaUrl like
 *  `https://sms.schoolsoft.se/myschool/eva`. Returns null if the URL is missing
 *  or doesn't match the expected shape. */
export function slugFromEvaUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = /\/([^/]+)\/eva(?:\/|$)/.exec(url);
  return match ? (match[1] ?? null) : null;
}

/** Group raw school-list entries by slug. Names of sub-schools that share a common
 *  prefix ending in " - " are collapsed: the prefix becomes `primaryName` and the
 *  suffixes go into `subNames`. */
export function groupSchoolsBySlug(entries: SchoolListEntry[]): SchoolOption[] {
  const bySlug = new Map<string, string[]>();
  for (const entry of entries) {
    const slug = slugFromEvaUrl(entry.evaUrl);
    if (!slug) continue;
    const names = bySlug.get(slug) ?? [];
    if (!names.includes(entry.name)) names.push(entry.name);
    bySlug.set(slug, names);
  }

  const options: SchoolOption[] = [];
  for (const [slug, names] of bySlug) {
    const firstName = names[0] ?? slug;
    let primaryName = firstName;
    let subNames: string[] = [];

    const dashIdx = firstName.indexOf(" - ");
    if (dashIdx > 0) {
      const prefix = firstName.slice(0, dashIdx);
      if (names.every((n) => n === prefix || n.startsWith(`${prefix} - `))) {
        primaryName = prefix;
        subNames = names
          .map((n) => (n === prefix ? "" : n.slice(prefix.length + 3)))
          .filter((s) => s.length > 0);
      } else {
        subNames = names.slice(1);
      }
    } else if (names.length > 1) {
      subNames = names.slice(1);
    }

    options.push({ slug, primaryName, subNames });
  }

  options.sort((a, b) => a.primaryName.localeCompare(b.primaryName, "sv"));
  return options;
}

/* ---------- Helpers shared by pages ---------- */

/** ISO week number for a Date (1–53). */
export function isoWeek(d: Date = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** ISO week-numbering year for a Date — usually equal to the calendar year,
 *  but differs in early Jan / late Dec when an ISO week straddles years. */
export function isoWeekYear(d: Date = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  return date.getUTCFullYear();
}

/** ISO day-of-week (Mon=1 … Sun=7). */
export function isoDay(d: Date = new Date()): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Convert SchoolSoft lessons' bitmask of week numbers to an array. */
export function bitmaskToWeeks(bitmask: number): number[] {
  const weeks: number[] = [];
  for (let i = 0; i < 53; i++) {
    if (bitmask & (1 << i)) weeks.push(i + 1);
  }
  return weeks;
}

/** Format a SchoolSoft start/end time string ("1970-01-01 08:20:00.0") → "08:20". */
export function formatLessonTime(s: string): string {
  return s.slice(11, 16);
}

/** Day name from SchoolSoft lesson startTime — the date portion encodes the weekday. */
export function lessonDayIndex(startTime: string): number {
  /* SchoolSoft stores startTime as "1970-01-01 HH:MM:SS.0" where the date encodes the weekday. */
  const epochDay = new Date(startTime.replace(" ", "T").replace(".0", "")).getDay();
  return epochDay === 0 ? 7 : epochDay;
}

export const DAY_NAMES_FULL = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export const DAY_NAMES_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
