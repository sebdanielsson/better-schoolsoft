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
          author: { id: 9840, name: "Anna Smith", picture: "teacher9840.jpg" },
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
          author: { id: 6906, name: "Bea Jones", picture: "teacher6906.jpg" },
          read: false,
          hasAttachment: false,
        },
        {
          id: 319198,
          title: "Alfa Facit",
          description: "",
          creDate: new Date(now - 120 * day).toISOString(),
          category: "Info from Teachers",
          author: { id: 8825, name: "Chris Lee", picture: "teacher8825.jpg" },
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
              id: 8825,
              firstName: "Chris",
              lastName: "Lee",
              picture: "teacher8825.jpg",
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
              id: 9840,
              firstName: "Anna",
              lastName: "Smith",
              picture: "teacher9840.jpg",
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
            "Hello Year 4 parents,\n\nI hope you all had a relaxing break. We're picking up from Chapter 5 in math this week — students will need their textbook every day.\n\nHomework is on the usual cadence: short exercises Mon/Wed/Fri, an open-ended problem on Sundays.\n\nLet me know if you have any questions.\n\nLinda",
          sender: {
            id: 8825,
            firstName: "Chris",
            lastName: "Lee",
            picture: "teacher8825.jpg",
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
