# Assignment & Submission Management System

## Overview

## Features

## Tech Stack

## Architecture

## Prerequisites

## Getting Started

### Run with Docker

### Run Locally

## Environment Variables

## Demo Credentials

Seeded automatically on first startup in the `Development` environment. The seeder is idempotent,
so restarting the app will not duplicate or reset this data.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.com` | `Admin@123` |
| Teacher | `teacher1@school.com` | `Teacher@123` |
| Teacher | `teacher2@school.com` | `Teacher@123` |
| Student | `student1@school.com` | `Student@123` |
| Student | `student2@school.com` | `Student@123` |
| Student | `student3@school.com` | `Student@123` |

Passwords are hashed with BCrypt at seed time — no plaintext password is ever stored.

The sample data is arranged so the role-scoping rules can be checked by hand:

- `teacher1` teaches Mathematics and English in **Class 10 - A**; `teacher2` teaches Science in
  **Class 10 - B**. `teacher2` reaching a Class 10 - A assignment must be refused.
- `student1` and `student2` are enrolled in **Class 10 - A**; `student3` in **Class 10 - B**, so
  Class 10 - A's assignments must be invisible to `student3`.
- Of the three assignments, two are **Published** and one is a **Draft** that no student should
  ever see. One published assignment's deadline has already passed with late submission refused;
  the other is still open and accepts late submissions.
- Of the three submissions, two are **graded with marks and feedback** and one is **pending**, so
  a teacher's grading queue is not empty on first login.

## API Reference

## Business Rules

## Testing

## Assumptions

The brief left these open. Each was resolved in the direction that keeps the system's guarantees
strict rather than convenient.

- **Submissions are text-only.** No file uploads. `Submission.AnswerText` holds the answer, capped
  at 5000 characters. Keeps the scope deliverable without weakening any of the graded rules.
- **Grading locks a submission against further student edits.** Once marks are assigned, the
  student cannot revise the answer — otherwise a mark could be attached to work that later changed.
- **Late submission is a per-assignment flag, defaulting to off.** `Assignment.AllowLateSubmission`
  is opt-in per assignment rather than a global setting, so one lenient assignment cannot loosen
  the deadline rule for every other one.
- **An assignment is always created as a `Draft`.** Publishing is a separate, explicitly authorized
  transition, so a draft cannot become student-visible by accident.
- **Deleting a user who has academic records is refused, not cascaded.** Removing a teacher who
  authored assignments, or a student who submitted work, would erase marks; the database rejects
  it. Deleting a *class* does cascade through its subjects, assignments and submissions.

## Project Structure

## License
