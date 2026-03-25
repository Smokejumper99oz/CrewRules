# Mentoring — Mentee bulk upload V1 (spreadsheet template & import rules)

**Status:** Definition/spec only — **no** upload UI, **no** assignment logic changes yet.  
**Audience:** Ops defining spreadsheets; engineering implements import against this doc.

---

## 1. Final recommended column list

Use these **exact** header names (`snake_case`), one header row. UTF-8 CSV or spreadsheet export with the same names.

**Suggested column order (readability):**

1. Mentor identifier (at most one column filled per row — see §3):  
   `mentor_user_id` **or** `mentor_employee_number` **or** `mentor_email`
2. `mentee_employee_number`
3. `mentee_full_name`
4. `hire_date`
5. `mentee_email`
6. `mentee_phone`
7. `active`
8. `notes`

All logical columns:

| Column | In template |
|--------|-------------|
| `mentee_employee_number` | Yes — required |
| `mentee_full_name` | Yes — required |
| `hire_date` | Yes — required |
| `mentee_email` | Optional |
| `mentee_phone` | Optional |
| `mentor_email` | Optional — mentor ID (exclusive) |
| `mentor_employee_number` | Optional — mentor ID (exclusive) |
| `mentor_user_id` | Optional — mentor ID (exclusive) |
| `active` | Optional — defaults per §2 |
| `notes` | Optional |

---

## 2. Required vs optional columns

### Required (every row)

| Column | Role |
|--------|------|
| `mentee_employee_number` | **Primary match key** for linking the mentee to portal profiles / assignments in the target tenant (after trim/normalize). |
| `mentee_full_name` | Display and reference data for the mentee. |
| `hire_date` | **Stored for reference** and **future profile prefill** (e.g. DOH / assignment `hire_date`); see validation (§4). |

### Optional

| Column | Role |
|--------|------|
| `mentee_email` | Contact / future comms; **not** login email unless product explicitly maps it later. |
| `mentee_phone` | Contact / future display. |
| `mentor_email` | Resolve mentor: `profiles.email` (tenant-scoped), case-insensitive match after trim. |
| `mentor_employee_number` | Resolve mentor: `profiles.employee_number` in tenant. |
| `mentor_user_id` | Resolve mentor: `profiles.id` (UUID). |
| `active` | Assignment / row active flag; **if omitted, treat as `true`** (see §4). |
| `notes` | Free text; **do not require** for any schema write in V1 unless/until a target column or table is mapped. Safe to **ignore on write** until mapping exists. |

### Mentor identifiers (exclusive)

Of `mentor_email`, `mentor_employee_number`, `mentor_user_id`:

- **At most one** may be non-empty per row.
- **More than one** non-empty → **row error** (see §6).
- **All three empty:** allowed only if the import mode explicitly supports “mentee-only” rows (no mentor resolution). For **standard “assign mentor + mentee” import**, treat as **row error** (“mentor identifier required”). Product should choose one policy before implementation; recommended default: **require exactly one** mentor identifier for V1 assignment imports.

---

## 3. Validation rules

### 3.1 Formats

- **`hire_date`:** Required. **ISO date `YYYY-MM-DD` only** in V1. Reject ambiguous values (`01/02/2026`, `2/6/25`, etc.) unless a locale parser is added later.
- **`mentee_employee_number` / `mentor_employee_number`:** Trim; non-empty when used; max length aligned with `profiles.employee_number` (e.g. 32). Tenant-specific zero-padding rules documented at import time.
- **`mentor_user_id`:** If present, must match UUID shape (8-4-4-4-12 hex with hyphens).
- **`mentee_email` / `mentor_email`:** If present, trim; basic syntax validation; normalization (e.g. lowercase) **for matching only**, not a claim of login identity.
- **`active`:** If present, accept boolean-like tokens: `true`/`false`, `1`/`0`, `yes`/`no` (case-insensitive). Invalid token → **row error**. **If column missing or cell empty → `true`.**
- **`notes`:** If present, optional max length (e.g. 2000–10000 chars) to protect DB; overflow → **row error** or truncate per product policy.

