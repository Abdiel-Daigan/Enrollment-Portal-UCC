# Paper vs. System — Consistency Review

**Compared:** `Enrollment-System-Final-Paper.docx` (Parts I–VII) against the portal code on branch `Polishing-Update`.
**Nothing in the system was changed.** Every item below cites where the paper says it and where the code shows the actual behaviour.

Tags: **[Blocker]** likely panel question · **[Should fix]** clear mismatch · **[Minor]** wording/detail.

---

## 1. The enrollment flow in the paper is not the flow in the system

### I-1 [Blocker] The Registrar's "Accept Student" step is missing from the whole paper

**Paper:** FR-009, US-15, §1.5 Scope and §7.5 all say Faculty see students *"whose documents are marked Complete"*. §3.4, §3.5 and §3.9 go straight from document verification to subject assignment.

**System:** after the documents are Complete the Registrar must press **Accept Student**. Only then does the student get status `Enrollee`, get a student ID (`UCC-YYYY-####`), and appear in Faculty's Check Students (`js/status.js` → `isAccepted`, `isVisibleToFaculty`; `js/main.js:796–812`). Faculty cannot load a student who is only "documents complete".

**Fix:** add an FR ("The Registrar shall accept a verified application, which issues the student ID and releases the student to Faculty"), make it a use case, and insert it into the activity, sequence and DFD Level-1 descriptions.

### I-2 [Blocker] Admin final approval does not exist in the system

**Paper:** FR-017, US-22, the Admin actor in §2.5, the context diagram (§3.2), DFD process 6 in §3.9, the "Final Approval Flow" in §3.4, and the Conclusion (§7.6).

**System:** there is no Admin approval screen — `ADMIN_VIEWS` (`js/main.js:225–240`) has dashboard, student/staff accounts, programs, unit limits, academic term, subjects, presets, prerequisites, student courses, payment logs, student payments and fee settings. Status becomes **`Enrolled` automatically when a payment is recorded on an accepted student** (`js/main.js:149` and `:1394`). `status.js` only keeps a legacy `Approved` value for old rows.

**Fix:** either build an approval step later, or rewrite FR-017/US-22 and the three diagrams to say enrollment is completed by payment (Registrar acceptance + payment = Enrolled).

### I-3 [Should fix] The student "Confirm All Documents" step is not described

**Paper:** the wizard ends at Review → Submit (FR-004, US-04).

**System:** after submitting, the student must press **Confirm All Documents** (`documents_verified`). Confirming is explicitly final — the Registrar can no longer return the application (`js/student.js:483`), and only confirmed applications can be accepted (`js/documents.js` → `docsComplete`).

**Fix:** add the confirmation step and the "return is only possible before confirmation" rule.

### I-4 [Minor] The 5th wizard step is "Application Submitted", not "Review"

**Paper:** FR-004 / US-04: "(Personal, Education, Program, Upload Documents, Review)" and "I can review my answers before submitting".
**System:** `js/student.js:40–46` — Personal Information · Educational Background · Program Choice · Upload Documents · **Application Submitted**. There is no separate review step.

### I-5 [Should fix] Payment is not the only thing that unlocks Schedule/Registration Form

**Paper:** FR-016 / US-10 — "unlock the Schedule and Registration Form tabs once at least a partial payment is recorded".
**System:** the student's navigation is built from `hasSubjects` first (`js/main.js:86–110`). A paid student with no subject load does not get Schedule/Registration Form. The Registrar/Accounting copies of the Registration Form require **acceptance** (`hasRegistrationForm` in `js/status.js`), not payment.

---

## 2. Requirements that describe features the system does not have

### I-6 [Should fix] FR-003: "add, edit, deactivate, and view users and assign roles"

**System:** the Admin can create staff accounts with a role, delete staff/student accounts, and open student records (`js/adminmanage.js`, `STAFF_ROLES`, only a Delete action). There is **no deactivate** and **no role change** on an existing account. US-23 ("role changes take effect on the user's next login") implies an edit that doesn't exist.

### I-7 [Should fix] FR-020: "generate reports based on selected criteria"

