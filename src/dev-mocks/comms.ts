/** News, messages, bookings, lunch, school events and the server-rendered
 *  school pages for mock mode. Invented content only; see `people.ts`. */

import type {
  CalendarItem,
  EvaCalendarEvent,
  EvaLunchDay,
  EvaMessageDetail,
  EvaMessageInbox,
  EvaNewsDetail,
  EvaNewsItem,
  TimebookingDate,
  TimebookingDetail,
  TimebookingStartpageItem,
  TimebookingSummary,
} from "../api/schoolsoft.ts";
import { fullName, SCHOOL_NAME, T } from "./people.ts";
import { at, iso, localT, weekday, ymd } from "./time.ts";

const author = (id: number) => ({ id, name: fullName(id), picture: "" });
const sender = (id: number) => {
  const [firstName = "", ...rest] = fullName(id).split(" ");
  return { id, firstName, lastName: rest.join(" "), picture: "" };
};

/* ---------- News ---------- */

export interface News {
  item: EvaNewsItem;
  body: string;
  /** Question shown to guardians, when the item asks one. */
  question?: string;
  attachments: { fileId: number; name: string }[];
  archived: boolean;
}

export function createNews(): News[] {
  const n = (
    id: number,
    title: string,
    body: string,
    created: Date,
    toDate: Date | null,
    category: string,
    by: number,
    read: boolean,
    extra: Partial<News> = {},
  ): News => ({
    item: {
      id,
      title,
      description: body,
      creDate: iso(created),
      ...(toDate ? { toDate: iso(toDate) } : {}),
      category,
      author: author(by),
      read,
      response: !!extra.question,
      hasAttachment: (extra.attachments?.length ?? 0) > 0,
      newsConfirm: null,
    },
    body,
    attachments: [],
    archived: false,
    ...extra,
  });
  return [
    n(
      900101,
      "Autumn break and after-school opening hours",
      "The school is closed during the autumn break. After-school care is open 07:30–17:00 for children who are signed up.\n\nSign-up closes on Friday.",
      at(-1, 9, 30),
      at(20),
      "Administration",
      T.holm,
      false,
    ),
    n(
      900102,
      "Outdoor day on Friday",
      "On Friday we spend the whole day in the forest. Dress for the weather and bring a packed lunch, a water bottle and something to sit on.",
      at(-3, 15, 10),
      at(5),
      "Class 4B",
      T.lind,
      true,
    ),
    n(
      900103,
      "Music evening: will you come?",
      "Year 4 performs songs from this term in the hall. Coffee and cake are sold by the parents' association.",
      at(-4, 11, 0),
      at(12),
      "Events",
      T.haddad,
      true,
      { question: "Will you attend? Tell us how many guests you're bringing." },
    ),
    n(
      900104,
      "New lunch routines",
      "From next week, classes 4A and 4B eat at 11:15. The new menu is attached.",
      at(-8, 13, 45),
      at(25),
      "Administration",
      T.dahl,
      true,
      { attachments: [{ fileId: 900151, name: "Lunch routines.pdf" }] },
    ),
    n(
      900105,
      "Swimming lessons start",
      "Swimming lessons for year 4 start this month. Remember swimwear and a towel.",
      at(-40, 8, 0),
      at(-10),
      "Class 4B",
      T.novak,
      true,
    ),
    n(
      900106,
      "Library books due",
      "Please return all library books before the end of the month.",
      at(-55, 10, 0),
      at(-25),
      "Library",
      T.dahl,
      true,
    ),
    n(
      900107,
      "Welcome to the new term",
      "Welcome back! We look forward to a term full of learning and fun.",
      at(-70, 8, 0),
      at(30),
      "Administration",
      T.holm,
      true,
      { archived: true },
    ),
  ];
}

export function newsFeed(list: News[], feed: string): EvaNewsItem[] {
  const now = Date.now();
  const expired = (x: News) => !!x.item.toDate && new Date(x.item.toDate).getTime() < now;
  const pick =
    feed === "archived"
      ? list.filter((x) => x.archived)
      : feed === "old"
        ? list.filter((x) => !x.archived && expired(x))
        : list.filter((x) => !x.archived && !expired(x));
  return pick.map((x) => x.item);
}

export function newsDetail(x: News): EvaNewsDetail {
  return {
    ...x.item,
    fromDate: x.item.creDate,
    ...(x.question ? { responseLabel: x.question } : {}),
    attachments: x.attachments.map((a) => ({ fileId: a.fileId, name: a.name })),
    toParent: true,
    toStudent: false,
    toTeacher: false,
    groupRecipients: ["4B"],
  };
}

