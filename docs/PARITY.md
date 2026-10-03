# Feature parity tracker

Tracks feature parity with the official SchoolSoft guardian web app (`/jsp/student/*`, `/react/#/parent/*`) and the iOS "Vårdnadshavare" app. Endpoint details live in [eva-api.md](eva-api.md).

Sources: web sidebar (`/rest-api/parent/sidebar/sectiongroups`), iOS menu (`/eva/api/v4/schools/{orgId}/parents/{userId}/menu`), and the iOS app's screen list.

## Already in this app

- [x] Home dashboard: today's schedule, lunch, assignments and plannings this week, upcoming events, latest news
- [x] Schedule (week view)
- [x] Calendar
- [x] Lunch menu (week navigation on the home card)
- [x] News list and detail
- [x] Messages: inbox and message detail
- [x] Staff directory
- [x] Profile: view and edit contact details
- [x] Holistic assessments: list, detail, confirm subject warnings
- [x] Assignment detail, planning detail

## Missing

Ordered by priority. Each item ships on its own branch with `pnpm run check` and `pnpm test` green.

- [x] **Subject rooms**: subject list with teachers, assignments and plannings per subject, unread markers (web `/react/#/parent/subjectrooms`, iOS `SUBJECT_ROOMS`). The hero pill links here.
- [x] **Bookings**: time-booking list and detail, reserve, confirm and cancel a slot, next booking on the home page (web `right_student_timebooking.jsp`, iOS `BOOKINGS`). The write calls (reserve, confirm, cancel) were verified against mocked responses only, because the account had no open booking. Past bookings appear only on the web page.
- [ ] **Report absence**: week overview of per-day and per-lesson status, report a full day or single lessons with a comment, gated by school parameters (web `right_student_absence.jsp`, iOS `ABSENCE`).
- [ ] **Messages**: sent folder, trash, compose, reply, delete and restore, mark as unread, attachments.
- [ ] **News**: read state, confirm ("I have read this") where required, archived and older news, attachments.
- [ ] **Files & links**: school library of documents and links (web `right_student_library.jsp`).
- [ ] **School information**: address, homepage, contact (web `right_student_school.jsp`).
- [x] **Assignment results**: results per subject (web legacy "Assignments & results"), covered by the Results card on each subject page.
- [ ] **Multiple children**: child switcher for guardians with more than one child.

## Blocked for app sessions (needs a decision)

These web pages redirect app-type sessions (ours, created via `/eva-apps/auth/login/parent`) to `right_student_app_blocked.jsp`. Reaching them would take a full web login session.

- [ ] **Grades** per subject and term, with merit points (`right_student_gradesubject.jsp`)
- [ ] **Presence report**: attendance totals and reasons per week (`right_student_absence_student.jsp`)
- [ ] **Attendance overview**: weekly lesson-by-lesson attendance grid (`right_student_lesson_status.jsp`)
- [ ] **Unreported absence**: lessons with unexplained absence to confirm (`right_parent_absence_message.jsp`)
- [ ] **Student documents** (`right_student_review.jsp`)

## Disabled at the reference school (implement behind parameters only if testable)

- [ ] Leave application, `ledighetsansökan` (`/parameters/student-leave` is `false`)
- [ ] Leave and pick-up for after-school care, `fritids` (`/parameters/students/{id}/leave-pickup` is `false`)
- [ ] Blog and activity log (`/parameters/blog` is `false`)
- [ ] Class list (`/menu/class-list-active`)
- [ ] Preschool schedule and absence (`/is-pre-school` is `false`)

## Not applicable to a web client

- Push notification settings, delete account, custom server, superuser login

## Tech debt found along the way

- [ ] Profile name edit calls `PUT …/profile/name`, which the iOS app never uses. The app uses `PUT …/profile/personal` with `{fName, lName}`. Verify which one works.
- [ ] `EvaMessageDetail.attachments` is typed `{id, size}`, but the API returns `{fileId, name}`, downloaded via `v1/resource/attachment/{fileId}`.
- [ ] `sanitizeStaffHtml` is a hand-rolled sanitizer. Consider DOMPurify, given that the refresh token lives in `localStorage`.
- [ ] `api/schoolsoft/[...path].ts` uses `runtime: "edge"`, which Vercel has deprecated. Move it to the default Node.js runtime.
