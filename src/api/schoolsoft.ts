const BASE = '/schoolsoft';

export interface AppKeyResponse {
  appKey: string;
  orgs: Array<{ orgId: number; orgName: string }>;
  name: string;
  pictureUrl?: string;
}

export interface TokenResponse {
  token: string;
  expiryDate: string;
}

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
  eventTypeInfo?: string;
}

/** Step 1 of auth: exchange credentials for an app key (logintype=4). */
export async function fetchAppKey(
  school: string,
  username: string,
  password: string,
): Promise<AppKeyResponse> {
  const body = new URLSearchParams({
    identification: username,
    verification: password,
    logintype: '4',
    usertype: '1',
  });
  const res = await fetch(`${BASE}/${school}/rest/app/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status})`);
  }
  return res.json() as Promise<AppKeyResponse>;
}

/** Step 2 of auth: exchange app key for a session token. */
export async function fetchToken(
  school: string,
  appKey: string,
): Promise<TokenResponse> {
  const res = await fetch(`${BASE}/${school}/rest/app/token`, {
    headers: {
      appversion: '2.3.2',
      appos: 'android',
      appkey: appKey,
      deviceid: '',
    },
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status})`);
  }
  return res.json() as Promise<TokenResponse>;
}

function authHeaders(token: string) {
  return {
    appversion: '2.3.2',
    appos: 'android',
    token,
  };
}

/** Check if a token is still valid (with a 5-min buffer). */
export function isTokenExpired(expiryDate: string): boolean {
  // expiryDate format: "2020-08-12 17:48:22.0" — strip milliseconds part
  const clean = expiryDate.replace(/\.\d+$/, '');
  const expiry = new Date(clean.replace(' ', 'T'));
  return Date.now() + 5 * 60 * 1000 > expiry.getTime();
}

export async function fetchLunch(
  school: string,
  token: string,
  orgId: number,
): Promise<LunchWeek[]> {
  const res = await fetch(`${BASE}/${school}/api/lunchmenus/student/${orgId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Lunch fetch failed (${res.status})`);
  return res.json() as Promise<LunchWeek[]>;
}

export async function fetchLessons(
  school: string,
  token: string,
  orgId: number,
): Promise<Lesson[]> {
  const res = await fetch(`${BASE}/${school}/api/lessons/student/${orgId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Lessons fetch failed (${res.status})`);
  return res.json() as Promise<Lesson[]>;
}

export async function fetchCalendar(
  school: string,
  token: string,
  orgId: number,
): Promise<CalendarEvent[]> {
  const now = Date.now();
  const monthLater = now + 30 * 24 * 60 * 60 * 1000;
  const url = `${BASE}/${school}/api/notices/student/${orgId}/${now}/${monthLater}/calendar,schoolcalendar,privatecalendar`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Calendar fetch failed (${res.status})`);
  return res.json() as Promise<CalendarEvent[]>;
}

export async function fetchSchoolList(): Promise<Array<{ unitId: number; unitName: string; url: string }>> {
  const res = await fetch(`${BASE}/rest/app/schoollist/prod`);
  if (!res.ok) throw new Error(`School list fetch failed (${res.status})`);
  return res.json() as Promise<Array<{ unitId: number; unitName: string; url: string }>>;
}