**System:** report cards are fixed datasets with a "Create Report" table and CSV download — no criteria selection (`js/report.js`). They exist in **Admin (2), Faculty (1) and Accounting (2)**, while the paper says reports are an Admin function.

### I-8 [Minor] §2.1 Stakeholder table misdescribes two actors

- Students: "…**select subjects**…" — students never select subjects; Faculty assigns them.
- Faculty: "View class lists and **assigned sections** … based on finalized enrollment" — there are no sections, and Faculty *create* loads rather than view finalized ones.
- Admin's row omits that the Admin portal also carries Registrar and Accounting functions (see I-14).

---

## 3. Features the system has that the paper never mentions

These are real, visible features. `prerequisite` and `unit limit` do not appear anywhere in the paper.

### I-9 [Should fix] Programs management

Registrar/Admin create, edit and delete degree programs (`js/registrar.js` Programs; programs are stored as `PROGRAM::` rows — see I-16). §1.5 Scope only lists "subjects (courses) and presets".

### I-10 [Should fix] Unit limits

A maximum unit load per program and year level, with a Faculty warning when a load goes over it (`js/unitlimits.js`, `findUnitLimit` in `js/catalog.js`).

### I-11 [Should fix] Prerequisite sequences

Registrar defines ordered sequences per program; Faculty loads that break the order are flagged red and cannot be confirmed (`js/prereqs.js`, `js/faculty.js`).

### I-12 [Should fix] Academic Term

One current semester + school year that drives presets and the printed forms (`saveAcademicTerm` in `js/catalog.js`, `renderRegistrarAcademicTerm` in `js/registrar.js`).

### I-13 [Should fix] Registrar records and credited subjects

- **Student Record** tab: Registrar/Admin can edit name, student ID, program, year, contact, address, guardian, previous school.
- **Course(s) Taken** tab: credited subjects with remarks (Passed/Dropped); they are history and are not billed.

### I-14 [Should fix] Admin duplicates Registrar and Accounting

The Admin portal contains Student Management, Subjects, Presets, Prerequisites, Programs, Unit Limits, Academic Term, Student Courses, Payment Logs, Student Payments and Fee Settings. The paper presents Admin as users + approval + reports only. Worth deciding whether that is intended.

### I-15 [Should fix] Small features absent from the paper

- Paid loads are frozen in Faculty; correcting one needs the Registrar (`js/faculty.js:201`).
- Accounting can delete a payment log, which rolls back `amount_paid`.
- Accounting has its own copy of the Registration Form in Student Payments.
- Subjects can be offered to several programs, or to **General** (all programs) — the paper implies one program per subject.
- The in-app **User Manual** tab in Faculty, Registrar and Accounting. §7.1 describes the manual as external documentation only.

---

## 4. Data model: ERD (§3.7) and Data Dictionary (§3.10)

### I-16 [Blocker] Six concepts have no tables in the paper — and are stored inside `presets`

The code has no dedicated tables for **programs, unit limits, subject↔program links, the academic term, prerequisite sequences, and program seeds**. They are stored as marker rows in the `presets` table: names beginning `PROGRAM::`, `UNITLIMIT::`, `COURSEPROG::`, `ACADEMIC_TERM::`, `PROGRAM_SEED::`, plus prerequisite rows (`js/catalog.js:1–25, 82–90`). Every other module hides them via `isMetaRow()`.

The paper's ERD shows neither these tables **nor** this storage trick, so the schema cannot be reproduced from it — which matters because Appendix A claims "Full Database Schema SQL". This is the single most concrete documentation gap.

### I-17 [Should fix] `courses.program_id` (single program)

Actual: a subject is offered to one, several, or all programs (General). There is no single `courses.program_id` relationship.

### I-18 [Should fix] `applications` is missing seven columns

`documents_verified`, `reference`, `submitted`, `returned`, `registrar_feedback`, `is_regular` (Regular/Irregular), and the storage paths inside `documents`. The ERD row lists only `doc_status`, `amount_paid` and `status`.

### I-19 [Should fix] `student_subjects` is missing `remarks`

