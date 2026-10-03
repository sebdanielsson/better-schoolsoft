# Eva API reference (SchoolSoft guardian app)

Reverse-engineered from the official SchoolSoft "Vårdnadshavare" iOS app (Hermes bundle, React Native + SWR + axios) and a mitmproxy capture of a real session. Use this to extend `src/api/schoolsoft.ts`.

## Conventions

All Eva endpoints are relative to `/{school}/eva/api/` (in this repo: `${BASE}/${school}/eva/api/...`) and authenticated with `Authorization: Bearer {access_token}`. Request bodies are JSON (`Content-Type: application/json`). Responses are JSON unless noted; a `200` with an empty body is common for "nothing to show" and for successful writes.

Path placeholders:

| Placeholder   | Meaning                                    | Source                                     |
| ------------- | ------------------------------------------ | ------------------------------------------ |
| `{orgId}`     | School org id (`schoolInFocus`)            | `/v1/parent/{parentId}/children` → `orgId` |
| `{parentId}`  | Logged-in guardian (`userId`)              | `/v1/parent` → `userId`                    |
| `{studentId}` | Selected child (`childInFocus.studentId`)  | `/v1/parent/{parentId}/children`           |
| `{langId}`    | UI language id (1 = Swedish in practice)   | app language context                       |
| `{week}`      | ISO week number only, no year (e.g. `40`)  | `date-fns getISOWeek`                      |
| `{day}`       | Weekday index, `0` = Monday … `4` = Friday |                                            |

Note the inconsistent path shapes the backend uses: `v1/parent/…` vs `v1/parents/…`, `student/` vs `students/`, `schools/{orgId}` first vs last. Copy templates exactly.

The app's HTTP layer has four helpers (`useDispatchGetRequest`, `useDispatchPutRequest`, `useDispatchPostRequest`, `useDispatchDeleteRequest`) that call `axios.{get,put,post,delete}(url, body)`; the body is fixed when the hook is created. Where the app passes `null` as the body it is listed as "no body" below.

Legend:

- **Status**: `implemented` = already in `src/api/schoolsoft.ts`; `new` = not yet implemented.
- **Confidence**: `confirmed` = seen in captured traffic; `inferred` = derived from decompiled code only (URL, method and body field names are reliable; value formats marked "likely" are not).

## 1. Report absence (Frånvaroanmälan)

### Feature flags and parameters

| Method | Path                                                                         | Response                                                                  | Status | Confidence |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ | ---------- |
| GET    | `v1/schools/{orgId}/parameters/report-absence-parent`                        | `true` / `false` — absence reporting enabled                              | new    | confirmed  |
| GET    | `v1/schools/{orgId}/parameters/student-absence-allow-parent-change-absence`  | `boolean` — guardian may remove/undo a report                             | new    | confirmed  |
| GET    | `v1/schools/{orgId}/parameters/student-absence-allow-parent-comment-absence` | `boolean` — guardian may add comments                                     | new    | confirmed  |
| GET    | `v1/student/{studentId}/school/{orgId}/is-pre-school`                        | `boolean` — if `true` the app uses the preschool flow (section 7) instead | new    | confirmed  |

### GET week overview

`GET v1/schools/{orgId}/student/{studentId}/parent/{parentId}/student-absence/week/{week}` — new, confirmed.

```json
{
  "studentAbsenceDays": [
    { "dayId": 0, "status": 0, "hasAbsenceReportFullDay": false, "nrOfLessonsAbsent": 0 },
    { "dayId": 1, "status": 4, "hasAbsenceReportFullDay": true, "nrOfLessonsAbsent": 0 }
  ],
  "parentComment": ""
}
```

### GET day with lessons

`GET v1/schools/{orgId}/student/{studentId}/parent/{parentId}/student-absence/week/{week}/day/{day}` — new, confirmed.

