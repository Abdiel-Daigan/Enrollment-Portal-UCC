# Database Guide — Unida Christian Colleges Enrollment Portal

This guide explains what the portal stores today, which parts are redundant or
badly organized, and how to move to a cleaner schema **without breaking the
running app**. Nothing here has been applied to the database: every statement is
yours to review and run.

> The frontend talks to Supabase directly with the publishable key in
> `js/api.js`. Any change below that the app does not know about yet must be
> done after the matching code change.

---

## 1. What the database looks like today

Tables the code reads and writes:

| Table | Used for | Main columns (as the code expects them) |
| --- | --- | --- |
| `users` | every login | `id`, `name`, `email`, `password_hash`, `role`, `student_id` |
| `applications` | one row per student | `user_id`, `personal`, `education`, `program`, `doc_type`, `documents`, `doc_status`, `documents_verified`, `reference`, `status`, `submitted`, `returned`, `registrar_feedback`, `is_regular`, `amount_paid` |
| `courses` | subjects | `id`, `code`, `title`, `units`, `schedule_day`, `schedule_time`, `program_id` |
| `student_subjects` | a student's subject load/history | `id`, `user_id`, `course_id`, `status`, `grade`, `remarks` |
| `payment_logs` | payment transactions | `id`, `user_id`, `amount`, `reference_no`, `payment_type`, `processed_by`, `created_at` |
| `presets` | **six different things** | `id`, `name`, `program_id`, `year_level`, `semester` |
| `preset_subjects` | subjects inside a preset | `preset_id`, `course_id` |
| `system_settings` | tuition and fees | `id` (`1`), `tuition_per_unit`, `misc_fee`, `reg_fee` |
| Storage bucket | `student-documents` | uploaded files, public URLs stored in `applications.documents` |

### The `presets` table is a junk drawer

Programs, unit limits, the subject↔program map, the academic term and
prerequisite sequences are all stored as rows in `presets`, distinguished only
by a prefix inside the `name` column (see `js/catalog.js` and `js/prereqs.js`):

| Prefix | Payload inside `name` | Should really be |
| --- | --- | --- |
| `PROGRAM::` | `{"id":10,"code":"BSIT","name":"...","years":4}` | `programs` table |
| `PROGRAM_SEED::` | `"1"` (a one-time marker) | nothing — the table itself is the marker |
| `UNITLIMIT::` | `{"programId":2,"year":1,"maxUnits":24}` | `unit_limits` table |
| `COURSEPROG::` | `{"12":[1,2],"15":[0]}` — one row for **all** subjects | `course_programs` table |
| `ACADEMIC_TERM::` | `{"semester":"1st Semester","schoolYear":"2026-2027"}` | `academic_terms` / settings |
| `PREREQ::` | `{"title":"...","courseIds":[1,2,3],"programIds":[2]}` | `prerequisite_sets` + items |

Consequences today:

- Program ids, year levels and maximum units are duplicated between the JSON
  payload and the columns of the same row, so the two can disagree.
- No foreign keys: deleting a program or a course leaves JSON pointing at a
  missing id, which the app silently turns into "Unspecified".
- The whole subject↔program map is **one row**. Two admins saving at the same
  time overwrite each other.
- Reading any config means loading the entire `presets` table on every page.
- Real presets and configuration rows share one table, so every query needs an
  `isMetaRow()` filter to avoid showing config as curriculum.

### Other duplication

- **Documents** live in one JSON map (`applications.documents` = files). A
  document is complete as soon as its file exists, so the legacy per-document
  `applications.doc_status` map is no longer written.
- **Enrollment status** is a text column that holds both the derived label and
  the Registrar's confirmation (`Enrollee` / `Enrolled` / `Documents Complete`).
  `applications.documents_verified` is the Registrar's "Confirm All Documents".
- **Amount paid** is cached in `applications.amount_paid` while the real
  transactions are in `payment_logs`.
- **`student_subjects.status`** and `student_subjects.remarks` are written with
  the same value.
- **`courses.program_id`** and the `COURSEPROG::` map both say which program
  a subject belongs to.
- `applications` has no unique constraint on `user_id`, yet the code assumes
  `apps[0]` is the only row.

---

## 2. Target schema

