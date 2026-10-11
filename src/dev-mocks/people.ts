/** The mock family, school and staff. Every name, id and address here is
 *  invented: ids live in the 9xxxxx range, which real SchoolSoft records
 *  don't reach at the schools we've seen, and contact details use the
 *  reserved `example.com` / `0700-0000xx` ranges. Never paste real API
 *  responses into these files; the repository is public. */

import type {
  EvaParent,
  EvaParentProfile,
  EvaStaffDetail,
  EvaStaffGroup,
  EvaTeacher,
  SchoolListEntry,
} from "../api/schoolsoft.ts";

export const SCHOOL = "exampleacademy";
export const ORG_ID = 9001;
export const SCHOOL_NAME = "Example Academy";

export const PARENT_ID = 900001;
export const ROBIN = 910001;
export const KIM = 910002;

export const parent: EvaParent = {
  guid: "mock-parent",
  userId: PARENT_ID,
  firstName: "Alex",
  lastName: "Morgan",
  children: [
    {
      studentId: ROBIN,
      firstName: "Robin",
      lastName: "Morgan",
      picture: "",
      guid: "mock-robin",
      schools: [{ orgId: ORG_ID, name: SCHOOL_NAME, className: "4B" }],
      username: "robin.morgan",
    },
    {
      studentId: KIM,
      firstName: "Kim",
      lastName: "Morgan",
      picture: "",
      guid: "mock-kim",
      schools: [{ orgId: ORG_ID, name: SCHOOL_NAME, className: "7A" }],
      username: "kim.morgan",
    },
  ],
};

export const initialProfile: EvaParentProfile = {
  fName: "Alex",
  lName: "Morgan",
  email: "alex.morgan@example.com",
  socialNumber: "",
  mobile: "0700-000001",
  homePhone: "",
  workPhone: "",
  address1: "Exempelgatan 12",
  address2: "",
  poCode: "123 45",
  city: "Exempelstad",
  contactInfo: "",
  notPublish: false,
};

interface StaffMember {
  id: number;
  first: string;
  last: string;
  group: string;
  roles: string[];
  info?: string;
}

/** Teachers referenced throughout the fixtures by id. */
export const T = {
  lind: 901001,
  okafor: 901002,
  berg: 901003,
  novak: 901004,
  haddad: 901005,
  sato: 901006,
  quinn: 901007,
  rivera: 901008,
  holm: 901009,
  park: 901010,
  ek: 901011,
  dahl: 901012,
} as const;

const STAFF: StaffMember[] = [
  {
    id: T.lind,
    first: "Johanna",
    last: "Lind",
    group: "Lärare",
    roles: ["Class teacher 4B", "Mathematics", "Science"],
    info: "Reachable by message on weekdays.",
  },
  { id: T.okafor, first: "Daniel", last: "Okafor", group: "Lärare", roles: ["English"] },
  { id: T.berg, first: "Maria", last: "Berg", group: "Lärare", roles: ["Swedish", "History"] },
  { id: T.novak, first: "Petr", last: "Novak", group: "Lärare", roles: ["Physical Education"] },
  { id: T.haddad, first: "Leila", last: "Haddad", group: "Lärare", roles: ["Music"] },
  { id: T.sato, first: "Kenji", last: "Sato", group: "Lärare", roles: ["Art", "Crafts"] },
  {
    id: T.quinn,
    first: "Fiona",
    last: "Quinn",
    group: "Lärare",
    roles: ["Class teacher 7A", "English"],
  },
  { id: T.rivera, first: "Tomas", last: "Rivera", group: "Lärare", roles: ["Mathematics 7A"] },
  {
    id: T.holm,
    first: "Agnes",
    last: "Holm",
    group: "Skolledning",
    roles: ["Principal"],
    info: "Office hours Tuesdays 14:00–15:30.",
  },
  { id: T.park, first: "Min", last: "Park", group: "Skolledning", roles: ["Deputy principal"] },
  { id: T.ek, first: "Sven", last: "Ek", group: "Elevhälsa", roles: ["School nurse"] },
  { id: T.dahl, first: "Ida", last: "Dahl", group: "Övrig personal", roles: ["Receptionist"] },
];

export const fullName = (id: number) => {
  const s = STAFF.find((m) => m.id === id);
  return s ? `${s.first} ${s.last}` : "Staff member";
};

export const staffGroups: EvaStaffGroup[] = [...new Set(STAFF.map((s) => s.group))].map(
  (group) => ({
    type: group,
    data: STAFF.filter((s) => s.group === group).map((s) => ({
      teacherId: s.id,
      firstName: s.first,
      lastName: s.last,
      picture: "",
    })),
  }),
);

export function staffDetail(id: number): EvaStaffDetail | null {
  const s = STAFF.find((m) => m.id === id);
  if (!s) return null;
  return {
    firstName: s.first,
    lastName: s.last,
    email: `${s.first}.${s.last}@example.com`.toLowerCase(),
    mobile: "",
    picture: "",
    contactInfo: s.info ?? "",
    type: s.group,
    roles: s.roles,
  };
}

/** Message recipients: teachers only, as `/teachers` returns. */
export const teachers: EvaTeacher[] = STAFF.filter((s) => s.group === "Lärare").map((s) => ({
  teacherId: s.id,
  fname: s.first,
  lname: s.last,
  picture: "",
  type: s.group,
}));

export const schoolList: SchoolListEntry[] = [
  {
    name: `${SCHOOL_NAME} - North`,
    orgId: ORG_ID,
    evaUrl: `https://sms.schoolsoft.se/${SCHOOL}/eva`,
  },
  {
    name: `${SCHOOL_NAME} - South`,
    orgId: 9002,
    evaUrl: `https://sms.schoolsoft.se/${SCHOOL}/eva`,
  },
  { name: "Sample Gymnasium", orgId: 9101, evaUrl: "https://sms.schoolsoft.se/samplegym/eva" },
  { name: "Demo Montessori", orgId: 9201, evaUrl: "https://sms.schoolsoft.se/demomontessori/eva" },
];
