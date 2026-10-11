# Feature parity tracker

Tracks feature parity with the official SchoolSoft guardian web app (`/jsp/student/*`, `/react/#/parent/*`) and the iOS "Vårdnadshavare" app. Endpoint details live in [eva-api.md](eva-api.md).

Sources: web sidebar (`/rest-api/parent/sidebar/sectiongroups`), iOS menu (`/eva/api/v4/schools/{orgId}/parents/{userId}/menu`), and the iOS app's screen list. Last checked against both menus on 2026-10-11: every item there is either listed under "In this app" or explained in one of the sections below.

## In this app

- [x] **Home dashboard**: today's lessons with a "now / next up" banner, lunch, assignments and plannings this week, upcoming events, latest news, next booking.
- [x] **Schedule**: week view with week navigation (web "Schema & Kalender", iOS `SCHEDULE`).
- [x] **Calendar**: upcoming events, bookings, tests and homework.
- [x] **Lunch menu**: the home card, with week navigation (web "Matsedel", iOS `LUNCH`). There is no separate lunch page.
- [x] **Notification center**: every unread item for the child in focus (messages, news, bookings, assignments, results, plannings, assessments) in one panel, newest first. You can open an item, mark it read, or mark everything read after a confirmation. The section nav shows unread badges. How each kind is marked read is documented in `src/lib/notifications.ts` and `eva-api.md`.
- [x] **Subject rooms**: subject list with teachers, assignments, plannings and results per subject, unread markers (web `/react/#/parent/subjectrooms`, iOS `SUBJECT_ROOMS`). They also cover the web's legacy "Planeringar & uppgifter" and "Uppgifter & resultat" pages.
- [x] **Assignment and planning detail**, including submissions, results and connected items.
- [x] **Bookings**: list and detail, reserve, confirm and cancel a slot, next booking on the home page (web `right_student_timebooking.jsp`, iOS `BOOKINGS`). The write calls (reserve, confirm, cancel) were verified against mocked responses only, because the account had no open booking. Past bookings appear only on the web page.
- [x] **Report absence**: week overview of per-day and per-lesson status, report a full day or single lessons with a comment, gated by school parameters (web `right_student_absence.jsp`, iOS `ABSENCE`). The write calls follow the iOS app but have not been exercised against the live server; first real use should be watched.
- [x] **Messages**: inbox, sent folder, trash, compose, reply, delete and restore, mark as unread, attachments. Read/unread and trash/restore were verified live. Compose and reply follow the school's `message-usage-level-allow-all` setting and the message's `replyTo` flag. Both are off at the reference school, so sending is untested.
- [x] **News**: read state, answering questions where asked, archived and older news, attachments with inline images. Read marking and archive/unarchive were verified live. Answering is untested because no open question was available.
- [x] **Holistic assessments**: list, detail, confirm subject warnings (web "Sammantagen bedömning", iOS `HOLISTIC_ASSESSMENT`).
- [x] **Staff directory**: searchable, with a role filter (web "Kontaktlistor", iOS `STAFF_LIST`).
- [x] **School information** and **files & links** (web `right_student_school.jsp` and `right_student_library.jsp`), both on `/school`. The JSP is parsed with `DOMParser` and only vetted text and links are kept.
- [x] **Profile**: view and edit contact details.
- [x] **Multiple children**: child switcher for guardians with more than one child. Untested live because the account has one child. The cookie session re-bootstraps when the child in focus changes.

## Planned

- [ ] **Sections from the iOS menu**: show a section only when the child's `v4 …/menu` lists it, as the iOS app does, instead of showing every section to everyone.
- [ ] **Mock mode coverage**: `?mock=1` lacks subject rooms, absence, the sent folder, older news, the school page and the notification sources. It is also the only safe way to exercise the untested write calls above.

## Blocked for app sessions (needs a decision)

These web pages redirect app-type sessions (ours, created via `/eva-apps/auth/login/parent`) to `right_student_app_blocked.jsp`. Reaching them would take a full web login session.

- [ ] **Grades** per subject and term, with merit points (`right_student_gradesubject.jsp`)
- [ ] **Presence report**: attendance totals and reasons per week (`right_student_absence_student.jsp`)
- [ ] **Attendance overview**: weekly lesson-by-lesson attendance grid (`right_student_lesson_status.jsp`)
- [ ] **Unreported absence**: lessons with unexplained absence to confirm (`right_parent_absence_message.jsp`)
- [ ] **Student documents** (`right_student_review.jsp`)
- [ ] **Knowledge criteria**, "Kriterier för bedömning av kunskaper" under the web's legacy features (`right_student_ability.jsp`)

## Disabled at the reference school (implement behind parameters only if testable)

- [ ] Leave application, `ledighetsansökan` (`/parameters/student-leave` is `false`)
- [ ] Leave and pick-up for after-school care, `fritids` (`/parameters/students/{id}/leave-pickup` is `false`)
- [ ] Blog and activity log (`/parameters/blog` is `false`)
- [ ] Class list (`/menu/class-list-active`)
- [ ] Preschool schedule and absence (`/is-pre-school` is `false`)

## Not applicable to a web client

- Push notification settings, delete account, custom server, superuser login