```json
{
  "dayId": 2,
  "hasAbsenceReportFullDay": false,
  "absenceStatusFullDay": 0,
  "lessons": [
    {
      "lessonId": 1000001,
      "subject": "Ma",
      "startTime": "08:30",
      "endTime": "09:30",
      "lessonStatus": 2,
      "lessonStatusStudent": 1,
      "hasAbsenceReportForLesson": false,
      "comment": "",
      "nrOfMinutesAbsent": 0
    }
  ]
}
```

Status codes (from the app's constants module):

| Field                                                              | Values                                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| day `status`, `absenceStatusFullDay`, lesson `lessonStatusStudent` | `0` NO_STATUS, `1` ATTENDANCE, `2` ABSENT, `3` EXPLAINED_ABSENCE, `4` PRE_REPORTED_ABSENCE (guardian report), `750` APPLICATION_OF_LEAVE_APPROVED |
| lesson `lessonStatus`                                              | `1` LESSON_UNREPORTED, `2` LESSON_REPORTED (teacher has taken attendance), `3` LESSON_CANCELLED                                                   |

The app only enables "report full day" when at least one lesson of the day starts after "now" (`canReportFullDay`), and disables per-lesson buttons for cancelled lessons or when a full-day report exists.

### Report / remove full-day absence

| Method | Path                                                                                                         | Body    | Status | Confidence |
| ------ | ------------------------------------------------------------------------------------------------------------ | ------- | ------ | ---------- |
| PUT    | `v1/schools/{orgId}/student/{studentId}/parent/{parentId}/student-absence/week/{week}/day/{day}/date/{date}` | no body | new    | inferred   |
| DELETE | same path                                                                                                    | no body | new    | inferred   |

`{date}` is `Number(dayDate)` where `dayDate` comes from `eachDayOfInterval(startOfWeek, +4 days)` — i.e. epoch milliseconds of local midnight (Europe/Stockholm) for that weekday, e.g. `1759183200000`. Likely, not verified against the server.

### Report / remove absence for one lesson

| Method | Path                                                                                                     | Body    | Status | Confidence |
| ------ | -------------------------------------------------------------------------------------------------------- | ------- | ------ | ---------- |
| POST   | `v1/schools/{orgId}/student/{studentId}/parent/{parentId}/student-absence/week/{week}/lesson/{lessonId}` | no body | new    | inferred   |
| DELETE | same path                                                                                                | no body | new    | inferred   |

Note the asymmetry: full day uses PUT, a single lesson uses POST. `{lessonId}` is `lessons[].lessonId` from the day endpoint.

### Comments

| Method | Path                                                                                                             | Body                                                                         | Status | Confidence |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ | ---------- |
| POST   | `v1/schools/{orgId}/student/{studentId}/parent/{parentId}/student-absence/week/{week}/comment`                   | `{ "comment": "string" }` — week-level comment, read back as `parentComment` | new    | inferred   |
| POST   | `v1/schools/{orgId}/student/{studentId}/parent/{parentId}/student-absence/week/{week}/lesson/{lessonId}/comment` | `{ "comment": "string" }` — read back as `lessons[].comment`                 | new    | inferred   |

There is no comment field on the full-day report itself; the app's "comment" for a day is the week comment plus per-lesson comments.

## 2. Time bookings (Bokningar)

| Method | Path                                                                                      | Body                                      | Status      | Confidence        |
| ------ | ----------------------------------------------------------------------------------------- | ----------------------------------------- | ----------- | ----------------- |
| GET    | `v1/schools/{orgId}/parameters/time-bookings`                                             | — → `boolean`                             | new         | confirmed         |
| GET    | `v1/parents/{parentId}/students/{studentId}/schools/{orgId}/timebookings`                 | —                                         | new         | inferred          |
| GET    | `v1/parents/{parentId}/students/{studentId}/schools/{orgId}/timebookings/startpage`       | — (empty body when nothing upcoming)      | new         | confirmed (empty) |
| GET    | `v1/parents/{parentId}/students/{studentId}/schools/{orgId}/timebookings/{timebookingId}` | —                                         | new         | inferred          |
| PUT    | `v1/schools/{orgId}/parents/{parentId}/students/{studentId}/timebookingtimes/reserve`     | `{ "timebookingid": 123, "sequence": 2 }` | new         | inferred          |
| PUT    | `v1/schools/{orgId}/parents/{parentId}/students/{studentId}/timebookingtimes/confirm`     | `{ "timebookingid": 123, "sequence": 2 }` | new         | inferred          |
| PUT    | `v1/schools/{orgId}/parents/{parentId}/students/{studentId}/timebookingtimes/cancel`      | `{ "timebookingid": 123, "sequence": 2 }` | new         | inferred          |
| POST   | `v1/parent/{parentId}/timebooking-read/{timebookingId}`                                   | no body — mark read                       | new         | inferred          |
| DELETE | `v1/parent/{parentId}/timebooking-read/{timebookingId}`                                   | no body — mark unread                     | new         | inferred          |
| GET    | `v1/schools/{orgId}/parents/{parentId}/badge/bookings?studentId={studentId}`              | — → `number`                              | implemented | confirmed         |

Body field names are all-lowercase `timebookingid` (unlike `timebookingId` in responses). The body is exactly the slot's `timebookingTimeKey` object. Reserve returns HTTP `409 CONFLICT` when another student took the slot. Confirm is used when the teacher has proposed a time (status `NEEDS_CONFIRMATION`).

List item shape (fields read by the list screen):

```json
{
  "timebookingId": 123,
  "name": "Utvecklingssamtal",
  "status": "AVAILABLE",
  "isRead": false,
  "creDate": "2025-09-01T08:00:00",
  "bookableTo": "2025-10-10",
  "firstTimebookingTime": "2025-10-13T08:00:00",
  "lastTimebookingTime": "2025-10-17T16:00:00",
  "studentBookedDate": null,
  "timebookingTimeAmount": 12,
  "teacher": { "fName": "{firstName}", "lName": "{lastName}", "picture": "teacher{id}.jpg" }
}
```

Detail adds `description`, `meetingLink`, `bookable`, `onlyStudent`, `bookedByStudent` and `timebookingDates[]`, each containing `timebookingTimes[]` with `timebookingTimeKey: { timebookingid, sequence }`, `startTime`, `endTime`, `date`, `comment`. Startpage item: `{ timebookingId, name, teacherName, startTime, endTime }`. `status` enum: `AVAILABLE`, `NEEDS_CONFIRMATION`, `NOT_AVAILABLE`, `BOOKED`, `FOR_INFORMATION`.

## 3. Messages (Meddelanden)

All message endpoints use `v1/parent/{parentId}/schools/{orgId}/…`.

| Method | Path                                                          | Body                                         | Status      | Confidence |
| ------ | ------------------------------------------------------------- | -------------------------------------------- | ----------- | ---------- |
| GET    | `…/messages/unread`                                           | — → `number`                                 | implemented | confirmed  |
| GET    | `…/messages/inbox`                                            | —                                            | implemented | inferred   |
| GET    | `…/messages/sent`                                             | —                                            | new         | inferred   |
| GET    | `…/messages/bin`                                              | — (trash)                                    | new         | inferred   |
| GET    | `…/messages/{messageId}`                                      | —                                            | implemented | inferred   |
| POST   | `…/messages`                                                  | new message or reply, see below              | new         | inferred   |
| PUT    | `…/message-recipient/read-date`                               | `{ "messageId": 123 }` — mark read           | new         | inferred   |
| PUT    | `…/message-recipient/un-read`                                 | `{ "messageId": 123 }` — mark unread         | new         | inferred   |
| PUT    | `…/messages/remove-inbox`                                     | `[123, 456]` — move inbox messages to bin    | new         | inferred   |
| PUT    | `…/messages/remove-sent`                                      | `[123, 456]` — move sent messages to bin     | new         | inferred   |
| PUT    | `…/messages/delete`                                           | `[123, 456]` — delete permanently from bin   | new         | inferred   |
| PUT    | `…/messages/restore`                                          | `[123, 456]` — restore from bin              | new         | inferred   |
| PUT    | `…/messages/remove-inbox-swipe`                               | `{ "messageId": 123 }` — single-item variant | new         | inferred   |
| PUT    | `…/messages/remove-sent-swipe`                                | `{ "messageId": 123 }`                       | new         | inferred   |
| PUT    | `…/messages/delete-swipe`                                     | `{ "messageId": 123 }`                       | new         | inferred   |
| PUT    | `…/messages/restore-swipe`                                    | `{ "messageId": 123 }`                       | new         | inferred   |
| GET    | `v1/schools/{orgId}/parameters/message-usage-level-allow-all` | — → `boolean`                                | new         | inferred   |

The folder segment comes from the app's route enum (`inbox`, `sent`, `bin`). Bulk actions send a bare JSON array of message ids. The app picks `remove-*` in inbox/sent and `delete`/`restore` in the bin.

Detail shape (fields read by the detail screen):

```json
{
  "id": 123,
  "subject": "{subject}",
  "message": "{html-encoded body}",
  "date": "2025-09-30T14:05:00",
  "isRead": true,
  "replyTo": true,
  "sentByUser": false,
  "sender": {
    "id": 456,
    "firstName": "{firstName}",
    "lastName": "{lastName}",
    "picture": "teacher456.jpg"
  },
  "recipients": [{ "id": 789, "name": "{name}", "type": "{type}" }],
  "attachments": [{ "fileId": 1001, "name": "{file name}", "type": "pdf" }]
}
```

`replyTo` gates the reply button. Attachments are downloaded via `v1/resource/attachment/{fileId}` (section 8). The existing `EvaMessageDetail.attachments` type (`id`, `name`, `size`) does not match the app, which reads `fileId` and `name`.

### Recipients (teachers)

| Method | Path                                      | Response                                                                                   | Status | Confidence |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------ | ---------- |
| GET    | `v1/schools/{orgId}/teachers`             | `[{ "teacherId": 1, "fname": "…", "lname": "…", "picture": "teacher1.jpg", "type": "…" }]` | new    | inferred   |
| GET    | `v1/schools/{orgId}/teachers/{teacherId}` | single teacher, same shape                                                                 | new    | inferred   |

Guardians can only message staff in this app; the recipient picker is fed by `/teachers`. Class list and parents (section 7) are not used as message recipients.

### Create message / reply

`POST v1/parent/{parentId}/schools/{orgId}/messages` — the app posts its entire form state:

```json
{
  "subject": "{subject}",
  "messageBody": "{plain text}",
  "recipients": [{ "teacherId": 1, "fname": "…", "lname": "…", "picture": "…", "type": "…" }],
  "showRecipients": false
}
```

`recipients` are full objects from `/teachers`; the server most likely only reads `teacherId`. A reply uses the same endpoint: `subject` is the original subject, `recipients` is the original sender resolved via `GET /teachers/{sender.id}`, and `messageBody` is the reply text followed by a quoted header:

```text
{reply text}\r\n\r\nFrån: {firstName} {lastName}  \r\nSkickat: {date} \r\nRubrik: {subject} \r\n\r\n
```

There is no separate reply endpoint and no attachment upload in the guardian app.

## 4. News (Nyheter)

| Method | Path                                                                                       | Body                                                         | Status      | Confidence |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------- | ---------- |
| GET    | `v1/parent/{parentId}/schools/{orgId}/news/latest?studentId={studentId}`                   | —                                                            | implemented | confirmed  |
| GET    | `v2/parent/{parentId}/schools/{orgId}/news?studentId={studentId}&langId={langId}`          | — current feed                                               | implemented | inferred   |
| GET    | `v2/parent/{parentId}/schools/{orgId}/news/old?studentId={studentId}&langId={langId}`      | — expired items                                              | new         | inferred   |
| GET    | `v2/parent/{parentId}/schools/{orgId}/news/archived?studentId={studentId}&langId={langId}` | — items the guardian archived                                | new         | inferred   |
| GET    | `v2/parent/{parentId}/schools/{orgId}/news/{newsId}`                                       | — detail                                                     | new         | inferred   |
| PUT    | `v1/parent/{parentId}/schools/{orgId}/news/read/{newsId}`                                  | no body — sent when the detail opens                         | new         | inferred   |
| POST   | `v1/parent/{parentId}/news-read/{newsId}`                                                  | no body — mark read (list action)                            | new         | inferred   |
| DELETE | `v1/parent/{parentId}/news-read/{newsId}`                                                  | no body — mark unread                                        | new         | inferred   |
| POST   | `v1/parent/{parentId}/news-hidden/{newsId}`                                                | no body — archive                                            | new         | inferred   |
| DELETE | `v1/parent/{parentId}/news-hidden/{newsId}`                                                | no body — unarchive                                          | new         | inferred   |
| GET    | `v1/parent/{parentId}/newsconfirm/{newsId}`                                                | — question/answer state                                      | new         | inferred   |
| PUT    | `v1/parent/{parentId}/newsconfirm/{newsId}`                                                | `{ "responseText": "string" }` — answer or update the answer | new         | inferred   |
| GET    | `v1/parent/{parentId}/schools/{orgId}/news/calendarevent/next?studentId={studentId}`       | —                                                            | implemented | confirmed  |
| GET    | `v1/schools/{orgId}/parents/{parentId}/badge/news?studentId={studentId}`                   | — → `number`                                                 | implemented | confirmed  |

List item fields: `id`, `title`, `description`, `category`, `creDate`, `fromDate`, `toDate`, `read`, `hasAttachment`, `author { name, picture }`, `newsConfirm { response, responseText, toDate }`. Detail adds `strippedDescription`, `attachments[] { fileId, name, type }` (type `IMAGE` for inline images), `toParent`, `toStudent`, `toTeacher`, `groupRecipients`, `teamRecipients`, `responseLabel`.

`newsconfirm` response:

```json
{
  "newsId": 123,
  "question": "{question}",
  "responseText": "",
  "confirmDate": null,
  "toDate": "2025-10-10"
}
```

The app allows answering until `toDate` (end of day); an existing `responseText` switches the button to "update response".

## 5. Subject rooms (Ämnesrum) and badges

Subject rooms are not native in the app. It opens a WebView on the web client after a cookie bootstrap:

1. `GET /{school}/eva-apps/auth/login/parent` with headers `token`, `userId`, `orgId`, `childInFocus`, `redirectUrl`, `theme`, `language`, `userOS: ios` — implemented (`bootstrapSchoolsoftSession` in `schoolsoft.ts`).
2. `redirectUrl` is one of `react/#/parent/subjectrooms`, `react/#/parent/subjectrooms/{activityId}/assignment/{assignmentId}`, or `react/#/student/subjectrooms/{activityId}/planning/{planningId}/part/{partId}`; tabs append `/assignments`, `/plannings`, `/results`.

The data endpoints behind it are the cookie-authenticated `rest-api/parent/ps/...` calls already implemented in `schoolsoft.ts` (assignments, plannings, planning parts, submissions, assessments, materials). Holistic assessment is likewise `rest-api/parent/holistic_assessment/...` (implemented). The calendar/schedule screen is also a WebView (`react/#/parent/calendar`).

Badges — `GET v1/schools/{orgId}/parents/{parentId}/badge/{kind}?studentId={studentId}` → `number`:

| Kind                                                      | Status      | Confidence |
| --------------------------------------------------------- | ----------- | ---------- |
| `news`, `bookings`, `subjectrooms`, `holisticassessments` | implemented | confirmed  |
| `blogposts`, `student-leave`                              | new         | inferred   |

Other menu/flag endpoints:

| Method | Path                                                                     | Response                                             | Status | Confidence |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------------------- | ------ | ---------- |
| GET    | `v4/schools/{orgId}/parents/{parentId}/menu?studentId={studentId}`       | `[{ "type": "SCHEDULE" }, { "type": "ABSENCE" }, …]` | new    | confirmed  |
| GET    | `v1/schools/{orgId}/parameters/students/{studentId}/holistic-assessment` | `boolean`                                            | new    | confirmed  |

Menu `type` values seen: `SCHEDULE`, `ABSENCE`, `LUNCH`, `NEWS`, `STAFF_LIST`, `SUBJECT_ROOMS`, `HOLISTIC_ASSESSMENT`, `BOOKINGS`. This is the authoritative per-child feature list and could replace several individual parameter checks.

## 6. Student leave (Ledighetsansökan)

| Method | Path                                                                                | Body                                                           | Status | Confidence |
| ------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------ | ---------- |
| GET    | `v1/schools/{orgId}/parameters/student-leave`                                       | — → `boolean`                                                  | new    | confirmed  |
| GET    | `v1/schools/{orgId}/codevalues/student-leave-reasons?langId={langId}`               | — → `[{ "codeValueId": 1, "name": "…" }]`                      | new    | inferred   |
| GET    | `v1/schools/{orgId}/student/{studentId}/student-leave/days-info`                    | — → `{ "daysApproved": 0, "teacherBuffer": 0, "comment": "" }` | new    | inferred   |
| GET    | `v1/schools/{orgId}/student/{studentId}/student-leave`                              | — list                                                         | new    | inferred   |
| POST   | `v1/schools/{orgId}/student/{studentId}/student-leave`                              | create, see below                                              | new    | inferred   |
| GET    | `v1/schools/{orgId}/student/{studentId}/student-leave/{applicationId}`              | — detail                                                       | new    | inferred   |
| PUT    | `v1/schools/{orgId}/student/{studentId}/student-leave/confirm/{applicationId}`      | no body — guardian confirms (status 3 → 4)                     | new    | inferred   |
| DELETE | `v1/schools/{orgId}/student/{studentId}/student-leave/{applicationId}`              | no body — withdraw                                             | new    | inferred   |
| GET    | `v1/schools/{orgId}/student/{studentId}/student-leave/{applicationId}/history`      | —                                                              | new    | inferred   |
| PUT    | `v1/schools/{orgId}/student/{studentId}/student-leave/{applicationId}/history/read` | no body — clear unread status change                           | new    | inferred   |

Create body (posted once per selected sibling, `{studentId}` varies):

```json
{
  "fromDate": 1760306400000,
  "toDate": 1760565600000,
  "reason": 1,
  "description": "{free text}",
  "leisureSchool": false,
  "days": 4
}
```

`fromDate`/`toDate` are `Date.valueOf()` (epoch ms); `reason` is a `codeValueId`; `days` is the number of school days entered by the guardian. `leisureSchool` is only shown when the child has leave/pick-up (fritids) active.

List item: `{ id, applicant, fromDate, toDate, days, reason, status, read, updDate }`. Detail adds `applicantId`, `parentId`, `confirmUserId`, `studentComment`, `teacherComment`. History item: `{ id, studentLeaveId, status, updatedByName, upddate }`.

`status`: `1` submitted, `2` processing, `3` needs confirmation, `4` confirmed, `5` denied, `6` approved, `7` not approved, `8` deleted.

## 7. Leave/pick-up (fritids), preschool schedule, class list, blog

Brief — lower priority.

### Leave/pick-up and preschool schedule

| Method | Path                                                                            | Body                                                             | Status | Confidence |
| ------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ | ---------- |
| GET    | `v1/schools/{orgId}/parameters/students/{studentId}/leave-pickup`               | — → `boolean`                                                    | new    | confirmed  |
| GET    | `v1/schools/{orgId}/parameters/notifications-for-leavepickup`                   | — → `boolean`                                                    | new    | confirmed  |
| GET    | `v1/schools/{orgId}/parameters/321` / `…/327`                                   | — → `number` (TIME_CHANGE_BUFFER / WHOLE_DAY_TIME_CHANGE_BUFFER) | new    | inferred   |
| GET    | `v1/schools/{orgId}/parent/{parentId}/student-leave-pickup-active`              | — → siblings with fritids                                        | new    | inferred   |
| GET    | `v2/schools/{orgId}/student/{studentId}/preschoolschedule/startpage`            | —                                                                | new    | inferred   |
| GET    | `v2/schools/{orgId}/student/{studentId}/preschoolschedule/{date}`               | —                                                                | new    | inferred   |
| POST   | `v2/schools/{orgId}/student/{studentId}/preschoolschedule`                      | `{ date, startTime, endTime, absent, comment }`                  | new    | inferred   |
| POST   | `v2/schools/{orgId}/student/{studentId}/preschoolschedule/multi-update`         | `[{ date, startTime, endTime, comment, flaggedForRemoval }]`     | new    | inferred   |
| PUT    | `v2/schools/{orgId}/student/{studentId}/preschoolschedule/leave-pickup-comment` | `{ date, comment }`                                              | new    | inferred   |
| GET    | `v1/schools/{orgId}/student/{studentId}/preschoolschedule/{date}`               | — (absence-report variant)                                       | new    | inferred   |
| GET    | `v1/schools/{orgId}/student/{studentId}/preschoolschedule/absence/{date}`       | —                                                                | new    | inferred   |
| PUT    | `v1/schools/{orgId}/student/{studentId}/preschoolschedule/absence`              | `{ date, absent: boolean, parentId }`                            | new    | inferred   |
| PUT    | `v1/schools/{orgId}/student/{studentId}/preschoolschedule/comment`              | `{ date, comment, parentId }`                                    | new    | inferred   |

Day shape: `{ date, startTime, endTime, actualStartTime, actualEndTime, absent, active, parentComment, teacherComment }`. Times in write bodies are epoch ms. The format of `{date}` in GET paths is not confirmed (likely `yyyy-MM-dd` or epoch ms).

### Class list and contacts

| Method | Path                                                                                 | Response                                                              | Status | Confidence |
| ------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------ | ---------- |
| GET    | `v2/schools/{orgId}/parents/{parentId}/menu/class-list-active?studentId={studentId}` | `boolean`                                                             | new    | inferred   |
| GET    | `v1/schools/{orgId}/student/{studentId}/class-list`                                  | `[{ studentId, firstName, lastName }]`                                | new    | inferred   |
| GET    | `v1/student/{classmateStudentId}/parents`                                            | `[{ id, firstName, lastName, email, mobile, address, pocode, city }]` | new    | inferred   |

### Blog / activity log

| Method | Path                                                    | Response                                            | Status | Confidence |
| ------ | ------------------------------------------------------- | --------------------------------------------------- | ------ | ---------- |
| GET    | `v1/schools/{orgId}/parameters/blog`                    | `boolean`                                           | new    | confirmed  |
| GET    | `v1/schools/{orgId}/parent/{parentId}/blogposts/latest` | `{ blogpostId, title, description, date, imageId }` | new    | inferred   |

Full blog is a WebView: cookie bootstrap (section 5) then `jsp/student/right_parent_blogpost_app.jsp#list/{…}/view/{blogpostId}`. Images: `v1/resource/image/{imageId}`.

The `/history` and `/history/read` literals belong to student leave (section 6); there is no general history endpoint.

## 8. Other endpoints

| Method | Path                                                                                                   | Body / response                                                                   | Status         | Confidence |
| ------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------- | ---------- |
| GET    | `v1/parent`                                                                                            | current guardian                                                                  | implemented    | confirmed  |
| GET    | `v1/parent/{parentId}/children`                                                                        | children                                                                          | implemented    | confirmed  |
| GET    | `v1/parent/{parentId}/profile`                                                                         | profile                                                                           | implemented    | inferred   |
| PUT    | `v1/parent/{parentId}/profile/address`                                                                 | `{ address1, address2, poCode, city }`                                            | implemented    | inferred   |
| PUT    | `v1/parent/{parentId}/profile/contact`                                                                 | `{ email, mobile, homePhone, workPhone, contactInfo, orgId }`                     | implemented    | inferred   |
| PUT    | `v1/parent/{parentId}/profile/personal`                                                                | `{ fName, lName }`                                                                | new (see note) | inferred   |
| PUT    | `v1/parent/{parentId}/profile/notPublish`                                                              | `{ active: boolean }`                                                             | implemented    | inferred   |
| GET    | `v1/schools/{orgId}/parameters/parent/profile/allow-name-change`                                       | `boolean`                                                                         | implemented    | inferred   |
| GET    | `v1/schools/{orgId}/parameters/parent/profile/allow-address-and-po-code-change`                        | `boolean`                                                                         | implemented    | inferred   |
| GET    | `v1/schools/{orgId}/parameters/parent/profile/allow-email-change`                                      | `boolean`                                                                         | new            | inferred   |
| GET    | `v1/schools/{orgId}/parameters/parent/profile/allow-phone-number-change`                               | `boolean`                                                                         | new            | inferred   |
| GET    | `v1/schools/{orgId}/parameters/lunch-menu`                                                             | `boolean`                                                                         | new            | confirmed  |
| GET    | `v1/schools/{orgId}/lunchmenu/{week}`                                                                  | week menu                                                                         | implemented    | inferred   |
| GET    | `v1/schools/{orgId}/lunchmenu/week/{week}/day/{day}`                                                   | day menu                                                                          | implemented    | confirmed  |
| GET    | `v1/schools/{orgId}/student/{studentId}/lessons/week/{week}/day/{day}/{current\|next}?langId={langId}` | lesson tile                                                                       | implemented    | confirmed  |
| GET    | `v1/schools/{orgId}/staff?langId={langId}`                                                             | staff groups                                                                      | implemented    | inferred   |
| GET    | `v1/schools/{orgId}/staff/{teacherId}?langId={langId}`                                                 | staff detail                                                                      | implemented    | inferred   |
| GET    | `v1/schools/{orgId}/logo`                                                                              | image (school logo)                                                               | new            | confirmed  |
| GET    | `v1/resource/{filename}`                                                                               | image (avatars, `student123.jpg`, `teacher456.jpg`)                               | implemented    | confirmed  |
| GET    | `v1/resource/image/{fileId}`                                                                           | inline image; `fileId` parsed from `fileid=(\d+)&` in HTML `src`                  | new            | inferred   |
| GET    | `v1/resource/attachment/{fileId}`                                                                      | binary attachment (messages, news), Bearer auth                                   | new            | inferred   |
| POST   | `v1/parent/push-tokens`                                                                                | `{ "playerId": "{onesignal-uuid}" }`                                              | new            | confirmed  |
| GET    | `v1/push-tokens/{playerId}`                                                                            | `{ playerId, message, news, blog, assignments, results, leavepickup }` (booleans) | new            | confirmed  |
| PUT    | `v1/push-tokens`                                                                                       | same shape as GET — update notification prefs                                     | new            | inferred   |
| DELETE | `v1/parent/push-tokens/players/{playerId}`                                                             | no body                                                                           | new            | inferred   |
| GET    | `/{school}/eva-apps/auth/login/parent/code`                                                            | header `token`; returns a one-time code                                           | new            | inferred   |
| GET    | `/{school}/eva-apps/auth/login/parent/code/exchange?code=&orgId=&childId=&language=&redirectUrl=`      | opened in the system browser to deep-link into the web client                     | new            | inferred   |

Profile name: the app uses `PUT …/profile/personal` with `{ fName, lName }`. `schoolsoft.ts` currently calls `…/profile/name`, which does not occur anywhere in the app bundle — verify that it works or switch to `/profile/personal`.

Push tokens are OneSignal-specific and not useful for a web client, except that `GET`/`PUT v1/push-tokens/{playerId}` exposes the per-category notification preferences.