```
users (id, name, email, password_hash, role, student_id, created_at)
  └─ applications (1:1, user_id unique)
       ├─ application_documents (1:N, one row per required document)
       └─ student_subjects (1:N)
       └─ payment_logs (1:N)

programs (id, code, name, years)
  ├─ unit_limits (program_id, year_level, max_units)
  ├─ course_programs (course_id, program_id)
  ├─ presets (id, name, program_id, year_level, semester)
  │    └─ preset_subjects (preset_id, course_id)
  └─ prerequisite_sets (id, title) → prerequisite_subjects (set_id, course_id, position)
                                    → prerequisite_programs (set_id, program_id)

academic_terms (id, semester, school_year, is_current)
system_settings (id = 1, tuition_per_unit, misc_fee, reg_fee)
```

---

## 3. Migration, in four safe phases

Run each phase in the Supabase SQL editor inside a transaction, check the app,
then commit. Take a backup first (Dashboard → Database → Backups, or `pg_dump`).

### Phase 1 — Clean the data you already have (no code change)

```sql
-- 1. Inspect what is sitting in the shared table.
select case
         when name like 'PROGRAM::%'     then 'program'
         when name like 'UNITLIMIT::%'  then 'unit limit'
         when name like 'COURSEPROG::%' then 'course map'
         when name like 'ACADEMIC_TERM::%'  then 'academic term'
         when name like 'PROGRAM_SEED::%'   then 'seed marker'
         when name like 'PREREQ::%'      then 'prerequisite'
         else 'preset'
       end as kind, count(*)
from presets group by 1 order by 1;

-- 2. One application per student (review the duplicates before deleting!).
select user_id, count(*) from applications group by user_id having count(*) > 1;

begin;
delete from applications a
using applications b
where a.user_id = b.user_id and a.id < b.id;          -- keeps the newest row
alter table applications add constraint applications_user_id_key unique (user_id);
commit;

-- 3. Foreign keys with cascade, so deleting an account removes its records.
alter table applications
  add constraint applications_user_fk foreign key (user_id)
  references users(id) on delete cascade;
alter table student_subjects
  add constraint student_subjects_user_fk foreign key (user_id)
  references users(id) on delete cascade,
  add constraint student_subjects_course_fk foreign key (course_id)
  references courses(id) on delete restrict;
alter table payment_logs
  add constraint payment_logs_user_fk foreign key (user_id)
  references users(id) on delete cascade;
alter table preset_subjects
  add constraint preset_subjects_preset_fk foreign key (preset_id)
  references presets(id) on delete cascade,
  add constraint preset_subjects_course_fk foreign key (course_id)
  references courses(id) on delete cascade;

-- 4. Indexes the portals ask for constantly.
create index if not exists applications_submitted_idx on applications (submitted) where submitted;
create index if not exists student_subjects_user_idx on student_subjects (user_id);
create index if not exists payment_logs_user_idx on payment_logs (user_id);
create index if not exists users_role_idx on users (role);

-- 5. Keep the status column inside known values.
alter table applications add constraint applications_status_check
  check (status is null or status in
    ('Pending Review', 'Documents Complete', 'Enrollee', 'Enrolled', 'Approved'));
```

Check first that no row violates the status check:

```sql
select status, count(*) from applications group by 1 order by 2 desc;
```

### Phase 2 — Move configuration out of `presets`

The statements below only **copy** data. The app keeps working because it still
reads `presets`; the new tables become the source of truth when the code is
switched over (§4).

