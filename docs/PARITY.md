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
- [x] **Report absence**: week overview of per-day and per-lesson status, report a full day or single lessons with a comment, gated by school parameters (web `right_student_absence.jsp`, iOS `ABSENCE`). The write calls follow the iOS app but have not been exercised against the live server; first real use should be watched.
- [x] **Messages**: sent folder, trash, compose, reply, delete and restore, mark as unread, attachments. Read/unread and trash/restore were verified live. Compose and reply follow the school's `message-usage-level-allow-all` setting and the message's `replyTo` flag. Both are off at the reference school, so sending is untested.
- [x] **News**: read state, answering questions where asked, archived and older news, attachments with inline images. Read marking and archive/unarchive were verified live. Answering is untested because no open question was available.
- [x] **Files & links**: school library of documents and links (web `right_student_library.jsp`).
- [x] **School information**: address, homepage, contact (web `right_student_school.jsp`). Both live on `/school`. The JSP is parsed with `DOMParser` and only vetted text and links are kept.
- [x] **Assignment results**: results per subject (web legacy "Assignments & results"), covered by the Results card on each subject page.
- [x] **Multiple children**: child switcher for guardians with more than one child. Untested live because the account has one child. The cookie session now re-bootstraps when the child in focus changes.

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

- [x] Profile name edit called `PUT …/profile/name`, which returns 404, so editing names was broken. It now uses `PUT …/profile/personal`, verified with a no-op update.
- [x] `EvaMessageDetail.attachments` is typed `{id, size}`, but the API returns `{fileId, name}`, downloaded via `v1/resource/attachment/{fileId}`.
- [x] `sanitizeStaffHtml` was a hand-rolled sanitizer. It is now backed by DOMPurify, with the same stricter policy and mutation-XSS tests.
- [x] `api/schoolsoft/[...path].ts` used `runtime: "edge"`, which Vercel has deprecated. It now runs on the default Node.js runtime.