/** The outdoor day: this Friday, or next week's once this one is over. */
export function nextCalendarEvent(): EvaCalendarEvent {
  const week = weekday(0, 5, 14, 0).getTime() > Date.now() ? 0 : 1;
  return {
    newsId: 900102,
    title: "Outdoor day",
    description: "The whole day in the forest.",
    fromDate: iso(weekday(week, 5, 8, 15)),
    toDate: iso(weekday(week, 5, 14, 0)),
    eventTypeInfo: "Class 4B",
  };
}

/* ---------- Messages ---------- */

export interface Message {
  detail: EvaMessageDetail;
  folder: "inbox" | "sent" | "bin";
  /** Where a message in the bin came from, for "restore". */
  origin: "inbox" | "sent";
}

export function createMessages(): Message[] {
  const m = (
    id: number,
    from: number,
    subject: string,
    body: string,
    date: Date,
    isRead: boolean,
    folder: Message["folder"],
    extra: Partial<EvaMessageDetail> = {},
    origin: Message["origin"] = "inbox",
  ): Message => ({
    folder,
    origin,
    detail: {
      id,
      subject,
      message: body,
      sender:
        from === -1 ? { id: -1, firstName: "SchoolSoft", lastName: "", picture: "" } : sender(from),
      replyTo: from !== -1,
      isRead,
      date: iso(date),
      recipients: [],
      attachments: [],
      sentByUser: false,
      ...extra,
    },
  });
  return [
    m(
      900201,
      T.lind,
      "Packing list for the outdoor day",
      "Hi!\n\nFriday is our outdoor day. The packing list is attached; please check it with Robin on Thursday evening.\n\nBest wishes,\nJohanna",
      at(0, 7, 50),
      false,
      "inbox",
      { attachments: [{ fileId: 900251, name: "Packing list.pdf" }] },
    ),
    m(
      900202,
      -1,
      "A subject warning has been published",
      "A subject warning has been published in Mathematics. Open Assessments to read it and confirm that you have seen it.",
      at(-1, 16, 41),
      true,
      "inbox",
    ),
    m(
      900203,
      T.okafor,
      "Great reading this week",
      "Robin read two chapters aloud to the class this week. Well done!",
      at(-5, 14, 5),
      true,
      "inbox",
    ),
    m(
      900204,
      T.lind,
      "Robin will be late on Thursday",
      "Hi Johanna,\n\nRobin has a dentist appointment on Thursday morning and will arrive around 10.\n\nAlex",
      at(-8, 19, 30),
      true,
      "sent",
      {
        sender: { id: 900001, firstName: "Alex", lastName: "Morgan", picture: "" },
        recipients: [{ id: T.lind, firstName: "Johanna", lastName: "Lind" }],
        sentByUser: true,
        replyTo: false,
      },
      "sent",
    ),
    m(
      900205,
      T.dahl,
      "Lost and found",
      "The lost and found box will be emptied on Friday. Please check it for missing clothes.",
      at(-15, 12, 0),
      true,
      "bin",
    ),
  ];
}

export function messageRow(m: Message): EvaMessageInbox {
  const d = m.detail;
  return {
    id: d.id,
    subject: d.subject,
    message: d.message,
    isRead: d.isRead,
    sender: d.sender,
    date: d.date,
    hasFiles: d.attachments.length > 0,
  };
}

/* ---------- Bookings ---------- */

export interface Booking {
  id: number;
  name: string;
  teacher: number;
  description: string;
  location: string;
  bookableTo: Date | null;
  /** Information-only items have one fixed time and no booking. */
  forInformation: boolean;
  times: { seq: number; start: Date; end: Date; takenByOther: boolean }[];
  /** The slot the student holds, and whether it is confirmed. A held,
   *  unconfirmed slot is one the teacher proposed. */
  held: number | null;
  confirmed: boolean;
  isRead: boolean;
  created: Date;
}

function slots(day: Date, from: string, count: number, minutes: number, taken: number[]) {
  const [h, m] = from.split(":").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(day);
    start.setHours(h, m + i * minutes, 0, 0);
    const end = new Date(start.getTime() + minutes * 60_000);
    return { seq: 0, start, end, takenByOther: taken.includes(i) };
  });
}