```sql
create table if not exists programs (
  id      integer primary key,
  code    text not null unique,
  name    text not null,
  years   integer not null default 4 check (years between 1 and 6)
);

insert into programs (id, code, name, years)
select (program_id)::int,
       substr(name, 10)::jsonb ->> 'code',
       coalesce(nullif(substr(name, 10)::jsonb ->> 'name', ''), substr(name, 10)::jsonb ->> 'code'),
       coalesce((substr(name, 10)::jsonb ->> 'years')::int, 4)
from presets
where name like 'PROGRAM::%'
  and (program_id) is not null
on conflict (id) do nothing;

create table if not exists unit_limits (
  program_id integer not null references programs(id) on delete cascade,
  year_level integer not null check (year_level between 1 and 6),
  max_units  integer not null check (max_units between 1 and 60),
  primary key (program_id, year_level)
);

insert into unit_limits (program_id, year_level, max_units)
select (substr(name, 12)::jsonb ->> 'programId')::int,
       (substr(name, 12)::jsonb ->> 'year')::int,
       (substr(name, 12)::jsonb ->> 'maxUnits')::int
from presets
where name like 'UNITLIMIT::%'
on conflict (program_id, year_level) do update set max_units = excluded.max_units;

create table if not exists course_programs (
  course_id  integer not null references courses(id) on delete cascade,
  program_id integer not null references programs(id) on delete cascade,
  primary key (course_id, program_id)
);

insert into course_programs (course_id, program_id)
select (entry.key)::int, (entry.value #>> '{}')::int
from presets p
cross join lateral jsonb_each(substr(p.name, 13)::jsonb) as entry
where p.name like 'COURSEPROG::%'
on conflict do nothing;

create table if not exists academic_terms (
  id          serial primary key,
  semester    text not null check (semester in ('1st Semester', '2nd Semester', 'Summer')),
  school_year text not null check (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);

insert into academic_terms (semester, school_year, is_current)
select substr(name, 16)::jsonb ->> 'semester',
       substr(name, 16)::jsonb ->> 'schoolYear',
       true
from presets
where name like 'ACADEMIC_TERM::%';

create table if not exists prerequisite_sets (
  id    serial primary key,
  title text not null
);
create table if not exists prerequisite_subjects (
  set_id    integer not null references prerequisite_sets(id) on delete cascade,
  course_id integer not null references courses(id) on delete cascade,
  position  integer not null,
  primary key (set_id, course_id)
);
create table if not exists prerequisite_programs (
  set_id     integer not null references prerequisite_sets(id) on delete cascade,
  program_id integer not null references programs(id) on delete cascade,
  primary key (set_id, program_id)
);

do $$
declare
  r      record;
  s_id   integer;
  payload jsonb;
begin
  for r in select * from presets where name like 'PREREQ::%' loop
    payload := substr(r.name, 9)::jsonb;

    insert into prerequisite_sets (title)
    values (coalesce(payload ->> 'title', 'Untitled sequence'))
    returning id into s_id;

    insert into prerequisite_subjects (set_id, course_id, position)
    select s_id, (item.value #>> '{}')::int, item.ord
    from jsonb_array_elements_text(payload -> 'courseIds') with ordinality as item(value, ord)
    on conflict do nothing;

    insert into prerequisite_programs (set_id, program_id)
    select distinct s_id, (item.value #>> '{}')::int
    from jsonb_array_elements_text(coalesce(payload -> 'programIds', '[]'::jsonb)) as item(value)
    on conflict do nothing;

    if not exists (select 1 from prerequisite_programs where set_id = s_id) then
      insert into prerequisite_programs (set_id, program_id)
      values (s_id, r.program_id)
      on conflict do nothing;
    end if;
  end loop;
end $$;
```

Verify before trusting the copy:

```sql
select (select count(*) from presets where name like 'PROGRAM::%')     as programs_old,
       (select count(*) from programs)                                 as programs_new;
select (select count(*) from presets where name like 'PREREQ::%')      as prereq_old,
       (select count(*) from prerequisite_sets)                        as prereq_new;
select * from prerequisite_subjects order by set_id, position;
```

### Phase 3 — One row per document, explicit acceptance

```sql
create table if not exists application_documents (
  id           bigserial primary key,
  user_id      bigint not null references users(id) on delete cascade,
  doc_id       text not null,
  doc_name     text not null,
  file_url     text,
  status       text not null default 'Missing' check (status in ('Missing', 'Complete')),
  uploaded_at  timestamptz,
  completed_by bigint references users(id),
  completed_at timestamptz,
  unique (user_id, doc_id)
);

insert into application_documents (user_id, doc_id, doc_name, file_url, status)
select a.user_id,
       d.key,
       d.key,                                            -- the app maps names from js/documents.js
       d.value,
       coalesce(a.doc_status ->> d.key, 'Missing')
from applications a
cross join lateral jsonb_each(a.documents) as d
on conflict (user_id, doc_id) do update
  set file_url = excluded.file_url,
      status   = excluded.status;

-- The Registrar's acceptance gets a real timestamp instead of a status word.
alter table applications add column if not exists accepted_at timestamptz;

update applications
set accepted_at = now()
where accepted_at is null
  and status in ('Enrollee', 'Enrolled')
  and documents_verified;
```

### Phase 4 — Application fields and money

