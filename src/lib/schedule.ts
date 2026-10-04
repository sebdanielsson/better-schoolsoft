import type { Lesson, ScheduleLesson } from "../api/schoolsoft.ts";
import { sameLocalDate } from "./dates.ts";
import { expandSubjectCode } from "./subject-codes.ts";

/** Map a `ScheduleLesson` from the rest-api schedule onto the legacy `Lesson`
 *  shape the lesson rows render.
 *  - Standard Skolverket subject codes ("Ma", "SO", …) expanded to long names.
 *  - Teacher fields come back as "A,B" without a space — normalize so the row
 *    reads "A, B" cleanly.
 *  - `startTime`/`endTime` become "YYYY-MM-DD HH:MM:SS.0", the shape
 *    `formatLessonTime` and `lessonDayIndex` read. */
export function scheduleLessonToLesson(l: ScheduleLesson): Lesson {
  const name = expandSubjectCode(l.name);
  return {
    id: l.eventId,
    subjectId: l.eventId,
    startTime: `${l.startDate.replace("T", " ")}:00.0`,
    endTime: `${l.endDate.replace("T", " ")}:00.0`,
    groupName: name,
    subjectName: name,
    teacherName: l.teacher ? l.teacher.replace(/,\s*/g, ", ") : undefined,
    location: l.room || undefined,
    weeks: 0,
  };
}

/** The lessons (not other calendar categories) on `date`, in start order. */
export function scheduleLessonsForDate(scheduleLessons: ScheduleLesson[], date: Date): Lesson[] {
  return scheduleLessons
    .filter((l) => l.category === "lesson")
    .filter((l) => sameLocalDate(new Date(l.startDate), date))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(scheduleLessonToLesson);
}