export function createBookings(): Booking[] {
  const numbered = (list: ReturnType<typeof slots>) => list.map((t, i) => ({ ...t, seq: i + 1 }));
  return [
    {
      id: 900301,
      name: "Development talk, autumn",
      teacher: T.lind,
      description:
        "Time for Robin's development talk. Robin takes part in the talk. Choose a time that suits you.",
      location: "Room 12",
      bookableTo: at(9, 16, 0),
      forInformation: false,
      times: numbered([
        ...slots(weekday(1, 2), "15:00", 4, 20, [0, 2]),
        ...slots(weekday(1, 4), "14:00", 4, 20, [1]),
      ]),
      held: null,
      confirmed: false,
      isRead: false,
      created: at(-1, 12, 0),
    },
    {
      id: 900302,
      name: "Helpers for the science fair",
      teacher: T.lind,
      description:
        "Thank you for offering to help at the science fair! We've put you down for the time below. Please confirm it.",
      location: "Lab 2",
      bookableTo: at(6, 16, 0),
      forInformation: false,
      times: numbered(slots(weekday(2, 3), "17:00", 3, 30, [0])),
      held: 2,
      confirmed: false,
      isRead: true,
      created: at(-4, 9, 0),
    },
    {
      id: 900303,
      name: "Music evening seats",
      teacher: T.haddad,
      description: "Reserve seats for the music evening.",
      location: "Hall",
      bookableTo: at(10, 16, 0),
      forInformation: false,
      times: numbered(slots(at(9), "18:00", 2, 45, [])),
      held: 1,
      confirmed: true,
      isRead: true,
      created: at(-6, 10, 0),
    },
    {
      id: 900304,
      name: "Class photo",
      teacher: T.dahl,
      description: `The class photo for 4B is taken in the ${SCHOOL_NAME} hall. No booking needed.`,
      location: "Hall",
      bookableTo: null,
      forInformation: true,
      times: numbered(slots(weekday(3, 2), "09:00", 1, 30, [])),
      held: null,
      confirmed: false,
      isRead: true,
      created: at(-10, 8, 0),
    },
  ];
}

function bookingStatus(b: Booking): TimebookingSummary["status"] {
  if (b.forInformation) return "FOR_INFORMATION";
  if (b.held !== null) return b.confirmed ? "BOOKED" : "NEEDS_CONFIRMATION";
  return b.times.some((t) => !t.takenByOther) ? "AVAILABLE" : "NOT_AVAILABLE";
}

const heldSlot = (b: Booking) => b.times.find((t) => t.seq === b.held) ?? null;

export function bookingSummary(b: Booking): TimebookingSummary {
  const held = heldSlot(b);
  return {
    timebookingId: b.id,
    name: b.name,
    status: bookingStatus(b),
    isRead: b.isRead,
    creDate: iso(b.created),
    bookableTo: b.bookableTo ? iso(b.bookableTo) : null,
    firstTimebookingTime: b.times[0] ? iso(b.times[0].start) : null,
    lastTimebookingTime: b.times.at(-1) ? iso(b.times.at(-1)!.end) : null,
    studentBookedDate: held ? iso(held.start) : null,
    timebookingTimeAmount: b.times.length,
    teacher: (() => {
      const [fName = "", ...rest] = fullName(b.teacher).split(" ");
      return { fName, lName: rest.join(" "), picture: "" };
    })(),
  };
}

export function bookingDetail(b: Booking): TimebookingDetail {
  const byDay = new Map<string, TimebookingDate>();
  for (const t of b.times) {
    const key = ymd(t.start);
    const day = byDay.get(key) ?? {
      date: new Date(t.start).setHours(0, 0, 0, 0),
      timebookingTimes: [],
    };
    const mine = t.seq === b.held;
    day.timebookingTimes.push({
      timebookingTimeKey: { timebookingid: b.id, sequence: t.seq },
      startTime: t.start.getTime(),
      endTime: t.end.getTime(),
      date: day.date,
      length: Math.round((t.end.getTime() - t.start.getTime()) / 60_000),
      comment: null,
      location: b.location,
      booked: mine || t.takenByOther,
      bookedByStudent: mine,
      confirmed: mine && b.confirmed,
    });
    byDay.set(key, day);
  }
  return {
    ...bookingSummary(b),
    description: b.description,
    meetingLink: null,
    bookable: !b.forInformation && (b.bookableTo === null || b.bookableTo.getTime() > Date.now()),
    onlyStudent: false,
    bookedByStudent: b.held !== null,
    timebookingDates: [...byDay.values()],
  };
}

/** The next held time from now, as the home card shows it. */
export function bookingStartpage(list: Booking[]): TimebookingStartpageItem | null {
  const upcoming = list
    .map((b) => ({ b, t: heldSlot(b) }))
    .filter((x): x is { b: Booking; t: NonNullable<ReturnType<typeof heldSlot>> } => !!x.t)
    .filter((x) => x.t.end.getTime() > Date.now())
    .sort((a, b) => a.t.start.getTime() - b.t.start.getTime())[0];
  if (!upcoming) return null;
  return {
    timebookingId: upcoming.b.id,
    name: upcoming.b.name,
    teacherName: fullName(upcoming.b.teacher),
    startTime: upcoming.t.start.getTime(),
    endTime: upcoming.t.end.getTime(),
  };
}

