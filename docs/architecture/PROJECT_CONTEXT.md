# PROJECT_CONTEXT.md

## 🔎 Identity

- **Product umbrella:** HoopZero / ScoutZero
- **Modules:**
  - **ScoutZero** – internal scouting (traits, roles, sub-roles, blurbs, video tagging).
  - **HoopZero (public)** – read-only player profiles.
  - **Architect (GM Tool)** – contracts, trades, cap management, full CBA logic.
  - (Others exist: Futures Tracker, Ranker — secondary).
- **Design values:** clarity, polished UI, clean exports, minimal friction.

---

## 🧰 Tech Stack

- **Frontend:** React + Vite + Tailwind
- **UI libs:** shadcn/ui, Lucide Icons
- **Data:** Firebase Firestore (app data), Firebase Storage (assets, video)
- **Testing:** Vitest
- **Deployment:** Vercel (preview deploys per PR)

---

## 🔐 Data & Collections

- `/players` – canonical player objects (bio, stats, traits, roles, blurbs).
- `/teams` – **read-only base data** (never mutated by GM tools).
- `/teamPlans` – user/GM actions (cap sheets, trades, exceptions, offseason).

---

## 🧱 Conventions

- **SCSP™:** Full-file replacements.
- **Plain English first.**
- **Imports:** Prefer alias paths (`@/components/...`).
- **Visuals:** Themed per team; ensure contrast/a11y.
- **Security:** Dev = open rules; Prod = restrict by `request.auth.uid`.

---

## 🧪 Testing & QA

- **Unit tests:** Vitest; CI must be green before merge.
- **Previews:** Each PR → Vercel preview; smoke test key flows.
- **Scope:** Avoid unintended global style/function cascades.

---

## 🔄 Typical Flows

- **Feature change:** Human → ChatGPT Body Prompt → Codex PR → tests + preview → review.
- **CBA logic change:** Isolate function → adjust unit tests → integrate → wire to UI.
- **UI tweak:** Scoped component change; prefer tokens for styling.

---

## 🧭 Decision Defaults

- **Images:** PNG headshots are fine (150–250 KB). Optimize dims; WebP only if analytics prove needed.
- **TypeScript:** Adopt incrementally (leaf → shared models → containers).
- **Caching:** Use TanStack Query for Firestore reads; immutable caching for assets.
- **Deployment:** Vercel is correct choice for stack.