Remarks (Passed/Dropped) mark history rows, which are excluded from the current load, from billing, and from faculty totals (`isHistorySubject` in `js/utils.js`).

### I-20 [Minor] Status values are never enumerated

`applications.status` in the dictionary says only "Overall application / enrollment status". The real set is **In Progress · Applicant · Documents Complete · Enrollee · Enrolled · Returned**, and it is *derived* from other fields (`js/status.js`), not free-form.

### I-21 [Minor] "User 1—1 Application"

A fresh registrant has no application row; the code always handles `app = {}`. It is 1—0..1.

### I-22 [Minor] Class diagram (§3.6)

No `Program`, `UnitLimit`, `PrerequisiteSequence`, `AcademicTerm` or `RegistrationForm` class, although all five are first-class in the UI. No `Acceptance` concept either (see I-1).

---

## 5. Architecture and implementation text (§3.11, §4.4, NFR-05)

### I-23 [Should fix] "index.html – the single page that loads the system"

The portal is **multi-page**: `html/auth.html`, `student.html`, `faculty.html`, `registrar.html`, `accounting.html`, `admin.html`, with `index.html` as the entry point only.

### I-24 [Should fix] The module list is incomplete

The paper names main/auth/student/faculty/registrar/accounting/admin/api/utils. The code also has `catalog.js`, `documents.js`, `status.js`, `prereqs.js`, `unitlimits.js`, `regform.js`, `report.js`, `templates.js`, `adminmanage.js` and `manual.js`. NFR-05's "one module per role, plus shared API, auth and utility modules" understates a cleaner separation than the paper claims.

### I-25 [Minor] §3.12 "full-width .role-page-wrap for admin and faculty views"

The class is used across the staff layouts, not just those two.

---

## 6. Security and non-functional claims

### I-26 [Blocker] Row Level Security is claimed as implemented in one place and "recommended" in three others

- §4.7 (Security Implementation): "**Row Level Security on the Supabase tables**" — stated as done.
- §3.11: "Supabase Row Level Security (**recommended**)".
- §5.5: direct API calls rejected "**especially when RLS is enabled**".
- §7.7: "**Enable** and rigorously test RLS".
- §5.8: "RLS **strongly recommended**".

In the code, role enforcement is entirely client-side (the layout picked in `js/main.js` from a `localStorage` session), and `js/api.js` talks to Supabase with the anon key. Unless RLS is actually enabled on the tables, §4.7 and the §5.5 sentence are not true. **I cannot check your Supabase project from here — please confirm.**

### I-27 [Should fix] "Secure password hashing" is not secure

**Paper:** §3.11 "secure password hashing", §4.7 "only password_hash is stored", NFR-04 "password hashing, secure sessions".
**System:** `hash()` in `js/utils.js:23–31` is a 32-bit djb2 checksum with a hardcoded salt (`'::ucc$salt'`) returning `sim$<hex>`, and login is a REST equality query on that hash (`js/auth.js:41`). It is *hashed*, but collisions are trivial and knowing the hash is as good as knowing the password. Sessions are a plain `localStorage['ucc_session_v1']` object with no expiry and no revocation.

**Suggested wording:** "passwords are hashed before storage (prototype-grade); replacing this with Supabase Auth is a listed recommendation" — which matches your own §7.7 direction.

### I-28 [Should fix] "Access control for student documents" (NFR-04)

Uploads/downloads go through the anon key; access depends on Storage bucket policies, not code. Same verification point as I-26.

### I-29 [Minor] Performance target is unverified

NFR-01 (250–350 students, "a few seconds") has no measurement behind it, and §4.2 states testing is manual. Fine as a *target*; state it as a target, not a validated result.

### I-30 [Minor] Internal contradiction: mobile vs tablet

NFR-06 says "desktop and mobile"; §3.12 says "desktop and tablet use".

### I-31 [Minor] Test artifacts

§5.2–§5.5 describe unit, integration, system and security testing, and Appendix C is listed as a "Detailed Test Case Suite", but the appendices have headings only and the repository has no test files. Either attach the suite or describe the testing as manual walk-throughs.

### I-32 [Minor] Appendix E (deployment URL) is empty

