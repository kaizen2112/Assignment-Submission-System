# Hands-on Walkthrough

A guided tour of every feature, in the order that makes sense. Follow it top to bottom and you will
have acted as all three roles, exercised all 8 business rules, and tried to break each one.

**Time:** about 45 minutes, plus one 3-minute wait in Part 6.

Every step has a **Do**, the exact **Paste** data where relevant, and an **Expect**. If an Expect
does not match, that is a real finding — note the step number.

---

## Contents

1. [Before you start](#0-before-you-start)
2. [Part 1 — Admin sets up a school](#part-1--admin-sets-up-a-school-ui)
3. [Part 2 — Teacher creates an assignment](#part-2--teacher-creates-an-assignment-ui)
4. [Part 3 — Student submits](#part-3--student-submits-ui)
5. [Part 4 — Teacher grades](#part-4--teacher-grades-ui)
6. [Part 5 — Try to break the rules](#part-5--try-to-break-the-rules)
7. [Part 6 — The deadline test](#part-6--the-deadline-test-needs-a-3-minute-wait)
8. [Part 7 — Cross-cutting behaviour](#part-7--cross-cutting-behaviour)
9. [Scorecard](#scorecard)
10. [Reset](#reset)

---

## 0. Before you start

### 0.1 Start the application

```bash
docker compose up --build
```

Wait until all three services report healthy. In a second terminal:

```bash
docker compose ps
```

- [ ] **Expect:** `db`, `api` and `web` all show `Up ... (healthy)`.

### 0.2 Open two browser tabs and keep both open

| Tab | URL | Used for |
|---|---|---|
| **A — the app** | http://localhost:3000 | Everything: Admin, Teacher and Student work |
| **B — Swagger** | http://localhost:5000/swagger | Rule probing in Parts 5 and 7 only |

> **You never need Swagger to run the application.** All three roles, administration included, have a
> full UI. Tab B exists in this walkthrough for one purpose: proving that a rule is enforced by the
> *server* and not merely hidden by the UI. That distinction is the whole point of Part 5 — a button
> the frontend declines to draw proves nothing on its own.

### 0.3 Sanity check

- [ ] Open http://localhost:5000/health → **Expect:** `{"status":"healthy","timestamp":"..."}`
- [ ] Open Tab A → **Expect:** it redirects to `/login` and shows a **Demo accounts** panel.
- [ ] Open Tab B → **Expect:** Swagger UI titled *Assignment & Submission Management System*, with an
      **Authorize** button near the top right. Leave it alone until Part 5.

### 0.4 The accounts that already exist

Seeded on first boot. Passwords are BCrypt-hashed at seed time.

| Role | Email | Password | Scope |
|---|---|---|---|
| Admin | `admin@school.com` | `Admin@123` | everything |
| Teacher | `teacher1@school.com` | `Teacher@123` | Mathematics + English in **Class 10 - A** |
| Teacher | `teacher2@school.com` | `Teacher@123` | Science in **Class 10 - B** |
| Student | `student1@school.com` | `Student@123` | enrolled in **Class 10 - A** |
| Student | `student2@school.com` | `Student@123` | enrolled in **Class 10 - A** |
| Student | `student3@school.com` | `Student@123` | enrolled in **Class 10 - B** |

Three assignments and three submissions are seeded too. You will use them in Part 5.

---

## Part 1 — Admin sets up a school (UI)

You will build a complete second school from nothing: a class, a subject, a teacher, a student, and
the two join rows that connect them. This proves the whole chain, because **a teacher with no
assignment cannot author anything and a student with no enrolment sees nothing.**

All of it happens in Tab A. **No GUIDs to copy and no Swagger** — every id the API needs is carried by
a dropdown.

### 1.1 Log in as Admin

- [ ] **Do:** In Tab A, sign in with `admin@school.com` / `Admin@123`.

**Expect:** you land on `/admin/dashboard`, greeted as **System Admin**, with six stat cards reading
**6 users, 2 teachers, 3 students, 2 classes, 3 assignments, 3 submissions**.

- [ ] The sidebar shows five entries: **Dashboard, Users, Classes, All assignments, All submissions**.
- [ ] Below the stats, a **Setting up** panel lists the three steps in dependency order. That order is
      not decoration — it is the order the business rules require, and Part 1 follows it.

> The **Assignments** card says *"Includes every teacher's drafts"*. Admin is the only role for which
> that is true; hold on to it for step 1.9.

### 1.2 See who already exists

- [ ] **Do:** Click **Users**.

**Expect:** a table of **6 users** — 1 Admin, 2 Teachers, 3 Students, each with a coloured role chip.

- [ ] Your own row (`admin@school.com`) is marked **(you)** and its **Delete** button is **disabled**.
      The API refuses self-deletion with a 409; the UI says so before the round trip rather than after.
- [ ] There is no password column, and no password anywhere in the response behind it. That is by
      construction — the response type has no such field to leak.
- [ ] **Do:** Set **Filter by role** to `Teacher`. → **Expect:** 2 rows. Set it back to **All roles**.
- [ ] **Do:** Type `nadia` into **Search** and press **Search**. → **Expect:** 1 row, matched
      case-insensitively on name. Click **Clear**.

### 1.3 Create a class

- [ ] **Do:** Click **Classes** → **New class**.
- [ ] **Fill in:** Name `Class 9 - A`, Code `9A` → **Create class**.

**Expect:** the form closes and `9A` appears in the table with **Subjects: None yet**.

**Now try a bad code.** **New class** again → Name `Anything`, Code `9 A!` → **Create class**.

- [ ] **Expect:** the form stays open and the Code field reads *"Code may contain only letters, digits
      and hyphens."* A code is a handle people type and compare, so allowing spaces and punctuation
      would let `10 A`, `10-A` and `10A` coexist as three classes nobody can tell apart.

**Now try a duplicate code.** Change Code to `9a` — lower case — and **Create class**.

- [ ] **Expect:** *"A class with code '9a' already exists."* Comparison is case-insensitive on the
      server, which is why `9a` collides with `9A`. Click **Cancel**.

### 1.4 Add a subject

- [ ] **Do:** On the `9A` row, click **Manage**.

**Expect:** a page headed **Class 9 - A** with the code `9A` badged top right, and three panels:
**Subjects**, **Teachers**, **Students**.

- [ ] The Teachers panel has **no assign form** — just *"Add a subject above before assigning a
      teacher."* A teacher grant is for a class **and a subject**, so there is nothing to grant yet.
- [ ] **Do:** In **Subjects**, type `Physics` into **Add a subject** → **Add subject**.
- [ ] **Expect:** a `Physics` chip appears, and the Teachers panel now shows its form.

**Now add it twice.** Type `physics` — lower case — → **Add subject**.

- [ ] **Expect:** *"'physics' is already a subject in this class."* Uniqueness is per class, backed by a
      unique index on `(ClassId, Name)`, so `Mathematics` may legitimately exist in both 10A and 10B.

### 1.5 Create a teacher and a student

- [ ] **Do:** **Users** → **New user**.
- [ ] **Fill in:** Full name `Rafiq Hasan`, Email `rafiq@school.com`, Role `Teacher`, Password
      `Physics2026` → **Create user**.

**Expect:** back to the users list, with Rafiq in it carrying a blue **Teacher** chip.

> The password field is deliberately **not masked**. An admin is typing a credential they then have to
> read out to someone else, and there is no self-service reset anywhere in the system to recover from a
> typo nobody could see.

**Two deliberate failures worth seeing.** **New user** again, and try each:

| Fill in | Expect |
|---|---|
| Password `physics` | *"Password must contain at least one letter and one digit."* — caught client-side, before any request. Also try `short`: *"at least 8 characters."* |
| Email `rafiq@school.com`, password `Physics2026` | `409` from the server — *"A user with this email already exists."* Email is the login identity. |

- [ ] **Do:** Now create the student. **New user** → Full name `Mina Chowdhury`, Email
      `mina@school.com`, Role `Student`, Password `Learn2026` → **Create user**.

### 1.6 Grant the teacher their class and subject

This is the row that **rule 4** checks on every create, edit, delete and grade.

- [ ] **Do:** **Classes** → **Manage** on `9A` → in the **Teachers** panel choose Teacher
      `Rafiq Hasan (rafiq@school.com)`, Subject `Physics` → **Assign teacher**.

**Expect:** a confirmation reading *"Rafiq Hasan now teaches Physics in Class 9 - A."*, and a row in the
roster table above it.

- [ ] The **Teacher** dropdown offers **only teachers**. There is no way to pick a student here — which
      is exactly why the server checks the role too. You will prove that server-side in **5.12**.
- [ ] **Do:** Submit the identical pair again.
- [ ] **Expect:** *"Rafiq Hasan is already assigned to Physics in 9A."* — a 409.

### 1.7 Enrol the student

This is the row that **rule 3** checks on every student read.

- [ ] **Do:** In the **Students** panel, choose `Mina Chowdhury (mina@school.com)` → **Enrol student**.

**Expect:** *"Mina Chowdhury is now enrolled in Class 9 - A."*, and Mina in the roster.

- [ ] **Do:** Enrol her again.
- [ ] **Expect:** *"Mina Chowdhury is already enrolled in 9A."* — no double enrolment, backed by a
      unique index on `(StudentId, ClassId)`.

> These two roster tables are worth pausing on. They are the only place in the system that shows the
> rows rules 3 and 4 are enforced against — so when you get to Part 5 and something is invisible or
> refused, this page is where you check **why**.

### 1.8 Reset a password

- [ ] **Do:** **Users** → search `mina` → **Edit**.

**Expect:** the form is pre-filled with Mina's name, email and role. **New password** is **blank**,
with the placeholder *"Leave blank to keep the current password"*.

- [ ] There is an info note: a role can only be changed while the user has no assignments or
      submissions on record. Mina has none yet, so hers could be changed right now — after Part 3 it
      could not, and the server would say so with a 409.
- [ ] **Do:** Leave everything alone and click **Save changes**. → **Expect:** saved, password
      untouched. A blank field is omitted from the request entirely, which is what "leave it alone"
      means on the wire.

### 1.9 Admin sees everything, and changes nothing

- [ ] **Do:** Click **All assignments**.

**Expect:** **3 rows**, including **`Photosynthesis Lab Report` badged `Draft`**. No student will ever
see that one. This screen is the only place in the entire API where another teacher's draft is visible.

- [ ] **Do:** Set **Filter by status** to `Draft`. → **Expect:** 1 row. Set **Filter by class** to
      `10B — Class 10 - B`. → **Expect:** still the lab report; it belongs to 10B.
- [ ] There are **no Edit or Delete buttons** on this page, and none on **All submissions** either.
      That is not an omission: editing an assignment and awarding marks are teacher actions gated by
      rule 4, and an admin holds no teaching scope, so the API would refuse. A row of buttons that
      always 403 would be worse than no buttons.
- [ ] **Do:** Click **All submissions**. → **Expect:** **3 rows**, newest first, with mixed statuses and
      marks like `45 / 100` where graded and an em dash where not.

### 1.10 Deletion is refused when it would destroy records

- [ ] **Do:** **Users** → search `teacher1@school.com` → **Delete** → confirm.

**Expect:** a red banner — *"This user has assignments or submissions on record and cannot be
deleted."* `teacher1` authored assignments, so deleting them would erase student marks. The database
enforces this with `RESTRICT` on the foreign key; the service asks first only so the answer is a 409
that explains itself instead of a 500.

- [ ] **Do:** Now delete a user with no records. **New user** → `Throwaway`, `bin@school.com`, Student,
      `Delete2026` → **Create user**. Then search `bin@school.com` → **Delete** → confirm.
- [ ] **Expect:** the row disappears. Deletion works; it is refused only when it would destroy
      coursework.

> Note what is **not** on these screens: there is no way to delete a class, a subject, a teacher grant
> or an enrolment. The API has no endpoint for any of them, because each would either orphan or
> cascade-destroy student work — the same reasoning as **A5**, one level up. It is listed under Known
> Limitations in the README rather than papered over with a button that fails.

---

## Part 2 — Teacher creates an assignment (UI)

Now sign out and work as the teacher you just created. **This is the important part of Part 1
paying off:** Rafiq has exactly one class + subject pair, and the UI will offer him only that.

### 2.1 Log in

- [ ] **Do:** Tab A → http://localhost:3000/login → email `rafiq@school.com`, password
      `Physics2026` → **Sign in**.

**Expect:**

- [ ] You land on **`/teacher/dashboard`**.
- [ ] The heading reads **"Welcome back, Rafiq Hasan"**.
- [ ] Four stat cards. All counts are **0** — he is brand new.
- [ ] The sidebar shows **Dashboard** and **Assignments** only. No admin links.

### 2.2 Client-side validation runs before the API is touched

- [ ] **Do:** Go to **Assignments** → **New assignment**. Click **Save as draft** with the form empty.

**Expect:** inline field errors appear immediately, and **no network request is made** (open DevTools
→ Network if you want to confirm). Validation is duplicated on purpose: the client for speed, the
server because the client cannot be trusted.

### 2.3 The class + subject dropdown is scoped to this teacher

- [ ] **Do:** Open the **Class and subject** dropdown.

**Expect:** exactly one option — **`Class 9 - A (9A) — Physics`** — plus the "Choose…" placeholder.
The hint underneath reads *"Only the classes and subjects you are assigned to."*

> This list comes from `GET /api/v1/assignments/teaching-scope`. Without it a teacher would have to
> know their own class and subject GUIDs to create anything.

### 2.4 Create it as a draft

- [ ] **Do:** Fill the form:

| Field | Value |
|---|---|
| Class and subject | `Class 9 - A (9A) — Physics` |
| **Title** | `Newton's Laws Worksheet` |
| **Description** | paste the block below |
| **Deadline** | `15/09/2026, 23:59` (any date at least a few days out) |
| **Max marks** | `25` |
| Allow late submissions | leave **unchecked** |

```
Answer all three questions. Show your working.

1. State Newton's three laws in your own words.
2. A 5 kg box is pushed with 20 N of force across a frictionless floor. What is its acceleration?
3. Explain why a passenger lurches forward when a bus brakes suddenly.
```

- [ ] **Expect:** a live character counter under Description.
- [ ] **Do:** Click **Save as draft**.

**Expect:**

- [ ] You are returned to the assignments list.
- [ ] One row: `Newton's Laws Worksheet`, `Class 9 - A`, `Physics`, deadline, and a **`Draft`** badge.
- [ ] Row actions are **Edit**, **Publish**, **Delete** — there is **no Submissions link**, because a
      draft cannot have any.

### 2.5 Edit it

- [ ] **Do:** Click **Edit**. Change **Max marks** to `30`. Save.
- [ ] **Expect:** the list shows the change. Note that **Class and subject are not editable** on this
      form (A12) — moving an assignment would re-scope it under students who may already have
      submitted.

### 2.6 Publish it

- [ ] **Do:** Click **Publish** on the row.

**Expect:**

- [ ] The badge changes from **`Draft`** to **`Published`**.
- [ ] A **Submissions** link now appears in the row.
- [ ] The badges are colour-coded — `Draft`, `Published`, `Open` and `Overdue` are four visually
      distinct colours, not four grey pills.

### 2.7 The status filter

- [ ] **Do:** Set the status filter to **Draft**.
- [ ] **Expect:** empty state with a helpful message, not a blank page or a spinner that never stops.
- [ ] **Do:** Set it back to **Published** and then to **All**.

---

## Part 3 — Student submits (UI)

Use a **different browser profile, a private window, or log out first** — you want a genuinely
separate session, not a mutated one.

### 3.1 Log in as the new student

- [ ] **Do:** Sign in as `mina@school.com` / `Learn2026`.

**Expect:**

- [ ] You land on **`/student/dashboard`**, heading **"Welcome back, Mina Chowdhury"**.
- [ ] The sidebar shows **Dashboard**, **Assignments**, **My submissions**.

### 3.2 See the assignment

- [ ] **Do:** Click **Assignments**.

**Expect:**

- [ ] One row: `Newton's Laws Worksheet`, `Class 9 - A`, `Physics`.
- [ ] A **deadline countdown** in words — e.g. *"in about 1 month"* — not a raw timestamp.
- [ ] Status shows **`Open`**.
- [ ] Max marks shows **30** (your edit from 2.5 is visible to the student).

### 3.3 Open it

- [ ] **Do:** Click **Open**.

**Expect:** the full description including all three numbered questions, the deadline, max marks, and
a submission form below with a **Your answer** textarea and a **Submit answer** button.

### 3.4 Validation before submitting

- [ ] **Do:** Click **Submit answer** with the textarea empty.
- [ ] **Expect:** *"Write your answer before submitting."* No request sent.
- [ ] **Do:** Type three spaces and submit.
- [ ] **Expect:** the same refusal — whitespace is not an answer. The server's `NotEmpty()` agrees,
      but the client stops it first.

### 3.5 Submit

- [ ] **Paste** into **Your answer**:

```
1. First law: an object keeps doing what it is doing unless a force acts on it. Second law: force
equals mass times acceleration. Third law: every action has an equal and opposite reaction.

2. a = F / m = 20 N / 5 kg = 4 m/s^2.

3. The passenger keeps moving forward at the bus's original speed because no force acts to stop
them, until the seat belt or the seat in front provides one. That is the first law.
```

- [ ] **Do:** Click **Submit answer**.

**Expect:**

- [ ] A **`Submitted`** badge appears.
- [ ] The button changes to **Update answer**.
- [ ] A note explains you can keep editing until the deadline.

### 3.6 Update it

- [ ] **Do:** Append this line to your answer and click **Update answer**:

```
Correction to Q2: the units are m/s squared, and friction is ignored as stated.
```

- [ ] **Expect:** the update is accepted, and the page now shows an **edited** timestamp alongside the
      original submission time.

### 3.7 My submissions

- [ ] **Do:** Click **My submissions**.

**Expect:**

- [ ] One row for `Newton's Laws Worksheet`, status **`Submitted`**.
- [ ] The marks column shows an **em dash (—)**, not `0` — nothing has been graded, and `0` would be a
      lie.
- [ ] No feedback column content yet.

---

## Part 4 — Teacher grades (UI)

Switch back to the Rafiq session.

### 4.1 Find the submission

- [ ] **Do:** **Assignments** → **Submissions** on the `Newton's Laws Worksheet` row.

**Expect:**

- [ ] One row: **Mina Chowdhury**, submitted-at timestamp, status **`Submitted`**, marks **—**.
- [ ] A **Grade** link.

### 4.2 The grading screen

- [ ] **Do:** Click **Grade**.

**Expect:**

- [ ] The student's full answer is displayed, **including your 3.6 correction** — the teacher grades
      the latest version.
- [ ] A **Marks (out of 30)** input — the label carries this assignment's own maximum.
- [ ] A **Feedback** textarea and a **Save grade** button.

### 4.3 Marks are bounded — client side

- [ ] **Do:** Type `31` into Marks and click into the Feedback box.
- [ ] **Expect:** *"Marks cannot exceed the maximum of 30."* The form will not submit.
- [ ] **Do:** Try `-1`.
- [ ] **Expect:** refused as well. `0` **is** valid — zero is a legitimate mark.

### 4.4 Grade it

- [ ] **Do:** Marks `26`. **Paste** into Feedback:

```
Strong on the first and third laws, and the worked calculation in Q2 is correct with units. For Q3,
say explicitly which body the force acts on. Well organised.
```

- [ ] **Do:** Click **Save grade**.

**Expect:**

- [ ] You return to the submissions list.
- [ ] The row now reads **`26 / 30`** and status **`Graded`**.
- [ ] The action link changes from **Grade** to **Review**.

### 4.5 The teacher can correct a mark

- [ ] **Do:** Click **Review**.
- [ ] **Expect:** the form is pre-filled with `26` and your feedback, and the button now says **Update
      grade** rather than *Save grade*. `Graded → Graded` is an allowed transition precisely so a
      mistyped mark can be fixed.
- [ ] **Do:** Leave it as is and go back.

### 4.6 The student sees the result

Switch to Mina's session.

- [ ] **Do:** Reload **My submissions**.

**Expect:**

- [ ] Status **`Graded`**, marks **`26 / 30`**, and your feedback text visible in the row.
- [ ] **Do:** Click **View** to open the assignment.
- [ ] **Expect:** a **Your grade** panel showing `26 / 30`, the graded-at time, and the full feedback.
- [ ] **Expect:** the **Update answer button is gone**, replaced by a message that the submission has
      been graded and can no longer be changed.
- [ ] **Do:** Check the dashboard — the **Graded** stat should now be **1**.

That is the full cycle. Everything from here is about trying to break it.

---

## Part 5 — Try to break the rules

This is the part worth your attention. Each check should be **refused**, and the *way* it is refused
matters as much as the fact.

Use the seeded accounts here — they are arranged for exactly these tests.

### 5.1 Wrong-role routes in the UI (rule 7)

Stay logged in as **Mina (Student)**. Type each URL directly into the address bar:

| Visit | Expect |
|---|---|
| `/teacher/dashboard` | bounced to `/student/dashboard` |
| `/teacher/assignments` | bounced to `/student/dashboard` |
| `/admin/dashboard` | bounced to `/student/dashboard` |

- [ ] All three redirect.

Now log in as **Rafiq (Teacher)** and try `/admin/dashboard` and `/student/assignments`.

- [ ] Both bounce to `/teacher/dashboard`.

> The redirect is **convenience, not security**. The next check is the security.

### 5.2 Role guards on the API (rule 7)

- [ ] **Do:** In Tab B, log in as `student1@school.com` / `Student@123` (step 1.1 with different
      values) and re-**Authorize** with that token.
- [ ] **Do:** Call **`POST /api/v1/assignments`** with any body at all — even `{}`.

**Expect:** **`403 Forbidden`**.

- [ ] Confirm it is **403, not 200 with an empty list**, and not 400. The role guard runs *before*
      model binding, which is why a completely empty body still gives 403 rather than a validation
      error.

- [ ] **Do:** Call **`GET /api/v1/admin/users`** with the same student token.
- [ ] **Expect:** `403`.
- [ ] **Do:** Click **Authorize → Logout** in Swagger, then call `GET /api/v1/admin/users` again.
- [ ] **Expect:** `401 Unauthorized` — a different code, because "who are you" and "you may not" are
      different failures.

### 5.3 Drafts are invisible to students (rule 6)

The seeded `Photosynthesis Lab Report` is a **Draft** in **Class 10 - B**, and `student3` is enrolled
in Class 10 - B. So this isolates rule 6 from rule 3.

- [ ] **Do:** As Admin in Swagger, `GET /api/v1/admin/assignments` and 📋 copy the **id** of
      `Photosynthesis Lab Report`.
- [ ] **Do:** Log in as `student3@school.com` / `Student@123`, Authorize with that token.
- [ ] **Do:** `GET /api/v1/assignments` (page 1, pageSize 20).

**Expect:** the draft is **absent** from the list, even though student3 is in that very class.

- [ ] **Do:** `GET /api/v1/assignments/{id}` with the draft's id.

**Expect:** **`404 Not Found`** — *not* 403.

> This is assumption **A7** and it is deliberate. A 403 would confirm the assignment exists. A 404
> reveals nothing. Same reasoning as a login form that says "email or password is incorrect" rather
> than which one was wrong.

### 5.4 Students are scoped to their own class (rule 3)

Still as **student3** (Class 10 - B):

- [ ] **Do:** As Admin, 📋 copy the id of `Algebra Problem Set 1` (Class 10 - A, Published).
- [ ] **Do:** As student3, `GET /api/v1/assignments/{that id}`.
- [ ] **Expect:** `404`. Published, but not their class.
- [ ] **Do:** `GET /api/v1/assignments/{that id}/submissions/mine`.
- [ ] **Expect:** `404`.

### 5.5 Teachers are scoped to their own work (rule 4, A13)

- [ ] **Do:** Log in as `teacher2@school.com` / `Teacher@123` (Science, Class 10 - B) and Authorize.
- [ ] **Do:** `GET /api/v1/assignments/{Algebra Problem Set 1 id}` — that is **teacher1's** assignment
      in a class teacher2 does not teach.
- [ ] **Expect:** **`404`**. Reading a colleague's assignment reports it as absent, so the detail view
      and the list view never disagree about what exists.
- [ ] **Do:** `PUT /api/v1/assignments/{same id}` with a valid-looking body.
- [ ] **Expect:** **`403 Forbidden`** — *not* 404.
- [ ] **Do:** `DELETE /api/v1/assignments/{same id}` and
      `PATCH /api/v1/assignments/{same id}/publish`.
- [ ] **Expect:** `403` for both. All three mutations share one gate, so they cannot drift apart.

> **Read gives 404, mutation gives 403 — worth pausing on.** Reading is scoped: as far as a teacher's
> read view is concerned, a colleague's assignment does not exist, and saying 404 keeps that
> consistent. Mutation checks *existence first*, so 404 is reserved for a genuine typo in the id, and
> 403 means "this exists and is not yours". Both refuse; they just answer different questions. Try a
> `PUT` against a made-up GUID and you will get `404` from the same endpoint that just gave you 403.

Now try to create outside your scope:

- [ ] **Do:** As teacher2, `POST /api/v1/assignments` using **your CLASS_ID and SUBJECT_ID from Part
      1** (Class 9 - A / Physics — Rafiq's pair, not teacher2's):

```json
{
  "title": "Not My Class",
  "description": "This should be refused because teacher2 does not teach Physics in Class 9 - A.",
  "deadline": "2026-10-01T23:59:00Z",
  "maxMarks": 10,
  "classId": "CLASS_ID",
  "subjectId": "SUBJECT_ID"
}
```

- [ ] **Expect:** **`403 Forbidden`** — you are not assigned to this class and subject.

> `403` here rather than 404, because you named the class and subject yourself — nothing is being
> revealed that you did not already supply.

### 5.6 Marks are bounded on the server too (rule 5)

Part 4.3 showed the browser refusing. Now bypass the browser entirely.

- [ ] **Do:** Log in as `rafiq@school.com` / `Physics2026`, Authorize.
- [ ] **Do:** `GET /api/v1/assignments` and 📋 copy your `Newton's Laws Worksheet` id, then
      `GET /api/v1/assignments/{id}/submissions` and 📋 copy Mina's **submission id**.
- [ ] **Do:** `PATCH /api/v1/assignments/{assignmentId}/submissions/{submissionId}/grade`:

```json
{ "marks": 500, "feedback": "Bypassing the UI." }
```

- [ ] **Expect:** **`400`**, message naming the maximum of **30**.
- [ ] **Do:** Try `{ "marks": -5 }`.
- [ ] **Expect:** `400`.
- [ ] **Do:** Try `{ "marks": 30 }` — exactly the maximum.
- [ ] **Expect:** `200`. The boundary is inclusive.
- [ ] **Do:** Set it back to `26` with your original feedback.

### 5.7 A graded submission cannot be un-graded (rule 8)

- [ ] **Do:** Still as Rafiq,
      `PATCH /api/v1/assignments/{assignmentId}/submissions/{submissionId}/status`:

```json
{ "status": "Submitted" }
```

- [ ] **Expect:** `400` — *"A graded submission cannot be un-graded."*
- [ ] **Do:** Try `{ "status": "NotSubmitted" }`.
- [ ] **Expect:** `400`, the **same** message. `Graded` is a terminal state for every backward
      transition, and the error names the reason rather than reciting the state pair.
- [ ] **Do:** Try `{ "status": "Banana" }`.
- [ ] **Expect:** `400` — *"'Banana' is not a valid submission status."* Note what it is **not**: a
      .NET binder error naming an enum type. The field is bound as a string on purpose so the message
      stays about the domain.

### 5.8 A graded answer is locked to the student (rule 2, A1)

- [ ] **Do:** Log in as `mina@school.com` / `Learn2026`, Authorize.
- [ ] **Do:** `PUT /api/v1/assignments/{assignmentId}/submissions/mine`:

```json
{ "answerText": "Changing my answer after seeing the mark." }
```

- [ ] **Expect:** refused — cannot update a graded submission. The UI already hid the button; this
      confirms the server does not rely on that.

### 5.9 One submission per student (A4)

- [ ] **Do:** Still as Mina, `POST /api/v1/assignments/{assignmentId}/submissions`:

```json
{ "answerText": "A second, competing submission for the same assignment." }
```

- [ ] **Expect:** `409 Conflict` — she already has one. Backed by a unique index on
      `(AssignmentId, StudentId)`, so it holds even if a service check were bypassed.

### 5.10 The overdue assignment refuses late work (rule 1)

The seeded `Algebra Problem Set 1` is **Published, overdue, and does not allow late submission**.

- [ ] **Do:** Log in as `student2@school.com` / `Student@123` (Class 10 - A), Authorize.
- [ ] **Do:** `GET /api/v1/assignments/{algebra id}/submissions/mine` first.
  - If this returns **404**, student2 has not submitted — continue.
  - If it returns **200**, she already has a submission; use `student1@school.com` instead, or skip to
    Part 6 which tests this cleanly on your own assignment.
- [ ] **Do:** `POST /api/v1/assignments/{algebra id}/submissions`:

```json
{ "answerText": "Submitting this well after the deadline." }
```

- [ ] **Expect:** refused — the submission deadline has passed.

### 5.11 A deadline cannot be back-dated (A11)

- [ ] **Do:** As Rafiq, `PUT /api/v1/assignments/{your assignment id}`:

```json
{
  "title": "Newton's Laws Worksheet",
  "description": "Trying to move the deadline into the past.",
  "deadline": "2020-01-01T00:00:00Z",
  "maxMarks": 30,
  "allowLateSubmission": false
}
```

- [ ] **Expect:** `400` — a new deadline must be in the future. Back-dating would retroactively lock
      out students who still had time to submit.
- [ ] **Do:** Now `PUT` the **same** deadline it already has, changing only the title.
- [ ] **Expect:** `200`. An **unchanged** deadline is allowed even once it has passed — that is what
      lets a teacher fix a typo in last week's homework.

### 5.12 The admin UI's dropdowns are not the guard

Back in **1.6** the Teacher dropdown offered only teachers, so there was no way to grant a *student*
teaching authority from the UI. That is convenience. Here is the actual protection.

- [ ] **Do:** In Tab B, log in as `admin@school.com` / `Admin@123` and **Authorize** with that token.
- [ ] **Do:** `GET /api/v1/admin/classes` and find your `9A` class. Note its `id` and the `id` of its
      `Physics` subject from the nested `subjects` array.
- [ ] **Do:** `GET /api/v1/admin/users?role=Student` and note **Mina Chowdhury's** `id`.
- [ ] **Do:** `POST /api/v1/admin/teacher-assignments` with Mina's id in the **teacher** slot:

```json
{ "teacherId": "MINA_ID", "subjectId": "PHYSICS_ID", "classId": "CLASS_9A_ID" }
```

- [ ] **Expect:** **`400`** — *"Mina Chowdhury is a Student, not a Teacher."*

This matters more than it looks. A student sitting in `teacher_assignments` would satisfy rule 4's
lookup and gain authority to author and grade in that class. The dropdown that never offered her is
the second line of defence, not the first.

- [ ] **Do:** One more. Try the same call with a **valid teacher** but a `subjectId` from a *different*
      class than `classId`.
- [ ] **Expect:** `400` — *"The subject does not belong to the specified class."* `TeacherAssignment`
      stores `ClassId` as well as `SubjectId` so rule 4 resolves in one indexed lookup; that
      denormalisation is only safe while the two agree, which is what this check guarantees.

- [ ] **Do:** Finally, prove the roster reads are Admin-only. **Authorize** with a **teacher** token
      (`teacher1@school.com` / `Teacher@123`) and call
      `GET /api/v1/admin/classes/{9A id}/teachers`.
- [ ] **Expect:** **`403`** — not an empty list. Same for `.../students`, and for every other `/admin`
      path: the `[Authorize(Roles = "Admin")]` attribute sits on the controller class, so an endpoint
      added later is Admin-only by default rather than open until someone remembers the attribute.

---

## Part 6 — The deadline test (needs a 3-minute wait)

This is the one case seeded data cannot show you: a **successful late submission**, and the
read-only-immediately behaviour that follows it. You cannot create an already-overdue assignment
(5.11 explains why), so you will create one that expires while you watch.

### 6.1 Create a near-instant deadline

- [ ] **Do:** As **Rafiq** in the UI, **New assignment**:

| Field | Value |
|---|---|
| Class and subject | `Class 9 - A (9A) — Physics` |
| Title | `Late Window Test` |
| Description | `A deliberately short deadline, used to observe late-submission behaviour.` |
| **Deadline** | **today's date, 3 minutes from now** |
| Max marks | `10` |
| **Allow late submissions** | ✅ **check this** |

- [ ] **Do:** **Save and publish**.
- [ ] **Expect:** one action, one row, badge **`Published`** — create-then-publish in a single click.

### 6.2 Watch it go overdue

- [ ] **Do:** As **Mina**, go to **Assignments**.
- [ ] **Expect:** `Late Window Test` with a countdown like *"in 3 minutes"* and status **`Open`**.
- [ ] **Do:** Wait out the deadline, then reload.
- [ ] **Expect:** status flips to **`Overdue`**, in a visibly different colour.

### 6.3 Submit late

- [ ] **Do:** Click **Open**.
- [ ] **Expect:** the form is **still available**, with a clear warning that the deadline has passed
      and the submission will be marked late.
- [ ] **Paste** and submit:

```
Submitted after the deadline, on purpose, to see how the system records it.
```

**Expect:**

- [ ] Accepted, with a **`Late`** badge — not `Submitted`.
- [ ] **There is no Update answer button.** A message explains the submission cannot be changed.

> This is the subtlety worth understanding. **`AllowLateSubmission` permits a late *delivery*, not an
> open editing window.** Rule 1 let it in; rule 2 locked it instantly, because rule 2 has no
> late-submission exception. It is read-only from the moment it exists.

- [ ] **Do:** Confirm from the API as Mina:
      `PUT /api/v1/assignments/{Late Window Test id}/submissions/mine` with any answer.
- [ ] **Expect:** refused — cannot update after the deadline.

### 6.4 A late submission still grades normally

- [ ] **Do:** As Rafiq, grade it `7` with any feedback.
- [ ] **Expect:** `7 / 10`, status **`Graded`**. `Late → Graded` is a valid transition.
- [ ] **Do:** As Mina, check **My submissions**.
- [ ] **Expect:** the row shows `Graded` and `7 / 10`.

### 6.5 An assignment with submissions cannot be deleted (A5)

- [ ] **Do:** As Rafiq, try **Delete** on the `Late Window Test` row. Confirm the dialog.
- [ ] **Expect:** refused with a conflict message — deleting it would destroy graded student work.
- [ ] **Do:** Create a throwaway draft, then Delete it.
- [ ] **Expect:** deleted without complaint. A draft has no submissions by definition.

---

## Part 7 — Cross-cutting behaviour

### 7.1 Pagination

Seed data is small, so create some volume first — or just check the mechanics on the admin user list.

- [ ] **Do:** `GET /api/v1/admin/users?page=1&pageSize=2` (re-authorize as Admin first).
- [ ] **Expect:** `items` has **2** entries, `totalCount` **8** — the 6 seeded users plus Rafiq and
      Mina — and `totalPages` **4**.
- [ ] **Do:** `page=2`.
- [ ] **Expect:** two **different** users — no repeats from page 1. Every list is ordered by a stable
      tie-breaker, so a row cannot appear on two pages or be skipped.
- [ ] **Do:** `pageSize=500`.
- [ ] **Expect:** **`400`**, naming the maximum of 100.

> **Rejected, not clamped** — on purpose. Silently returning 100 rows to a caller who asked for 500
> means it believes it has the whole set when it does not.

- [ ] **Do:** In the UI, check any list page's pagination controls with only one page of data.
- [ ] **Expect:** the controls render nothing at all, rather than a disabled "1 of 1".

### 7.2 Error shape is consistent

- [ ] **Do:** `POST /api/v1/auth/login` with `{ "email": "nope", "password": "x" }`.
- [ ] **Expect:** `400` with field-level validation errors.
- [ ] **Do:** `POST /api/v1/auth/login` with a valid-format but wrong password for a real user.
- [ ] **Expect:** `401` with a **generic** message — it does not say whether the email exists.
- [ ] **Do:** Send deliberately malformed JSON, e.g. `{ "email": }`.
- [ ] **Expect:** a clean `400`. It must **not** leak parser internals like `LineNumber` or
      `BytePositionInLine`.

### 7.3 Token lifecycle

- [ ] **Do:** From a login response, 📋 copy the **`refreshToken`**.
- [ ] **Do:** `POST /api/v1/auth/refresh` with `{ "refreshToken": "..." }`.
- [ ] **Expect:** `200` with a **new** access token **and a new refresh token**.
- [ ] **Do:** Call refresh **again with the same old token**.
- [ ] **Expect:** refused. Refresh tokens are single-use and rotated, so a stolen one is useless once
      the real user has refreshed.
- [ ] **Do:** `POST /api/v1/auth/logout` with the newest refresh token, then try to refresh with it.
- [ ] **Expect:** refused — logout revokes it server-side, not just in the browser.

### 7.4 The UI survives an expired token

- [ ] **Do:** In the app, open DevTools → Application → Local Storage and delete `accessToken`, then
      navigate to another page.
- [ ] **Expect:** you are returned to `/login` rather than shown a broken page or an error dialog.

### 7.5 The API being down is reported honestly

- [ ] **Do:** `docker compose stop api`. Reload the app and try to log in.
- [ ] **Expect:** a readable message naming the cause — *"Could not reach the API. Check that the
      backend is running on ..."* — not a silent spinner.
- [ ] **Do:** `docker compose start api`, wait for healthy, reload.
- [ ] **Expect:** everything works again.

---

## Scorecard

Tick these off. Every row should be a **refusal or a correct result**, never a crash, a blank screen,
or a success where you expected a block.

### The 8 business rules

| Rule | Checked in | Expected |
|---|---|---|
| 1 — no submission after deadline | 5.10, 6.3 | refused when late not allowed; accepted as **`Late`** when it is |
| 2 — no update after deadline or grading | 5.8, 6.3 | refused in both cases, with no late-submission exception |
| 3 — students see only their own data, in their class | 5.4 | `404` for another class's assignment and another student's work |
| 4 — teacher scoped to assigned class + subject | 5.5 | `404` **reading** another teacher's work; `403` **mutating** it or creating outside own scope |
| 5 — marks within `0…MaxMarks` | 4.3, 5.6 | blocked in the browser **and** `400` from the API; `0` and `MaxMarks` both valid |
| 6 — drafts invisible to students | 5.3 | absent from the list, `404` by id |
| 7 — role guards return 403 | 5.2 | `403` for wrong role, `401` for no token, never an empty `200` |
| 8 — valid status transitions only | 5.7 | cannot un-grade, cannot go backwards, unknown status gives a helpful `400` |

### The assumptions

| # | Checked in | Expected |
|---|---|---|
| A1 grading locks the submission | 4.6, 5.8 | update button gone, API refuses |
| A3 text-only answers | 3.3 | textarea only, no file input anywhere |
| A4 one submission per student | 5.9 | `409` on a second submission |
| A5 no deleting an assignment with submissions | 6.5 | conflict; drafts delete freely |
| A6 admin does not create or grade | 1.9 | no admin endpoint does either, and the oversight screens have no action buttons |
| A7 404 not 403 for hidden resources | 5.3, 5.4 | `404` throughout |
| A8 assignments start as Draft | 2.4 | `Draft` badge on create |
| A9 deleting a user with records refused | 1.10 | `409`; a clean user deletes with `204` |
| A11 deadlines cannot be back-dated | 5.11 | `400`; unchanged past deadline still allowed |
| A12 class and subject immutable | 2.5 | fields absent from the edit form |
| A13 teacher sees only own assignments | 5.5 | `404` for a colleague's |
| Admin endpoints are Admin-only | 5.12 | `403` for a teacher token, including the roster reads |

### Things that should feel right

- [ ] Every list page shows a **loading skeleton**, then either data or a helpful empty state — never
      a spinner that never resolves.
- [ ] Status badges are **colour-coded** and consistent between teacher and student views.
- [ ] Forms validate **before** any network request.
- [ ] Deadlines display in **your local time**, and the countdown is in words.
- [ ] Ungraded marks show **—**, never `0`.
- [ ] The browser console stays clean. *One exception:* a `404` on
      `.../submissions/mine` is normal and expected — that is how "you have not submitted yet" is
      represented, and the browser logs every failed response whether or not the app treats it as an
      error.

---

## Reset

Back to a clean seeded database:

```bash
docker compose down -v
docker compose up --build
```

- [ ] **Expect:** exactly **6 users, 2 classes, 3 subjects, 3 assignments, 3 submissions**. Everything
      you created in this walkthrough is gone: Class 9 - A, Physics, Rafiq and Mina no longer exist.
      Confirm it on the admin dashboard's stat cards, which read those six numbers directly.

To stop without losing your work, use `docker compose down` (no `-v`) — the database volume survives
and everything is exactly where you left it when you next `up`.

---

## If you want to read the code next

| You just tested | It lives in |
|---|---|
| Rules 1, 2, 5, 8 | `Backend/src/Application/Services/SubmissionService.cs` |
| Rules 3, 4, 6 | `Backend/src/Application/Services/AssignmentService.cs` |
| Rule 7 | `[Authorize(Roles = …)]` on the controllers, verified by `tests/UnitTests/Authorization/RoleGuardTests.cs` |
| Rule 8's state machine | the `ValidTransitions` dictionary in `SubmissionService.cs` |
| The 5-state submission form | `Frontend/src/components/student/SubmissionForm.tsx` — `resolveMode` |
| The admin screens | `Frontend/src/app/admin/` and `Frontend/src/components/admin/`; every call in `Frontend/src/lib/admin.ts` |
| The class rosters | `AdminService.GetClassTeachersAsync` / `GetClassStudentsAsync` |
| Why 404 and not 403 | assumption A7 in `README.md` |

And `dotnet test` from the `Backend` directory runs the 85 unit tests covering all of the above in
about a second.
