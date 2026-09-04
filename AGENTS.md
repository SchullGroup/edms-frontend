<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# EDMS project documentation — read and maintain

`docs/` holds five verified reference documents covering **both this app and the
`edms-backend` API**. They describe what the code does *today*, not design intent. Every
claim in them is anchored to a file, and the counts were derived by inspection, not
estimated.

| Doc | Scope |
|---|---|
| [`docs/01-architecture-and-drift.md`](docs/01-architecture-and-drift.md) | System map, BFF auth split, the 4 authorization layers, storage path, **full API drift matrix**, `DRIFT-01`…`DRIFT-13` register |
| [`docs/02-user-stories.md`](docs/02-user-stories.md) | 6 personas, 11 epics, 41 stories with per-story build status |
| [`docs/03-onboarding-flow-end-to-end.md`](docs/03-onboarding-flow-end-to-end.md) | Tenant setup as one dependency chain (Phases 0–10), day-one runbook |
| [`docs/04-role-onboarding-and-connections.md`](docs/04-role-onboarding-and-connections.md) | Per-role journeys and the 7 role-to-role handoffs |
| [`docs/05-implementation-status-by-role.md`](docs/05-implementation-status-by-role.md) | All 42 pages: data source, APIs wired/missing, dummy data, 38-item prioritised backlog |

`docs/README.md` is the index. Start there.

## Check them BEFORE

- Answering "does X work?", "what's left?", "why is this screen empty?", "what should I
  build next?" — doc 05 already has the answer and the backlog.
- Touching auth, permissions, routing, upload, search, or any dashboard page.
- Reporting a bug that might be a **known** drift item. Search for `DRIFT-` first.

Do not re-derive the picture from scratch. Read the relevant doc, then verify only the
specific claim your change depends on.

## Update them WHEN

| You change… | Update |
|---|---|
| A backend route (add / remove / rename / change path) | `01` §7 drift matrix · `05` "APIs wired" + "APIs missing" for each affected role |
| A frontend service or hook's target URL | `01` §7 · `05` |
| A page's data source (`SEED` → API, or vice versa) | `05` page inventory table + **portfolio counts** · `04` role section |
| Add or delete a page | `05` counts · `04` role section · `02` if it's a new capability |
| Fix a `DRIFT-nn` item | `01` register **and every doc that cites that id** (`grep -rn "DRIFT-nn" docs/`) |
| Seed roles, permissions or scopes (`prisma/seed-system.ts`) | `03` Phase 1 · `02` personas · `04` role identity sections |
| Add a Prisma model or migration | `02` affected epic status · `01` §8 if it changes a wire contract |
| Add / rename an env var | `01` §9 |
| Ship a backlog item | Tick it in `05`, and move the story's status marker in `02` |

**If a change makes a doc wrong, fixing the doc is part of the change, not follow-up work.**

## House rules for these docs

1. **Never mark something ✅ Live without verifying it end to end** — UI → API → database.
   ✅ means it works, not that the code looks right.
2. **Re-derive counts, don't estimate** — use the verification commands below.
   `docs/README.md` § "Where the numbers come from" explains the method behind them.
3. **Correct errors in place**, and add a line to `docs/README.md` § "Where the numbers
   come from" noting what was wrong. Two corrections are already recorded there — that
   list is deliberate, not clutter.
4. **Keep the status markers consistent** across all five docs: ✅ Live/Done ·
   🟨 Partial/Hybrid · 🟥 Mock · ⛔ Broken/Not built · ↪️ Re-export.
5. **`SEED` is `src/store/initialData.ts`.** Reading `currentUser`/`prefs` from the store
   is legitimate session state and does *not* make a page 🟨 Hybrid — only rendering `SEED`
   **domain** data does. Doc 05 states this rule explicitly; follow it.

## Verification commands

`**` globs do NOT work in default bash — use `find -exec`, as below.

```bash
# page count (doc 05 portfolio table)
find src/app -name 'page.tsx' | wc -l                       # -> 42

# per-page data source: what each page reads from the store (doc 05 classification)
find src/app -name 'page.tsx' -exec sh -c \
  'printf "%-40s %s\n" "${1#src/app/}" "$(grep -ohE "const \{[^}]*\} = useStore\(\)" "$1")"' _ {} \;

# per-page API hooks
find src/app -name 'page.tsx' -exec grep -lE "from .@/apis/(hooks|services)" {} +

# frontend API calls (doc 01 §7)
grep -nE "apiClient\.(get|post|put|patch|delete)" src/apis/services/*.ts

# backend route inventory (doc 01 §7) — run from ../edms-backend
find src/modules -name '*.router.ts' -exec grep -hoE \
  "(\w*[Rr]outer|router)\.(get|post|patch|put|delete)\(" {} + | wc -l      # -> 74

# LOC figures quoted in the docs
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1  # -> 15862
```

## Superseded documents

`../out/DOCUMENTATION.md` and `../out/USER_FLOWS.md` describe endpoints that were never
built (`POST /documents/:id/route`, `POST /workflows/instances/:id/approve`,
`POST /users/invite`, `POST /circulars`) and a `multipart/form-data` upload path that does
not exist. **Do not treat them as current.** `docs/README.md` explains why.

Still authoritative: `../edms-backend/docs/edms_architecture.md` and
`../edms-backend/docs/codebase_rules.md`.