export function bookingCalendar(list: Booking[]): CalendarItem[] {
  return list.flatMap((b) => {
    const t = heldSlot(b) ?? (b.forInformation ? b.times[0] : null);
    if (!t) return [];
    return [
      {
        eventId: b.id,
        name: b.name,
        startDate: localT(t.start),
        endDate: localT(t.end),
        allDay: false,
        category: "timeBooking",
        teacher: fullName(b.teacher),
      },
    ];
  });
}

/* ---------- Lunch ---------- */

const DISHES: [string, string][] = [
  ["Chicken stew with rice", "Bean and vegetable stew with rice"],
  ["Pasta bolognese", "Pasta with tomato and lentil sauce"],
  ["Baked fish with potatoes and dill sauce", "Falafel with potatoes and yoghurt sauce"],
  ["Pea soup with pancakes", "Lentil soup with pancakes"],
  ["Meatballs with mashed potatoes", "Vegetable balls with mashed potatoes"],
  ["Tomato soup with bread", "Tomato soup with bread"],
  ["Chicken tacos", "Halloumi tacos"],
  ["Salmon with rice and vegetables", "Tofu with rice and vegetables"],
];

export function lunchWeek(week: number): EvaLunchDay[] {
  return [1, 2, 3, 4, 5].map((dayId) => {
    const [main, veg] = DISHES[(week * 5 + dayId) % DISHES.length]!;
    return {
      week,
      dayId,
      dishes: [
        { mealType: "Lunch", description: main },
        { mealType: "Vegetarian", description: veg },
      ],
    };
  });
}

/* ---------- School events (web calendar) ---------- */

export function schoolEvents(): CalendarItem[] {
  return [
    {
      eventId: 900951,
      name: "Outdoor day",
      description: "The whole day in the forest.",
      startDate: localT(weekday(0, 5, 0, 0)),
      endDate: localT(weekday(0, 5, 23, 59)),
      allDay: true,
      category: "event",
      typeName: "Class 4B",
    },
    {
      eventId: 900952,
      name: "Parents' evening",
      startDate: localT(weekday(1, 2, 18, 0)),
      endDate: localT(weekday(1, 2, 19, 30)),
      allDay: false,
      category: "event",
      typeName: "Whole school",
    },
    {
      eventId: 900953,
      name: "Autumn break",
      startDate: localT(weekday(2, 1, 0, 0)),
      endDate: localT(weekday(2, 5, 23, 59)),
      allDay: true,
      category: "event",
      typeName: "Whole school",
    },
  ];
}

/* ---------- Server-rendered pages ---------- */

export const SCHOOL_PAGE = `<div class="formtable"><table>
<tr><td>Adress</td><td>${SCHOOL_NAME}</td></tr>
<tr><td></td><td>Skolvägen 1</td></tr>
<tr><td></td><td>123 45 Exempelstad</td></tr>
<tr><td>Telefon</td><td>0700-000000</td></tr>
<tr><td>Hemsida</td><td><a href="https://www.example.com/">https://www.example.com/</a></td></tr>
<tr><td>E-post</td><td>info@example.com</td></tr>
</table></div>`;

export const LIBRARY_FILE_ID = 900961;

export const LIBRARY_PAGE = `
<div class="h2_container" id="library_con"><div class="h2_box"><div class=" h2 ">General</div></div>
<div id="library_con_content" class="h2_innerno_pad">
  <div class="h3_bold">Forms</div>
  <table class="table"><tr><td>
    <a href="https://www.example.com/accident-report" target="_blank"><img src="x.png" alt="" />&nbsp;Accident report</a>
    <div>Report an accident or injury at school.</div>
  </td></tr><tr><td>
    <div class="heading_bold">Absence policy</div><div>How to report absence and leave.</div>
    <a href="right_student_library_download.jsp?requestid=${LIBRARY_FILE_ID}" title="Absence policy.pdf"><img alt="" src="pdf.png"/>Absence policy.pdf</a> (48&nbsp;KB)<br />
  </td></tr></table>
  <div class="h3_bold">Policies</div>
  <table class="table"><tr><td>
    <a href="https://www.example.com/privacy" target="_blank">Privacy notice</a>
  </td></tr></table>
</div></div>`;