§1.1, §1.7 and §6.1 all assert GitHub Pages hosting. Please confirm the live URL, or adjust those statements to "repository hosted on GitHub; deployment planned".

---

## 7. One-line fixes in §7.5 (Troubleshooting)

- "Student not visible to Faculty → Confirm Registrar has marked documents Complete" → "…and **accepted the student**".
- "Schedule tab locked → Verify that amount_paid > 0" → add "**and that the student has a subject load**".

---

## What the paper already gets right

Worth keeping as-is: the five roles and their portals; the five-step application; document checklists per applicant type (Freshman / Transferee / Returnee, with one optional document for returnees); per-document Missing/Complete by the Registrar; return-with-feedback and student resubmission; fee formula (units × tuition per unit + miscellaneous + registration); simulated payment with reference numbers and partial payments; payment logs; dashboards for every role; the Mint Green & Gold theme; one module per role; and the stated limitations (§1.5) — the simulated gateway, manual document checking and Supabase free-tier dependency are all accurate.

---

## Questions for you

1. **RLS (I-26):** Is Row Level Security actually enabled on the Supabase tables? If not, §4.7 and §5.5 need to change; if yes, I can tighten the wording so the three sections agree.
2. **Admin approval (I-2):** Should I build the final-approval step later (keeping FR-017/US-22 as written), or will you rewrite the flow so enrollment completes at payment? Tell me which and I'll follow it.
3. **Deactivate / role change (I-6):** Add to the system later, or reword FR-003/US-23 to "create and delete accounts"?
4. **Deployment (I-32):** Is the site already live on GitHub Pages? I need the URL for Appendix E, or I'll soften the hosting statements.
5. **Scope:** Do you want me to draft corrected text for the affected sections (flow, FR/US tables, ERD, §4.4, §7.5), or is this list enough for you to revise the paper yourself?

---

## Where to look: search keywords for every item

Page numbers in a `.docx` move with your font, margins and printer settings, so this guide uses the **section number + one phrase to Ctrl+F**. Both land in the same place whether you open it in Word, Google Docs or LibreOffice. Rows are in paper order, so you can work top-to-bottom.

