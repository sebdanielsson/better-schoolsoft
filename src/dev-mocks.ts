/** Dev-only fetch mocks. Active when `?mock=1` is in the URL or
 *  `localStorage.bss_dev_mock === '1'`. Used to preview the UI without a SchoolSoft account.
 */

function isoWeekOf(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const DAY1970: Record<number, string> = {
  1: "1970-01-05",
  2: "1970-01-06",
  3: "1970-01-07",
  4: "1970-01-01",
  5: "1970-01-02",
};

function lesson(
  id: number,
  day: number,
  start: string,
  end: string,
  subject: string,
  room: string,
  teacher: string,
  weeksMask: number,
) {
  return {
    id,
    subjectId: id,
    startTime: `${DAY1970[day]} ${start}:00.0`,
    endTime: `${DAY1970[day]} ${end}:00.0`,
    groupName: subject,
    location: room,
    teacherName: teacher,
    weeks: weeksMask,
  };
}

/* Staff directory mock — grouped exactly like the real Eva endpoint. Pictures point
 * at `teacher{id}.jpg` filenames that won't resolve in mock mode, so avatars fall
 * back to initials (same behaviour as the news mocks). */
/* All staff entries are fully fictional. IDs are sequential 1001+ so they can't
 * accidentally collide with a real SchoolSoft teacher record, and email uses
 * the RFC 2606 reserved `example.com` domain. */
const staffGroups = [
  {
    type: "Lärare",
    data: [
      { teacherId: 1001, firstName: "Erik", lastName: "Andersson", picture: "teacher1001.jpg" },
      { teacherId: 1002, firstName: "Sofia", lastName: "Lindberg", picture: "" },
      { teacherId: 1003, firstName: "James", lastName: "Carter", picture: "teacher1003.jpg" },
      { teacherId: 1004, firstName: "Maya", lastName: "Patel", picture: "teacher1004.jpg" },
      { teacherId: 1005, firstName: "Lukas", lastName: "Müller", picture: "teacher1005.jpg" },
      { teacherId: 1006, firstName: "Aiko", lastName: "Tanaka", picture: "teacher1006.jpg" },
      { teacherId: 1007, firstName: "Diego", lastName: "Ramírez", picture: "teacher1007.jpg" },
      { teacherId: 1008, firstName: "Olivia", lastName: "Brown", picture: "teacher1008.jpg" },
      { teacherId: 1009, firstName: "Noah", lastName: "Johansson", picture: "teacher1009.jpg" },
      { teacherId: 1010, firstName: "Priya", lastName: "Sharma", picture: "teacher1010.jpg" },
      { teacherId: 1011, firstName: "Marco", lastName: "Bianchi", picture: "teacher1011.jpg" },
      { teacherId: 1012, firstName: "Zara", lastName: "O'Brien", picture: "teacher1012.jpg" },
      { teacherId: 1013, firstName: "Hiroshi", lastName: "Sato", picture: "teacher1013.jpg" },
      { teacherId: 1014, firstName: "Camilla", lastName: "Olsen", picture: "teacher1014.jpg" },
      { teacherId: 1015, firstName: "Tomás", lastName: "Silva", picture: "teacher1015.jpg" },
      { teacherId: 1016, firstName: "Eva", lastName: "Novák", picture: "teacher1016.jpg" },
    ],
  },
  {
    type: "Övrig personal",
    data: [
      { teacherId: 1017, firstName: "Mateo", lastName: "García", picture: "teacher1017.jpg" },
      { teacherId: 1018, firstName: "Yara", lastName: "Mansour", picture: "teacher1018.jpg" },
      { teacherId: 1019, firstName: "Karin", lastName: "Eriksson", picture: "teacher1019.jpg" },
    ],
  },
  {
    type: "Skolledare",
    data: [
      { teacherId: 1020, firstName: "Helena", lastName: "Bergstrom", picture: "teacher1020.jpg" },
      { teacherId: 1021, firstName: "Daniel", lastName: "Cohen", picture: "teacher1021.jpg" },
      { teacherId: 1022, firstName: "Sara", lastName: "Wilson", picture: "teacher1022.jpg" },
      { teacherId: 1023, firstName: "Henrik", lastName: "Nilsson", picture: "teacher1023.jpg" },
      { teacherId: 1024, firstName: "Amélie", lastName: "Dubois", picture: "teacher1024.jpg" },
      { teacherId: 1025, firstName: "Robert", lastName: "Taylor", picture: "teacher1025.jpg" },
    ],
  },
  {
    type: "Elevvårdare",
    data: [
      { teacherId: 1026, firstName: "Emma", lastName: "Karlsson", picture: "" },
      { teacherId: 1027, firstName: "Liam", lastName: "O'Connor", picture: "teacher1027.jpg" },
      { teacherId: 1028, firstName: "Mei", lastName: "Lin", picture: "teacher1028.jpg" },
    ],
  },
];

const staffDetails: Record<number, Record<string, unknown>> = {
  1022: {
    firstName: "Sara",
    lastName: "Wilson",
    email: "sara.wilson@example.com",
    mobile: "0700-000001",
    picture: "teacher1022.jpg",
    contactInfo: "",
    type: "Skolledare",
    roles: ["HoY", "Mentor Yr4", "Mentor", "Activity leader"],
  },
  1001: {
    firstName: "Erik",
    lastName: "Andersson",
    email: "erik.andersson@example.com",
    mobile: "",
    picture: "teacher1001.jpg",
    contactInfo: "Reachable in the staff room weekday mornings.",
    type: "Lärare",
    roles: ["English Yr5", "Mentor"],
  },
  1020: {
    firstName: "Helena",
    lastName: "Bergstrom",
    email: "helena.bergstrom@example.com",
    mobile: "0700-000002",
    picture: "teacher1020.jpg",
    contactInfo: "",
    type: "Skolledare",
    roles: ["Principal"],
  },
  1004: {
    firstName: "Maya",
    lastName: "Patel",
    email: "maya.patel@example.com",
    mobile: "0700-000003",
    picture: "teacher1004.jpg",
    contactInfo: "Office hours: Tuesdays 14:00–16:00 in room 312.",
    type: "Lärare",
    roles: ["English Yr7", "English Yr8", "Mentor Yr8", "Mentor", "Class teacher"],
  },
};

function defaultStaffDetail(teacherId: number) {
  for (const g of staffGroups) {
    const m = g.data.find((x) => x.teacherId === teacherId);
    if (m) {
      return {
        firstName: m.firstName,
        lastName: m.lastName,
        email: `${m.firstName.toLowerCase().split(" ")[0]}.${m.lastName.toLowerCase().split(" ")[0]}@example.com`,
        mobile: "",
        picture: m.picture,
        contactInfo: "",
        type: g.type,
        roles: [],
      };
    }
  }
  return { firstName: "Unknown", lastName: "", picture: "", type: "", roles: [] };
}

function buildMocks() {
  const today = new Date();
  const w = isoWeekOf(today);
  const mask = (1 << (w - 1)) | (1 << w) | (1 << (w - 2)) | (1 << (w + 1));

  const lessons = [
    lesson(1, 1, "08:30", "09:20", "English 4B", "Room 142", "Ms. Anderson", mask),
    lesson(2, 1, "09:30", "10:20", "Mathematics", "Room 210", "Mr. Johansson", mask),
    lesson(3, 1, "10:40", "11:30", "Swedish", "Room 142", "Ms. Lindberg", mask),
    lesson(4, 1, "12:30", "13:20", "Physical Education", "Gym", "Mr. Berg", mask),
    lesson(5, 2, "08:30", "09:20", "Science", "Room 305", "Dr. Karlsson", mask),
    lesson(6, 2, "09:30", "10:20", "Art", "Room 120", "Ms. Pettersson", mask),
    lesson(7, 2, "10:40", "12:00", "Mathematics", "Room 210", "Mr. Johansson", mask),
    lesson(8, 3, "08:30", "09:20", "English 4B", "Room 142", "Ms. Anderson", mask),
    lesson(9, 3, "09:30", "10:20", "History", "Room 208", "Mr. Nilsson", mask),
    lesson(10, 3, "10:40", "11:30", "Music", "Room 160", "Ms. Olsson", mask),
    lesson(11, 3, "13:00", "13:50", "Mathematics", "Room 210", "Mr. Johansson", mask),
    lesson(12, 4, "08:30", "09:20", "Geography", "Room 305", "Dr. Karlsson", mask),
    lesson(13, 4, "09:30", "10:20", "Swedish", "Room 142", "Ms. Lindberg", mask),
    lesson(14, 4, "12:30", "13:20", "Religion", "Room 208", "Mr. Nilsson", mask),
    lesson(15, 5, "08:30", "09:20", "English 4B", "Room 142", "Ms. Anderson", mask),
    lesson(16, 5, "09:30", "10:20", "Mathematics", "Room 210", "Mr. Johansson", mask),
    lesson(17, 5, "10:40", "11:30", "Physical Education", "Gym", "Mr. Berg", mask),
  ];

  const buildLunchWeek = (week: number, dates: string[]) => ({
    week,
    monday: "Veckans lunch · Spaghetti Bolognese\nVeckans vegetariska · Halloumi och linsgryta",
    tuesday:
      "Veckans lunch · Stekt fisk med potatismos\nVeckans vegetariska · Bönbiff med tzatziki",
    wednesday: "Veckans lunch · Kycklinggryta med ris\nVeckans vegetariska · Indisk dahl med naan",
    thursday: "Veckans lunch · Ärtsoppa och pannkakor\nVeckans vegetariska · Linssoppa",
    friday:
      "Veckans lunch · Fiskpinnar med remouladsås\nVeckans vegetariska · Quornbiffar med sallad",
    saturday: "",
    sunday: "",
    dates,
  });
  const lunch = [
    buildLunchWeek(w, ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"]),
    buildLunchWeek(w + 1, ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"]),
  ];

  const now = Date.now();
  const oneDay = 86_400_000;
  const calendar = [
    {
      id: 100,
      eventStart: now + 2 * oneDay + 9 * 3.6e6,
      eventEnd: now + 2 * oneDay + 11 * 3.6e6,
      title: "Friluftsdag",
      eventTypeInfo: "Whole school",
    },
    {
      id: 101,
      eventStart: now + 5 * oneDay + 14 * 3.6e6,
      eventEnd: now + 5 * oneDay + 16 * 3.6e6,
      title: "Föräldramöte 4B",
      eventTypeInfo: "Class 4B",
    },
    {
      id: 102,
      eventStart: now + 9 * oneDay + 8 * 3.6e6,
      title: "Nationella prov – Svenska",
      eventTypeInfo: "Test",
    },
    {
      id: 103,
      eventStart: now + 14 * oneDay + 10 * 3.6e6,
      title: "Skolavslutning",
      eventTypeInfo: "Whole school",
    },
    {
      id: 104,
      eventStart: now + 21 * oneDay + 9 * 3.6e6,
      title: "Sommarlovets början",
      eventTypeInfo: "Holiday",
    },
  ];

  const news = [
    {
      id: 200,
      eventStart: now - 1 * oneDay,
      title: "Pollensäsongen närmar sig",
      description:
        "Våren är på väg och med den kommer ljusare dagar och spirande natur. Informera klassföreståndaren om eventuell pollenallergi.",
      eventTypeInfo: "School news",
    },
    {
      id: 201,
      eventStart: now - 4 * oneDay,
      title: "Nya hämtningsregler för fritids",
      description:
        "Från och med måndag den 18:e gäller nya rutiner för avhämtning från fritids — vänligen läs det utskickade dokumentet.",
      eventTypeInfo: "Practical",
    },
    {
      id: 202,
      eventStart: now - 7 * oneDay,
      title: "Klassfoton denna vecka",
      description:
        "Fotografering av klass 4B sker på onsdag förmiddag i aulan. Ta gärna med ett extra plagg om barnet vill byta inför fotot.",
      eventTypeInfo: "Reminder",
    },
  ];

  /* Eva-style lunch keyed by week (mirrors /eva/api/v1/schools/{orgId}/lunchmenu/{week}). */
  const evaLunchByWeek: Record<
    number,
    Array<{ week: number; dayId: number; dishes: Array<{ mealType: string; description: string }> }>
  > = {
    [w]: [
      {
        week: w,
        dayId: 1,
        dishes: [
          { mealType: "Veckans lunch", description: "Kycklinggryta med curry och ris" },
          { mealType: "Veckans vegetariska", description: "Vegetarisk currygryta med ris" },
        ],
      },
      {
        week: w,
        dayId: 2,
        dishes: [
          { mealType: "Veckans lunch", description: "Husets pasta carbonara med hårdost" },
          { mealType: "Veckans vegetariska", description: "Pasta med ratatouille" },
        ],
      },
      {
        week: w,
        dayId: 3,
        dishes: [
          {
            mealType: "Veckans lunch",
            description: "Sprödbakad kyckling med bearnaisesås och rostad potatis",
          },
          {
            mealType: "Veckans vegetariska",
            description: "Vegetarisk schnitzel med bearnaisesås och rostad potatis",
          },
        ],
      },
      {
        week: w,
        dayId: 4,
        dishes: [
          { mealType: "Veckans lunch", description: "Ärtsoppa med pannkakor och sylt" },
          { mealType: "Veckans vegetariska", description: "Linssoppa" },
        ],
      },
      {
        week: w,
        dayId: 5,
        dishes: [
          { mealType: "Veckans lunch", description: "Fiskpinnar med remouladsås" },
          { mealType: "Veckans vegetariska", description: "Quornbiffar med sallad" },
        ],
      },
    ],
  };

  return { lessons, lunch, calendar, news, evaLunchByWeek };
}

export function shouldInstallMocks(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("mock") === "1") {
    localStorage.setItem("bss_dev_mock", "1");
    return true;
  }
  if (params.get("mock") === "0") {
    localStorage.removeItem("bss_dev_mock");
    return false;
  }
  return localStorage.getItem("bss_dev_mock") === "1";
}

/** In-memory state for mock-mode confirmation: ids the user has acknowledged
 *  during this session. Resets on page reload, which matches our needs for a
 *  preview/demo. */
const confirmedWarnings = new Set<number>();

export function installMocks() {
  const { lessons, lunch, calendar, news, evaLunchByWeek } = buildMocks();

  /* Pre-seed an authenticated session so the dashboard renders.
   * `eva` is included so the modern Eva endpoints are exercised in mock mode too. */
  if (!localStorage.getItem("bss_session")) {
    localStorage.setItem(
      "bss_session",
      JSON.stringify({
        school: "exampleacademy",
        appKey: "mock-appkey",
        token: "mock-token",
        expiryDate: "2099-01-01 00:00:00.0",
        orgId: 21,
        orgName: "Example Academy",
        name: "Alex",
        userType: "2",
        eva: {
          accessToken: "mock-eva-access",
          refreshToken: "mock-eva-refresh",
          expiresAt: Date.now() + 900_000,
        },
      }),
    );
  }

  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    /* Eva lunch by week: /{school}/eva/api/v1/schools/{orgId}/lunchmenu/{week} */
    const evaLunchMatch = url.match(/\/eva\/api\/v1\/schools\/\d+\/lunchmenu\/(\d+)$/);
    if (evaLunchMatch) {
      const week = Number(evaLunchMatch[1]);
      return Promise.resolve(json(evaLunchByWeek[week] ?? []));
    }
    /* Eva lunch by week/day */
    if (/\/eva\/api\/v1\/schools\/\d+\/lunchmenu\/week\/\d+\/day\/\d+/.exec(url)) {
      return Promise.resolve(
        json([
          { mealType: "Veckans lunch", description: "Fiskpinnar med remouladsås" },
          { mealType: "Veckans vegetariska", description: "Quornbiffar med sallad" },
        ]),
      );
    }
    /* Eva: parent profile */
    if (/\/eva\/api\/v1\/parent\/\d+\/profile$/.exec(url)) {
      return Promise.resolve(
        json({
          fName: "Alex",
          lName: "Doe",
          email: "alex.doe@example.com",
          socialNumber: "800101-0001",
          address1: "Examplegatan 1",
          address2: "",
          poCode: "123 45",
          city: "EXAMPLECITY",
          mobile: "+46123456789",
          homePhone: "",
          workPhone: "",
          contactInfo: "",
          notPublish: true,
        }),
      );
    }
    /* Eva: profile permission parameters */
    if (
      /\/parameters\/parent\/profile\/allow-(name-change|address-and-po-code-change)$/.exec(url)
    ) {
      return Promise.resolve(json(true));
    }
    /* Eva: profile updates */
    if (/\/eva\/api\/v1\/parent\/\d+\/profile\/(address|name|contact|notPublish)$/.exec(url)) {
      return Promise.resolve(new Response("", { status: 200 }));
    }
    /* Eva parent root */
    if (/\/eva\/api\/v1\/parent$/.exec(url)) {
      return Promise.resolve(
        json({
          guid: "mock-parent-guid",
          userId: 167324,
          firstName: "Alex",
          lastName: "Doe",
          children: [
            {
              studentId: 115957,
              firstName: "Sam",
              lastName: "Doe",
              picture: "student115957.jpg",
              guid: "mock-child-guid",
              schools: [{ orgId: 21, name: "Example Academy", className: "4B" }],
              username: "sam.doe1",
            },
          ],
        }),
      );
    }
    /* Eva: current lesson */
    if (/lessons\/week\/\d+\/day\/\d+\/current/.exec(url)) {
      const h = new Date().getHours();
      if (h >= 9 && h < 10) {
        return Promise.resolve(
          json({
            lessonId: 2,
            subjectName: "Mathematics",
            teacherName: "Mr. Johansson",
            location: "Room 210",
            startTime: "1970-01-01 09:30:00.0",
            endTime: "1970-01-01 10:20:00.0",
          }),
        );
      }
      return Promise.resolve(new Response("", { status: 200 }));
    }
    /* Eva: next lesson */
    if (/lessons\/week\/\d+\/day\/\d+\/next/.exec(url)) {
      return Promise.resolve(
        json({
          lessonId: 3,
          subjectName: "Swedish",
          teacherName: "Ms. Lindberg",
          location: "Room 142",
          startTime: "1970-01-01 10:40:00.0",
          endTime: "1970-01-01 11:30:00.0",
        }),
      );
    }
    /* Eva: full news list (/eva/api/v2/parent/{userId}/schools/{orgId}/news) */
    if (/\/eva\/api\/v2\/parent\/\d+\/schools\/\d+\/news(\?|$)/.exec(url)) {
      const now = Date.now();
      const day = 86_400_000;
      const news = [
        {
          id: 329806,
          title: "Pollensäsongen närmar sig ",
          description:
            "Våren är på väg och med den kommer ljusare dagar, spirande natur och mer tid utomhus. Samtidigt innebär våren också starten på pollensäsongen.\n\nVi vill uppmuntra alla att vara uppmärksamma på eventuella pollenallergier — gärna börja med allergimediciner i god tid.\n\nMer info: https://www.1177.se/Uppsala-lan/undersokning-behandling/vaccinationer/vaccination-mot-tbe/",
          creDate: new Date(now - 22 * day).toISOString(),
          toDate: new Date(now + 60 * day).toISOString(),
          category: "Student Care",
          author: { id: 1020, name: "Helena Bergstrom", picture: "teacher1020.jpg" },
          read: true,
          hasAttachment: false,
        },
        {
          id: 328943,
          title: "Information om betyg i modersmål",
          description:
            "Kära vårdnadshavare,\n\nVi vill informera er om att vi har fått betygen för de elever som deltar i modersmålsundervisning. Dessa delas ut under denna vecka.",
          creDate: new Date(now - 30 * day).toISOString(),
          category: "Administration",
          author: { id: 1022, name: "Sara Wilson", picture: "teacher1022.jpg" },
          read: false,
          hasAttachment: false,
        },
        {
          id: 319198,
          title: "Alfa Facit",
          description: "",
          creDate: new Date(now - 120 * day).toISOString(),
          category: "Info from Teachers",
          author: { id: 1004, name: "Maya Patel", picture: "teacher1004.jpg" },
          read: true,
          hasAttachment: true,
        },
        {
          id: 285884,
          title: "Welcome to the new academic year '25",
          description:
            "Dear parents,\n\nWelcome to the start of the academic year. Our teachers have welcomed all students with great pleasure and are eager to start.",
          creDate: new Date(now - 270 * day).toISOString(),
          category: "Academic Coordinator",
          author: { id: 1896, name: "Dana Brown", picture: "" },
          read: true,
          hasAttachment: true,
        },
      ];
      return Promise.resolve(json(news));
    }

    /* Eva: latest news */
    if (url.includes("/news/latest")) {
      return Promise.resolve(
        json({
          newsId: 329806,
          title: "Pollensäsongen närmar sig ",
          description:
            "Våren är på väg och med den kommer ljusare dagar, spirande natur och mer tid utomhus. Samtidigt inne...",
          fromDate: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      );
    }
    /* Eva: next calendar event */
    if (url.includes("/news/calendarevent/next")) {
      return Promise.resolve(
        json({
          title: "Friluftsdag",
          fromDate: new Date(Date.now() + 2 * 86_400_000 + 9 * 3.6e6).toISOString(),
          eventTypeInfo: "Whole school",
        }),
      );
    }
    /* Eva: messages/unread */
    if (url.endsWith("/messages/unread")) {
      return Promise.resolve(json(2));
    }
    /* Eva: messages/inbox */
    if (/\/messages\/inbox$/.exec(url)) {
      const now = Date.now();
      const day = 86_400_000;
      return Promise.resolve(
        json([
          {
            id: 4181968,
            subject: "Information about subject warning",
            message: "A subject warning has been issued in Mathematics (MA) for Sam Doe",
            isRead: false,
            sender: { id: -1, firstName: "SchoolSoft", lastName: "", picture: "" },
            date: new Date(now - 2 * day).toISOString(),
            hasFiles: false,
          },
          {
            id: 4180111,
            subject: "Welcome back from break!",
            message:
              "Hello Year 4 parents, I hope you all had a relaxing break. We're picking up from Chapter 5 in math this week.",
            isRead: false,
            sender: {
              id: 1004,
              firstName: "Maya",
              lastName: "Patel",
              picture: "teacher1004.jpg",
            },
            date: new Date(now - 6 * day).toISOString(),
            hasFiles: true,
          },
          {
            id: 4172001,
            subject: "Reminder: vaccination consent",
            message:
              "Please remember to submit the vaccination consent form by Friday. Reach out if you have any questions.",
            isRead: true,
            sender: {
              id: 1020,
              firstName: "Helena",
              lastName: "Bergstrom",
              picture: "teacher1020.jpg",
            },
            date: new Date(now - 14 * day).toISOString(),
            hasFiles: false,
          },
        ]),
      );
    }
    /* Eva: single message detail */
    const msgMatch = url.match(/\/messages\/(\d+)$/);
    if (msgMatch) {
      const id = Number(msgMatch[1]);
      const samples: Record<number, unknown> = {
        4181968: {
          id: 4181968,
          subject: "Information about subject warning",
          message: "A subject warning has been issued in Mathematics (MA) for Sam Doe",
          sender: { id: -1, firstName: "SchoolSoft", lastName: "", picture: "" },
          replyTo: false,
          isRead: true,
          date: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          recipients: [],
          attachments: [],
          sentByUser: false,
        },
        4180111: {
          id: 4180111,
          subject: "Welcome back from break!",
          message:
            "Hello Year 4 parents,\n\nI hope you all had a relaxing break. We're picking up from Chapter 5 in math this week — students will need their textbook every day.\n\nHomework is on the usual cadence: short exercises Mon/Wed/Fri, an open-ended problem on Sundays.\n\nLet me know if you have any questions.\n\nMaya",
          sender: {
            id: 1004,
            firstName: "Maya",
            lastName: "Patel",
            picture: "teacher1004.jpg",
          },
          replyTo: true,
          isRead: false,
          date: new Date(Date.now() - 6 * 86_400_000).toISOString(),
          recipients: [{ id: 1, firstName: "Year 4", lastName: "Parents", picture: "" }],
          attachments: [{ id: 999, name: "Homework-plan-w20.pdf", size: 184_320 }],
          sentByUser: false,
        },
      };
      return Promise.resolve(json(samples[id] ?? samples[4181968]));
    }
    /* Eva: badges */
    if (/\/badge\/(news|bookings|subjectrooms|holisticassessments)/.exec(url)) {
      const matched =
        /\/badge\/(news|bookings|subjectrooms|holisticassessments)/.exec(url)?.[1] ?? "";
      const fakeCounts: Record<string, number> = {
        news: 0,
        bookings: 0,
        subjectrooms: 85,
        holisticassessments: 2,
      };
      return Promise.resolve(json(fakeCounts[matched] ?? 0));
    }

    /* School list (used by the login combobox) */
    if (url.includes("/internal/rest-api/login/schoollist")) {
      const eva = (slug: string) => `https://sms.schoolsoft.se/${slug}/eva`;
      return Promise.resolve(
        json([
          {
            name: "Example Academy - North Campus",
            orgId: 21,
            evaUrl: eva("exampleacademy"),
          },
          {
            name: "Example Academy - South Campus",
            orgId: 22,
            evaUrl: eva("exampleacademy"),
          },
          {
            name: "Example Academy - East Campus",
            orgId: 23,
            evaUrl: eva("exampleacademy"),
          },
          {
            name: "Example Academy - West Campus",
            orgId: 24,
            evaUrl: eva("exampleacademy"),
          },
          { name: "Beta Gymnasium", orgId: 1, evaUrl: eva("beta") },
          { name: "Gamma kommun - Sample School A", orgId: 5, evaUrl: eva("gamma") },
          { name: "Gamma kommun - Sample School B", orgId: 6, evaUrl: eva("gamma") },
          { name: "Delta Waldorf", orgId: 1, evaUrl: eva("delta") },
          { name: "Epsilon Montessori", orgId: 1, evaUrl: eva("epsilon") },
          { name: "Zeta School - South", orgId: 3, evaUrl: eva("zeta") },
          { name: "Eta Gymnasium", orgId: 1, evaUrl: eva("eta") },
          { name: "Theta School", orgId: 1, evaUrl: eva("theta") },
          {
            name: "Iota Foundation - Primary",
            orgId: 1,
            evaUrl: eva("iota"),
          },
        ]),
      );
    }

    if (url.includes("/rest-api/login/token")) {
      return Promise.resolve(
        json({
          access_token: "mock-eva-access",
          refresh_token: "mock-eva-refresh",
          type: "Bearer",
          expires: 900,
        }),
      );
    }

    /* Schoolsoft React webview: bootstrap session — real upstream 303s with
     * cookies, but the data endpoint below ignores them in mock mode, so a
     * plain 200 with the same Set-Cookie shape is enough. */
    if (/\/eva-apps\/auth\/login\/parent$/.exec(url)) {
      return Promise.resolve(
        new Response("", {
          status: 200,
          headers: {
            "set-cookie": "JSESSIONID=mock-jsessionid; Path=/schoolsoft/exampleacademy; HttpOnly",
          },
        }),
      );
    }
    /* Calendar lessons (rest-api). Derives concrete ISO dates for the asked
     * week using the same lesson definitions the legacy endpoint serves. */
    const calendarLessonsMatch = url.match(
      /\/rest-api\/parent\/calendar\/lessons\/week\/(\d+)/,
    );
    if (calendarLessonsMatch) {
      const askedWeek = Number(calendarLessonsMatch[1]);
      const today = new Date();
      const currentWeek = isoWeekOf(today);
      /* Find Monday of the asked week by stepping from today's Monday. */
      const todayMonday = (() => {
        const dn = today.getDay() || 7;
        return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (dn - 1));
      })();
      const askedMonday = new Date(todayMonday);
      askedMonday.setDate(todayMonday.getDate() + (askedWeek - currentWeek) * 7);
      const isoDate = (day: number, hhmm: string) => {
        const d = new Date(askedMonday);
        d.setDate(askedMonday.getDate() + (day - 1));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}T${hhmm}`;
      };
      type LessonDef = {
        day: number;
        start: string;
        end: string;
        name: string;
        room: string;
        teacher: string;
        color: string;
      };
      const defs: LessonDef[] = [
        { day: 1, start: "08:30", end: "09:20", name: "Ma", room: "Room 210", teacher: "Mr. Johansson,Ms. Lindberg", color: "#adff9e" },
        { day: 1, start: "09:20", end: "09:30", name: "Break", room: "", teacher: "", color: "#cccccc" },
        { day: 1, start: "09:30", end: "10:20", name: "En", room: "Room 142", teacher: "Ms. Anderson", color: "#b5d8e6" },
        { day: 1, start: "10:20", end: "10:40", name: "Break", room: "", teacher: "", color: "#cccccc" },
        { day: 1, start: "10:40", end: "11:30", name: "Sv", room: "Room 142", teacher: "Ms. Lindberg", color: "#91a6ed" },
        { day: 1, start: "11:30", end: "12:30", name: "Lunch", room: "Cafeteria", teacher: "", color: "#fef3c7" },
        { day: 1, start: "12:30", end: "13:20", name: "IDH", room: "Gym", teacher: "Mr. Berg", color: "#f7beed" },
        { day: 2, start: "08:30", end: "09:20", name: "Science", room: "Room 305", teacher: "Dr. Karlsson", color: "#34c451" },
        { day: 2, start: "09:30", end: "10:20", name: "Art", room: "Room 120", teacher: "Ms. Pettersson", color: "#e6b8b8" },
        { day: 2, start: "10:40", end: "12:00", name: "Mathematics", room: "Room 210", teacher: "Mr. Johansson", color: "#adff9e" },
        { day: 3, start: "08:30", end: "09:20", name: "English 4B", room: "Room 142", teacher: "Ms. Anderson", color: "#b5d8e6" },
        { day: 3, start: "09:30", end: "10:20", name: "History", room: "Room 208", teacher: "Mr. Nilsson", color: "#f0ff8f" },
        { day: 3, start: "10:40", end: "11:30", name: "Music", room: "Room 160", teacher: "Ms. Olsson", color: "#f7beed" },
        { day: 3, start: "13:00", end: "13:50", name: "Mathematics", room: "Room 210", teacher: "Mr. Johansson", color: "#adff9e" },
        { day: 4, start: "08:30", end: "09:20", name: "Geography", room: "Room 305", teacher: "Dr. Karlsson", color: "#34c451" },
        { day: 4, start: "09:30", end: "10:20", name: "Swedish", room: "Room 142", teacher: "Ms. Lindberg", color: "#91a6ed" },
        { day: 4, start: "12:30", end: "13:20", name: "Religion", room: "Room 208", teacher: "Mr. Nilsson", color: "#757575" },
        { day: 5, start: "08:30", end: "09:20", name: "English 4B", room: "Room 142", teacher: "Ms. Anderson", color: "#b5d8e6" },
        { day: 5, start: "09:30", end: "10:20", name: "Mathematics", room: "Room 210", teacher: "Mr. Johansson", color: "#adff9e" },
        { day: 5, start: "10:40", end: "11:30", name: "Physical Education", room: "Gym", teacher: "Mr. Berg", color: "#f7beed" },
      ];
      const body = defs.map((d, i) => ({
        allDay: false,
        category: "lesson",
        dayId: d.day - 1,
        description: d.name,
        editable: false,
        endDate: isoDate(d.day, d.end),
        eventColor: d.color,
        eventId: 3000000 + askedWeek * 100 + i,
        name: d.name,
        room: d.room,
        roomBooking: false,
        startDate: isoDate(d.day, d.start),
        status: 2,
        studentLessonStatus: null,
        teacher: d.teacher,
        teachingGroup: "4B",
      }));
      return Promise.resolve(json(body));
    }
    /* Material file metadata. Same `/file` URL — JSON metadata array, not the
     * binary. Maps material ids to file names matching what the upstream API
     * returns. */
    const materialFileMatch = url.match(
      /\/rest-api\/parent\/ps\/material\/(\d+)\/file$/,
    );
    if (materialFileMatch) {
      const id = Number(materialFileMatch[1]);
      const byId: Record<number, Array<{ fileId: number; fileName: string }>> = {
        34583: [{ fileId: 484942, fileName: "v 20 åk 4 Min läslogg .pdf" }],
        35080: [{ fileId: 485724, fileName: "v 21 åk 4 Min läslogg .pdf" }],
      };
      return Promise.resolve(json(byId[id] ?? [{ fileId: 0, fileName: `Material ${id}.pdf` }]));
    }
    /* /rest-api/parameters — feature flags (gates PS-module cards). */
    if (/\/rest-api\/parameters$/.exec(url)) {
      return Promise.resolve(
        json({
          useFunctionPS: true,
          useGuardian: true,
          useLunchMenu: true,
          useTimebooking: true,
          scheduleStart: 7,
          scheduleEnd: 17,
          scheduleDays: 5,
        }),
      );
    }
    /* Assignment detail family: view / sections / connected_plannings /
     * submission / assessment. */
    const assignmentSubmissionMatch = url.match(
      /\/rest-api\/parent\/ps\/submission\/(\d+)/,
    );
    if (assignmentSubmissionMatch) {
      return Promise.resolve(
        json({
          allowLateHandIn: false,
          closeDate: "",
          description: null,
          expireDate: "2026-05-13T00:00",
          groupHandIn: false,
          handInType: "PHYSICAL",
          plagiarismCheck: false,
          submissionStatus: {
            groupSubmissionId: -1,
            studentSubmissionId: 5003,
            submitted: false,
          },
        }),
      );
    }
    const assignmentAssessmentMatch = url.match(
      /\/rest-api\/parent\/ps\/assignment\/(\d+)\/assessment$/,
    );
    if (assignmentAssessmentMatch) {
      const id = Number(assignmentAssessmentMatch[1]);
      return Promise.resolve(
        json({
          review: id === 104101 ? "Achieved the goals" : "",
          studentComment: "",
          teacherComment:
            id === 104101 ? "Great progress on weekly reading!" : "",
          assessedCriteriaTabs: [],
          assessmentPartialMoments: [],
        }),
      );
    }
    const assignmentViewMatch = url.match(
      /\/rest-api\/parent\/ps\/assignments\/(\d+)\/view$/,
    );
    if (assignmentViewMatch) {
      const id = Number(assignmentViewMatch[1]);
      const titles: Record<number, { title: string; sub: string; type: string; subject: string; descr: string }> = {
        104979: {
          title: "Läslogg och veckans ord till vecka 20",
          sub: "onsdag 06 maj 2026 00:00 - onsdag 13 maj 2026 00:00",
          type: "Hemläxa",
          subject: "Swedish",
          descr:
            "<p>Eleverna ska förstå ordens betydelse och kunna stava dem korrekt. De ska även läsa minst 45 minuter till nästa vecka och lämna in sin läslogg senast på tisdag nästa vecka.</p>",
        },
        104982: {
          title: "Läslogg och veckans ord till vecka 21",
          sub: "onsdag 13 maj 2026 00:00 - onsdag 20 maj 2026 00:00",
          type: "Hemläxa",
          subject: "Swedish",
          descr:
            "<p>Samma upplägg som föregående vecka. Läs minst 45 minuter och lämna in en kortfattad läslogg.</p>",
        },
      };
      const t = titles[id] ?? {
        title: `Assignment ${id}`,
        sub: "",
        type: "Hemläxa",
        subject: "—",
        descr: "<p>No description.</p>",
      };
      return Promise.resolve(
        json({
          id,
          title: t.title,
          subTitle: t.sub,
          type: t.type,
          subjectNames: t.subject,
          description: t.descr,
          publishDate: "6 may 10:15",
          integrationType: null,
          contents: [],
        }),
      );
    }
    const assignmentSectionsMatch = url.match(
      /\/rest-api\/parent\/ps\/assignments\/(\d+)\/sections$/,
    );
    if (assignmentSectionsMatch) {
      return Promise.resolve(
        json([
          { id: 3978, type: "SUBMISSION" },
          { id: 66227, type: "RESULTREPORT" },
          { id: 34583, type: "MATERIAL" },
        ]),
      );
    }
    const assignmentPlanningsMatch = url.match(
      /\/rest-api\/parent\/ps\/assignments\/(\d+)\/connected_plannings$/,
    );
    if (assignmentPlanningsMatch) {
      return Promise.resolve(json([]));
    }
    /* Planning detail family. */
    const planningViewMatch = url.match(
      /\/rest-api\/parent\/ps\/plannings\/(\d+)\/view$/,
    );
    if (planningViewMatch) {
      return Promise.resolve(
        json({
          title: "Y4 Chapter 6 Bråk, volym och vikt",
          subjectNames: "Mathematics",
          contents: [],
        }),
      );
    }
    const planningTabsMatch = url.match(
      /\/rest-api\/parent\/ps\/plannings\/(\d+)\/planning_parts\/tabs$/,
    );
    if (planningTabsMatch) {
      return Promise.resolve(
        json([{ id: 82400, order: 1, title: "Y4 Chapter 6 Bråk, volym och vikt" }]),
      );
    }
    const planningPartViewMatch = url.match(
      /\/rest-api\/parent\/ps\/planning_parts\/(\d+)\/view$/,
    );
    if (planningPartViewMatch) {
      return Promise.resolve(
        json({
          title: "Y4 Chapter 6 Bråk, volym och vikt",
          subtitle: "fredag 27 mars 2026 - fredag 15 maj 2026",
          publishDate: "24 mar 12:40",
          description:
            "<p>In this chapter the students will work with:</p><ul><li>knowing how to write numbers as fractions</li><li>knowing different units for volume and weight</li><li>knowing how to do unit conversions</li><li>knowing how to solve problems with volume and weight</li></ul>",
        }),
      );
    }
    const planningPartAssignmentsMatch = url.match(
      /\/rest-api\/parent\/ps\/planning_parts\/(\d+)\/connected_assignments$/,
    );
    if (planningPartAssignmentsMatch) {
      return Promise.resolve(
        json([
          {
            id: 104979,
            planningId: null,
            read: false,
            sortDate: null,
            subTitle: "Due 2026-05-13 00:00 | Hemläxa",
            title: "Läslogg vecka 20",
          },
          {
            id: 104982,
            planningId: null,
            read: false,
            sortDate: null,
            subTitle: "Due 2026-05-20 00:00 | Hemläxa",
            title: "Läslogg vecka 21",
          },
        ]),
      );
    }
    /* Plannings this week (start-page) — week-dependent. */
    const planningsStartMatch = url.match(
      /\/rest-api\/parent\/ps\/planning_parts\/start-page\?week=(\d+)&year=(\d+)/,
    );
    if (planningsStartMatch) {
      const askedWeek = Number(planningsStartMatch[1]);
      const currentWeek = isoWeekOf(new Date());
      const delta = askedWeek - currentWeek;
      const data: Record<number, Array<{
        activityId: number;
        id: number;
        planningId: number;
        read: boolean;
        subTitle: string;
        title: string;
      }>> = {
        [-1]: [
          {
            activityId: 33086,
            id: 82400,
            planningId: 52440,
            read: true,
            subTitle: "fre 27 mars - fre 15 maj Planning, Mathematics",
            title: "Y4 Chapter 6 Bråk, volym och vikt",
          },
        ],
        0: [
          {
            activityId: 33086,
            id: 82400,
            planningId: 52440,
            read: false,
            subTitle: "fre 27 mars - fre 15 maj Planning, Mathematics",
            title: "Y4 Chapter 6 Bråk, volym och vikt",
          },
          {
            activityId: 40900,
            id: 104156,
            planningId: 65122,
            read: false,
            subTitle: "tis 07 apr. - sön 07 juni Planning, Technology",
            title: "Unit 6 - Technology",
          },
        ],
        1: [
          {
            activityId: 40900,
            id: 104156,
            planningId: 65122,
            read: false,
            subTitle: "tis 07 apr. - sön 07 juni Planning, Technology",
            title: "Unit 6 - Technology",
          },
        ],
      };
      return Promise.resolve(json(data[delta] ?? []));
    }
    /* Schoolsoft React webview: assignments this week (start-page). Week-
     * dependent so prev/next navigation surfaces different data. */
    const assignmentsMatch = url.match(/\/rest-api\/parent\/ps\/assignments\/start-page\?week=(\d+)&year=(\d+)/);
    if (assignmentsMatch) {
      const askedWeek = Number(assignmentsMatch[1]);
      const currentWeek = isoWeekOf(new Date());
      const delta = askedWeek - currentWeek;
      const dataByDelta: Record<number, Array<{
        activityId: number;
        id: number;
        read: boolean;
        resultReportStatus: string;
        sortDate: string;
        subTitle: string;
        submissionStatus: string;
        title: string;
      }>> = {
        [-1]: [
          {
            activityId: 49187,
            id: 104101,
            read: true,
            resultReportStatus: "REPORTED",
            sortDate: "2026-05-06 00:00",
            subTitle: "Hand-in due ons 6 maj 00:00, Hemläxa, Swedish",
            submissionStatus: "EXPIRED_SUBMITTED",
            title: "Läslogg och veckans ord till vecka 19",
          },
        ],
        0: [
          {
            activityId: 49187,
            id: 104979,
            read: false,
            resultReportStatus: "NOT_REPORTED",
            sortDate: "2026-05-13 00:00",
            subTitle: "Hand-in due ons 13 maj 00:00, Hemläxa, Swedish",
            submissionStatus: "EXPIRED_NOT_SUBMITTED",
            title: "Läslogg och veckans ord till vecka 20",
          },
          {
            activityId: 49187,
            id: 104982,
            read: false,
            resultReportStatus: "NOT_REPORTED",
            sortDate: "2026-05-20 00:00",
            subTitle: "Hand-in due ons 20 maj 00:00, Hemläxa, Swedish",
            submissionStatus: "NOT_SUBMITTED",
            title: "Läslogg och veckans ord till vecka 21",
          },
        ],
        1: [
          {
            activityId: 49187,
            id: 104982,
            read: false,
            resultReportStatus: "NOT_REPORTED",
            sortDate: "2026-05-20 00:00",
            subTitle: "Hand-in due ons 20 maj 00:00, Hemläxa, Swedish",
            submissionStatus: "NOT_SUBMITTED",
            title: "Läslogg och veckans ord till vecka 21",
          },
          {
            activityId: 33086,
            id: 105501,
            read: false,
            resultReportStatus: "NOT_REPORTED",
            sortDate: "2026-05-22 09:30",
            subTitle: "Hand-in due fre 22 maj 09:30, Hemläxa, Mathematics",
            submissionStatus: "NOT_SUBMITTED",
            title: "6.7 Homework — review",
          },
        ],
      };
      return Promise.resolve(json(dataByDelta[delta] ?? []));
    }
    /* Schoolsoft React webview: subject warning confirm.
     *  GET = read guardian acknowledgement state
     *  POST = flip it to acknowledged */
    const confirmMatch = url.match(/\/rest-api\/parent\/holistic_assessment\/(\d+)\/subject_warning\/confirm$/);
    if (confirmMatch) {
      const id = Number(confirmMatch[1]);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST") {
        confirmedWarnings.add(id);
        return Promise.resolve(new Response("", { status: 200 }));
      }
      const hasConfirmed = confirmedWarnings.has(id);
      return Promise.resolve(
        json({
          hasConfirmed,
          confirmedAt: hasConfirmed ? "Today 13:48" : "",
          name: hasConfirmed ? "Alex Doe" : "",
        }),
      );
    }
    /* Subject warning detail. */
    const warningMatch = url.match(/\/rest-api\/parent\/holistic_assessment\/(\d+)\/subject_warning$/);
    if (warningMatch) {
      const id = Number(warningMatch[1]);
      if (id !== 179856) return Promise.resolve(json(null));
      return Promise.resolve(
        json({
          active: true,
          comment:
            "You need to show your ability to solve basic division with rest (ex: 16/3 = 5 rest 1). Please retest this skill as soon as possible. If you do not show this knowledge soon, you're at risk of not passing mathematics.",
          createdAt: "14 May 18:25",
          holisticAssessmentId: id,
          lastUpdatedAt: "14 May 18:26",
          lastUpdatedBy: "Ms. Anderson",
          published: true,
          publishedAt: "14 May 18:26",
        }),
      );
    }
    /* Knowledge development panel. */
    const kdMatch = url.match(/\/rest-api\/parent\/holistic_assessment\/(\d+)\/knowledge_development\/view$/);
    if (kdMatch) {
      const id = Number(kdMatch[1]);
      const valuesById: Record<number, { value: string; updatedBy: string; date: string }> = {
        179856: { value: "Is in need of support to achieve acceptable knowledge", updatedBy: "Ms. Anderson", date: "14 May 18:26" },
        310723: { value: "Has more than acceptable knowledge", updatedBy: "Mr. Lindgren", date: "12 Apr 09:18" },
        51109: { value: "Has acceptable knowledge", updatedBy: "Ms. Lindberg", date: "26 Feb 10:17" },
        686419: { value: "Has acceptable knowledge", updatedBy: "Dr. Karlsson", date: "8 May 13:10" },
        334069: { value: "Has more than acceptable knowledge", updatedBy: "Mr. Berg", date: "25 Feb 15:33" },
      };
      const v = valuesById[id];
      if (!v) return Promise.resolve(json(null));
      return Promise.resolve(
        json({
          value: v.value,
          supportMeasures: id === 179856 ? "Extra division practice during Friday support sessions." : "",
          updatedByInfo: `Last updated ${v.date} by ${v.updatedBy}`,
        }),
      );
    }
    /* Sections published — what panels to render. */
    const sectionsMatch = url.match(/\/rest-api\/parent\/holistic_assessment\/(\d+)\/sections\/published$/);
    if (sectionsMatch) {
      const id = Number(sectionsMatch[1]);
      if (id === 179856) {
        return Promise.resolve(
          json(["ATTENDANCE", "FORMATIVE_COMMENT", "KNOWLEDGE_DEVELOPMENT", "SUBJECT_WARNING"]),
        );
      }
      return Promise.resolve(json(["KNOWLEDGE_DEVELOPMENT"]));
    }
    /* Detail header for a single assessment. */
    const detailMatch = url.match(/\/rest-api\/parent\/holistic_assessment\/(\d+)$/);
    if (detailMatch) {
      const id = Number(detailMatch[1]);
      const subjectsById: Record<number, string> = {
        179856: "Mathematics (MA)",
        310723: "English (EN)",
        51109: "Swedish (SV)",
        686419: "Geography (GE)",
        334069: "Physical Education and Health (IDH)",
        685704: "Music (MU)",
      };
      return Promise.resolve(
        json({
          id,
          activityName: subjectsById[id] ?? `Subject ${id}`,
          groupName: "4B",
          studentName: "Sam",
          studentId: 115957,
          publishDate: "",
          publishStatus: "PUBLISHED",
        }),
      );
    }
    /* Schoolsoft React webview: holistic assessment rows. Two unread published
     * rows so the badge count of 2 above stays consistent. */
    if (/\/rest-api\/parent\/holistic_assessment\/rows$/.exec(url)) {
      return Promise.resolve(
        json([
          {
            title: "English",
            subTitle: "Mer än godtagbara kunskaper",
            color: "#b5d8e6",
            subjectWarning: false,
            updatedAt: "2026-04-12T09:18:50",
            friendlyUpdatedAt: "12 apr. 09:18",
            holisticAssessmentId: 310723,
            published: true,
            read: true,
          },
          {
            title: "Mathematics",
            subTitle: "Ämnesvarning",
            color: "#adff9e",
            subjectWarning: true,
            updatedAt: "2026-05-14T18:26:56",
            friendlyUpdatedAt: "14 maj 18:26",
            holisticAssessmentId: 179856,
            published: true,
            read: false,
          },
          {
            title: "Swedish",
            subTitle: "Godtagbara kunskaper",
            color: "#91a6ed",
            subjectWarning: false,
            updatedAt: "2026-02-26T10:17:55",
            friendlyUpdatedAt: "26 feb. 10:17",
            holisticAssessmentId: 51109,
            published: true,
            read: true,
          },
          {
            title: "Geography",
            subTitle: "Godtagbara kunskaper",
            color: "#34c451",
            subjectWarning: false,
            updatedAt: "2026-05-08T13:10:32",
            friendlyUpdatedAt: "8 maj 13:10",
            holisticAssessmentId: 686419,
            published: true,
            read: false,
          },
          {
            title: "Physical Education",
            subTitle: "Mer än godtagbara kunskaper",
            color: "#f7beed",
            subjectWarning: false,
            updatedAt: "2026-02-25T15:33:09",
            friendlyUpdatedAt: "25 feb. 15:33",
            holisticAssessmentId: 334069,
            published: true,
            read: true,
          },
          {
            title: "Music",
            subTitle: "Ingen bedömning publicerad",
            color: "#757575",
            subjectWarning: false,
            updatedAt: "-",
            friendlyUpdatedAt: "-",
            holisticAssessmentId: -1,
            published: false,
            read: false,
          },
          {
            title: "Art",
            subTitle: "Ingen bedömning publicerad",
            color: "#757575",
            subjectWarning: false,
            updatedAt: "-",
            friendlyUpdatedAt: "-",
            holisticAssessmentId: -1,
            published: false,
            read: false,
          },
        ]),
      );
    }
    /* Eva: staff directory */
    if (/\/eva\/api\/v1\/schools\/\d+\/staff(\?|$)/.exec(url)) {
      return Promise.resolve(json(staffGroups));
    }
    /* Eva: staff detail */
    const staffDetailMatch = url.match(/\/eva\/api\/v1\/schools\/\d+\/staff\/(\d+)(\?|$)/);
    if (staffDetailMatch) {
      const id = Number(staffDetailMatch[1]);
      return Promise.resolve(json(staffDetails[id] ?? defaultStaffDetail(id)));
    }

    if (url.includes("/api/lessons/student/")) return Promise.resolve(json(lessons));
    if (url.includes("/api/lunchmenus/student/")) return Promise.resolve(json(lunch));
    if (url.includes("/api/notices/student/")) {
      if (url.includes("news")) return Promise.resolve(json(news));
      return Promise.resolve(json(calendar));
    }
    if (url.includes("/rest/app/token"))
      return Promise.resolve(json({ token: "mock-token", expiryDate: "2099-01-01 00:00:00.0" }));
    if (url.includes("/rest/app/login"))
      return Promise.resolve(
        json({
          appKey: "mock-appkey",
          orgs: [{ orgId: 21, orgName: "Example Academy" }],
          name: "Alex",
        }),
      );
    return origFetch(input, init);
  };

  /* Banner so it's obvious we're in mock mode. */
  queueMicrotask(() => {
    if (document.querySelector("#bss-mock-banner")) return;
    const b = document.createElement("div");
    b.id = "bss-mock-banner";
    b.textContent = "Mock data preview · add ?mock=0 to disable";
    b.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;background:#f59e0b;color:#1e293b;font-size:12px;font-weight:600;text-align:center;padding:4px 8px;z-index:9999;font-family:-apple-system,sans-serif";
    document.body.appendChild(b);
  });
}