### 3.2 File / batch

- **Duplicate `mentee_employee_number`** in the same file: recommend **reject** and list duplicate keys (safest for V1).
- **Empty file** / missing required headers → **fatal import error**.

### 3.3 Scope (implementation-time)

- Import is **tenant-scoped** (and **admin/super-admin** gated). Mentor and mentee resolution both respect target **tenant** (and **portal** if applicable).

---

## 4. Matching logic

### 4.1 Mentee

1. Normalize `mentee_employee_number` (trim; tenant rules for formatting).
2. **Primary key** for “who is this row about” within the tenant.
3. **Intent when import runs** (no code change in this spec): find or create linkage targets — e.g. existing profile with that `employee_number`, existing `mentor_assignments` row keyed by `employee_number` / mentee, etc. Exact upsert behavior is a **future** implementation; this spec only locks the **key** and **fields**.

### 4.2 Mentor (exactly one identifier when resolving mentor)

When exactly one mentor column is non-empty, resolve in this **deterministic order** (helps avoid ambiguity if a row is malformed and multiple columns are non-empty — those rows are already rejected):

1. `mentor_user_id` → `profiles.id`
2. Else `mentor_employee_number` → `profiles.employee_number` **and** tenant
3. Else `mentor_email` → `profiles.email` **and** tenant (case-insensitive)

If resolution returns **no profile** → **row error** (unknown mentor).

If resolution returns **multiple** profiles (should not happen for `id`; possible if data corrupt for email) → **row error**.

### 4.3 `hire_date`

- **Stored for reference** and alignment with assignment / profile prefill in a later milestone.
- Does **not** by itself create auth or login sessions.

### 4.4 `active`

- Maps conceptually to assignment (or record) **active** flag; **`true` if column omitted or cell blank.**

### 4.5 `notes`

- **No required schema mapping** for V1; may be dropped, stored in a staging table, or mapped later without blocking strict validation.

---

## 5. Import error cases (summary)

| Condition | Severity |
|-----------|----------|
| Missing required header (`mentee_employee_number`, `mentee_full_name`, `hire_date`) | Fatal / reject file |
| Required cell empty after trim | Row error |
| Invalid `hire_date` format | Row error |
| Two or more of `mentor_email`, `mentor_employee_number`, `mentor_user_id` non-empty | Row error |
| Import mode requires mentor, but all mentor identifiers empty | Row error |
| Invalid `mentor_user_id` format | Row error |
| Mentor does not resolve in tenant | Row error |
| Invalid `active` value when provided | Row error |
| Duplicate `mentee_employee_number` in file | Reject file or batch (recommended reject with list) |
| Email/phone/notes length exceeded | Row error (or truncate per policy) |
| Mentee resolves to same user as mentor | Row error (business rule; align with existing product rules) |

---

## 6. Suggested example row

**CSV (comma-separated), mentor by employee number:**

```text
mentor_employee_number,mentee_employee_number,mentee_full_name,hire_date,mentee_email,mentee_phone,active,notes
45231,88901,Alex R. Pilot,2025-06-16,alex.p@airline.example,555-010-0900,true,LOFO Jun class
```

**Minimal row (active omitted → true):**

```text
mentor_email,mentee_employee_number,mentee_full_name,hire_date
captain.smith@airline.example,88902,Jordan Lee,2025-07-01
```

**With `mentor_user_id`:**

```text
mentor_user_id,mentee_employee_number,mentee_full_name,hire_date
a1b2c3d4-e5f6-7890-abcd-ef1234567890,88903,Casey Morgan,2025-08-15
```

---

## 7. Out of scope (unchanged intent)

- Upload UI, parsers, API routes, or background jobs.
- Changes to `linkMenteeToAssignments`, super-admin sync, RLS, or assignment algorithms.
- Auto-provisioning Supabase users from `mentee_email`.
