# BOREALIS systems dashboard

The team's live map of every subsystem, every shared number and every handoff
between two people's work — and a what-if sandbox to try a change before
anyone commits to it. It is a static site built from the YAML files in
`data/` and deployed to GitHub Pages on every push to `main`.

No accounts, no database, no approvals. Owners commit directly; the site
rebuilds (about a minute) and every page, tile, gauge, inbox and health check
that a changed row touches updates on its own.

**Precedence rule: the register is the truth for numbers; 01_MASTER_CONTEXT is the narrative.**
Where the Rev D.2 docs and `data/register.yaml` disagree, the site shows the doc
text with a small "superseded by <register ID>" marker.

## How changes happen here (07 §3)

**Own it → change it.** The owner of a row edits `data/register.yaml` (on GitHub's web editor or via Claude Code), sets `changed` and `checked` to today, and writes one commit line in decision-log format:
`TX-02: 200 → 1 mW · coordinator review, Class 2 baseline · Berky`

**Don't own it → propose it.** Open the sandbox, set the change, press *Propose*. A GitHub issue opens, assigned to the owner(s), with the share link and the modeled effect already in it. The owner commits or closes with a reason.

**Downstream → re-check, not approve.** When a row changes, every row in its `feeds_into` list becomes stale. Their owners see it in *Inbox* and in Discord. They clear it by re-checking their row (value may not change) and committing with `checked: today`.

**Measured beats modeled.** To record a measurement, change `tag: MEASURED`, fill `conditions:`, and link the evidence file under `evidence/`. Missing conditions = build fails = the change does not go live.

## Edit a row on GitHub in 5 steps

1. Open the row on the site and press **Edit on GitHub** (it tells you the line number), or open `data/register.yaml` on github.com and click the pencil icon.
2. Find the row (`- id: TX-02`) and change `value:` (and `tag:` if the confidence changed).
3. Set `changed:` and `checked:` to today's date, `YYYY-MM-DD`.
4. Scroll down to **Commit changes**, write the message as `ID: old → new · reason · name`, choose **Commit directly to the main branch**.
5. Wait about two minutes and reload the site. If the change broke a check, the Actions tab shows why and the site keeps the previous version.

## Run locally

```
npm i
npm run dev        # builds src/generated/data.json from data/*.yaml, starts Vite
npm run lint       # data checks; errors exit non-zero
npm test           # physics model, derived state, page tests
npm run build      # lint + typecheck + production build into dist/
```

## What is where

| Path | What |
|---|---|
| `data/register.yaml` | every shared parameter: value, unit, tag, owner, `feeds_into`, `changed`, `checked` |
| `data/subsystems.yaml` | the nine subsystems: owner, "Start here" intro (cited), gotchas from 01 §13 |
| `data/parts.yaml` | every part in 02_COMPONENT_REGISTER with its status ladder |
| `data/interfaces.yaml` | I-01…I-12, the handoffs between subsystems |
| `data/open_items.yaml`, `data/decisions.yaml` | 05 §3 and 05 §2 |
| `data/milestones.yaml`, `data/approvals.yaml` | fixed dates, test ladder, approvals |
| `data/presets.yaml`, `data/model.yaml` | sandbox presets, model constants and sandbox controls |
| `data/people.yaml`, `data/site.yaml` | team, repo settings, the workflow rules above |
| `src/model.ts` | the physics (pure functions, tested against 01 §4/§5) |
| `scripts/build-data.ts` | YAML → `src/generated/data.json` + `history.json` (from `git log`) |
| `scripts/lint-data.ts` | the checks; errors fail the build, warnings show in the health panel |
| `scripts/diff-register.ts` | what changed and what went stale (used by `.github/workflows/notify.yml`) |

Derived state (stale rows, subsystem status, inboxes, interface hash checks) is
computed at build time and is never typed by hand. A row is **stale** when a
row that feeds it changed after the row's own `checked` date.

## Privacy rule

This repository is public. **No emails, phone numbers, or regulatory
correspondence in this repo** — not in data files, not in evidence, not in
commit messages. Approvals are tracked here only as `not_sent · sent · received`.

## Setup notes (one-time)

- GitHub Pages: Settings → Pages → Source: **GitHub Actions**.
- Discord notifications: add the `DISCORD_WEBHOOK` secret, then uncomment the step in `.github/workflows/notify.yml`.
- `data/people.yaml`: fill in each person's `github` handle so issues can be assigned to them.