| Open | Ctrl+F this | Finding | What you are checking |
| --- | --- | --- | --- |
| §1.1, §1.7, §6.1 | `GitHub Pages` | I-32 | Three places assert hosting that Appendix E never shows |
| §1.5 Scope | `presets` | I-9, I-10, I-11 | Scope lists only subjects and presets — programs, unit limits, prerequisites are absent |
| §2.1 table | `select subjects` | I-8 | Students never select subjects; Faculty assign them |
| §2.1 table | `assigned sections` | I-8 | There are no sections in the system |
| §2.5 actors | `final approval` | I-2 | Admin approval does not exist in the code |
| FR-003 | `deactivate` | I-6 | No deactivate, no role change — create and delete only |
| FR-004 / US-04 | `Upload Documents, Review` | I-3, I-4 | Step 5 is "Application Submitted"; the Confirm All Documents step is missing |
| FR-009 / US-15 | `marked Complete` | I-1 | Faculty only see students the Registrar has **accepted**, not merely documents-complete |
| FR-016 / US-10 | `unlock the Schedule` | I-5 | Unlock also needs a subject load; the staff Registration Form needs acceptance, not payment |
| FR-017 / US-22 | `final approval` | I-2 | Enrollment completes at payment in the code |
| FR-020 | `selected criteria` | I-7 | Reports are fixed datasets + CSV, no criteria picker; they exist in three roles |
| US-23 | `next login` | I-6 | Describes a role edit that has no screen |
| NFR-01 | `few seconds` | I-29 | Stated as a result; it is an unmeasured target |
| NFR-04 | `password hashing` | I-27 | `hash()` in `js/utils.js` is a 32-bit djb2 checksum, not secure hashing |
| NFR-04 | `Access control for student documents` | I-28 | Depends on Storage bucket policies, not code |
| NFR-05 | `one module per role` | I-24 | Nine more modules exist than the sentence allows |
| NFR-06 | `desktop and mobile` | I-30 | §3.12 says "desktop and tablet" — pick one |
| §3.2 context diagram | `Admin` | I-2 | The Admin arrow into the system is the approval that doesn't exist |
| §3.4 | `Final Approval Flow` | I-2 | Whole subsection describes a missing step |
| §3.5 sequence | `verified` | I-1 | Goes from verification straight to subject assignment; no Accept call |
| §3.6 class diagram | `Class Diagram` | I-22 | No Program, UnitLimit, PrerequisiteSequence, AcademicTerm, RegistrationForm |
| §3.7 ERD | `presets` | I-16 | The ERD's `presets` box hides programs, unit limits, term, seeds, prereqs |
| §3.7 ERD | `program_id` | I-17 | A subject can serve several programs or General; the FK is not 1-to-many |
| §3.7 ERD | `1` near Application | I-21 | It is User 1—0..1 Application, not 1—1 |
| §3.9 DFD Level-1 | `Process 6` | I-2 | The approval process has no implementation |
| §3.10 dictionary, `applications` | `doc_status` | I-18 | Seven columns missing: `documents_verified`, `reference`, `submitted`, `returned`, `registrar_feedback`, `is_regular`, document paths |
| §3.10 dictionary, `student_subjects` | `remarks` | I-19 | `remarks` (Passed/Dropped) is missing and drives history/billing exclusion |
| §3.10 dictionary, `applications.status` | `application / enrollment status` | I-20 | The six real values are never listed, and the field is derived |
| §3.11 | `single page` | I-23 | The portal is multi-page (`html/auth.html`, `student.html`, …) |
| §3.11 | `secure password hashing` | I-27 | Same issue as NFR-04 |
| §3.11 | `recommended` | I-26 | Says RLS is "recommended" while §4.7 says it is done |
| §3.12 | `.role-page-wrap` | I-25 | Used on all staff layouts, not just admin and faculty |
| §3.12 | `desktop and tablet` | I-30 | Conflicts with NFR-06 |
| §4.2 | `manual` | I-29 | Confirms nothing was measured against NFR-01 |
| §4.4 | `index.html` | I-24 | The module list stops at eight modules |
| §4.7 | `Row Level Security` | I-26 | The strongest version of the RLS claim — the one to verify first |
| §5.2–§5.4 | `unit testing` | I-31 | Describes suites that have no files in the repository |
| §5.5 | `RLS is enabled` | I-26 | Conditional wording that contradicts §4.7 |
| §5.8 | `strongly recommended` | I-26 | Fourth, contradictory RLS statement |
| §6.1 | `GitHub Pages` | I-32 | Same hosting claim as §1.1 |
| §7.1 | `user manual` | I-15 | Describes an external manual; the portal has an in-app User Manual tab |
| §7.5 | `Student not visible to Faculty` | I-1 | Add "…and accepted the student" |
| §7.5 | `Schedule tab locked` | I-5 | Add "…and the student has a subject load" |
| §7.6 Conclusion | `final approval` | I-2 | Restates the missing approval step |
| §7.7 | `RLS` | I-26 | "Enable and rigorously test RLS" — an intention, not a result |
| Appendix A | `Full Database Schema SQL` | I-16 | Claims completeness the ERD cannot deliver |
| Appendix C | `Test Case Suite` | I-31 | Heading only, no cases attached |
| Appendix E | `Appendix E` | I-32 | Deployment URL is blank |

### Three searches that show the biggest gaps in ten seconds

1. **`prerequisite`** — 0 matches in the whole paper. The system has a full prerequisite sequence editor and a red-flag warning that blocks confirming a load (`js/prereqs.js`).
2. **`unit limit`** — 0 matches. The system has `js/unitlimits.js` and a Faculty over-limit warning.
3. **`deactivate`** — 1 match, only in FR-003, and it is describing something the system cannot do.

If you only fix four things before the defense, fix the four blockers: **I-1** (Registrar acceptance, §3.4/§3.5/§3.9 + FR-009), **I-2** (Admin approval, FR-017/US-22 + three diagrams), **I-16** (ERD §3.7 + Appendix A), **I-26** (§4.7 vs §3.11/§5.5/§5.8/§7.7).