```sql
alter table applications
  add column if not exists first_name  text,
  add column if not exists middle_name text,
  add column if not exists last_name   text,
  add column if not exists phone       text,
  add column if not exists address     text,
  add column if not exists program_id  integer references programs(id),
  add column if not exists year_level  integer,
  add column if not exists elem_school text,
  add column if not exists elem_year   text,
  add column if not exists jhs_school  text,
  add column if not exists jhs_year    text,
  add column if not exists shs_school  text,
  add column if not exists shs_year    text;

update applications set
  first_name  = personal ->> 'first_name',
  middle_name = personal ->> 'middle_name',
  last_name   = personal ->> 'last_name',
  phone       = personal ->> 'phone',
  address     = personal ->> 'address',
  program_id  = nullif(program ->> 'preferred', '')::int,
  year_level  = nullif(program ->> 'year_level', '')::int,
  elem_school = education -> 'elem' ->> 'school',
  elem_year   = education -> 'elem' ->> 'year',
  jhs_school  = education -> 'jhs'  ->> 'school',
  jhs_year    = education -> 'jhs'  ->> 'year',
  shs_school  = education -> 'shs'  ->> 'school',
  shs_year    = education -> 'shs'  ->> 'year'
where first_name is null;   -- run once

-- amount_paid becomes a cache that a trigger keeps honest.
create or replace function sync_amount_paid() returns trigger
language plpgsql as $$
begin
  update applications
  set amount_paid = coalesce((select sum(amount) from payment_logs
                              where user_id = coalesce(new.user_id, old.user_id)), 0)
  where user_id = coalesce(new.user_id, old.user_id);
  return null;
end $$;

create trigger payment_logs_sync_amount
after insert or update or delete on payment_logs
for each row execute function sync_amount_paid();
```

If any row has a `program ->> 'preferred'` that is not a number, the
`::int` cast fails. Find them first:

```sql
select user_id, program ->> 'preferred' as preferred
from applications
where coalesce(program ->> 'preferred', '') !~ '^[0-9]+$';
```

---

## 4. Switching the app to the new tables

Each block is independent; do them one at a time and test.

| New table | Replace in |
| --- | --- |
| `programs` | `loadCatalog()` / `saveProgram()` / `deleteProgram()` in `js/catalog.js` |
| `unit_limits` | `saveUnitLimit()`, `deleteUnitLimit()`, `findUnitLimit()` in `js/catalog.js` |
| `course_programs` | `getCourseProgramIds()`, `saveCoursePrograms()` in `js/catalog.js` |
| `academic_terms` | `getAcademicTerm()`, `saveAcademicTerm()` in `js/catalog.js` |
| `prerequisite_sets` / `_subjects` / `_programs` | `js/prereqs.js` |
| `application_documents` | `js/documents.js`, the registrar/student document tabs, `regConfirmDocuments` in `js/main.js` |
| `applications.accepted_at` | `js/status.js` (`isConfirmed`, `canConfirmDocuments`) |
| `applications` real columns | application wizard (`js/student.js`), `js/regform.js`, the record form |

When the app no longer reads a source, remove the old one last:

```sql
-- only after the code change is deployed and verified
delete from presets where name like 'PROGRAM::%' or name like 'PROGRAM_SEED::%';
delete from presets where name like 'UNITLIMIT::%';
delete from presets where name like 'COURSEPROG::%';
delete from presets where name like 'ACADEMIC_TERM::%';
delete from presets where name like 'PREREQ::%';

alter table applications drop column documents;
alter table applications drop column doc_status;
alter table applications drop column documents_verified;
alter table applications drop column personal;
alter table applications drop column education;
alter table applications drop column program;
alter table student_subjects drop column status;   -- remarks is the real value
```

Keep `presets` + `preset_subjects`: that is genuine curriculum data.

---

## 5. Security (do this regardless of the rest)

The browser ships the publishable key and can write every table. That is how
login, uploads and payments work today. Before real student data is stored:

1. Turn on Supabase Auth and make `users.id` match `auth.users.id`, or add an
   `auth_user_id` column.
2. Enable RLS on every table and write policies by role:
   - students: `select`/`update` only rows where `user_id = auth.uid()`;
   - registrar/admin: full access to `applications`, `student_subjects`,
     `payment_logs`;
   - accounting: read all, write `payment_logs`;
   - faculty: read accepted students only.
3. Keep the bucket private and serve files with signed URLs.
4. Replace `password_hash` (an unsalted `sim$…` hash) with Supabase Auth.
5. Never put a service-role key in `js/api.js`.

---

## 6. Suggested order

1. **Phase 1** (data cleanup + keys + indexes). Low risk, immediate benefit.
2. **Security**: Supabase Auth + RLS.
3. **Phase 2** (programs, unit limits, course map, academic term,
   prerequisites) — biggest cleanup win; then delete the meta rows.
4. **Phase 3** (documents + `accepted_at`) — this is the schema behind the new
   Complete/Undo and Accept buttons.
5. **Phase 4** (application columns, payments trigger) — largest code change,
   do it last.
