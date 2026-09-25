# 07 — Systems Dashboard: plan and kickoff prompt
**Status:** proposed 2026-09-25 · mockup v2 reviewed by Berky · not yet built
**Owner:** Berky (product) · build delegated to Claude Code · content owned by each subsystem owner

---

## 1. What it is, in three lines

One website the whole team opens. It shows every subsystem, every number that crosses a team boundary, every handoff between two people's work, and who has to look at what today. Anyone can try a change in a sandbox and see what it breaks before anyone commits to it.

The numbers live in one file in the team's GitHub repo. The site rebuilds itself whenever that file changes. Nobody approves anything; everybody sees everything.

---

## 2. Decisions already made (do not re-litigate without a reason)

| # | Decision | Why |
|---|---|---|
| D1 | **Git-backed, no database, no accounts.** Data is YAML files in the repo; the site is static. | Zero admin. History and "who changed what" come free from git. Any team member can point Claude Code at the repo and say "update TX-02, log the reason". |
| D2 | **Owners commit directly to `main`. No pull-request gate, no approvals.** | Berky is not a bottleneck; nobody is. Git makes every change reversible. |
| D3 | **Non-owners propose, owners decide.** A proposal is a GitHub issue pre-filled by the sandbox with the change, its ripple and a share link. | Keeps one hand on each number without blocking anyone. |
| D4 | **"Stale" is computed, never typed.** A row is stale if anything upstream of it changed after the row's own `checked` date. Owners clear it by re-checking and committing. | No status field to forget. The site cannot show a green box that should be amber. |
| D5 | **A measured value must carry its conditions** (range, power, attenuation, bandwidth, temperature) or the build fails. | This is the project's own rule from the master context, enforced by a machine. |
| D6 | **The build fails if a core (C1–C5) row depends on a flight (E-track) row.** | Rule #1 of the project, enforced. |
| D7 | **Hosting: GitHub Pages, public repo.** Private alternative: Cloudflare Pages + Cloudflare Access (free for up to 50 users, email one-time-PIN). Vercel's free plan cannot restrict a production site to a team, so it is out. | One login (GitHub) for everything. A public dashboard doubles as the build-in-public showcase for the newsletter. Rule: no emails, phone numbers or regulatory correspondence in the repo. |
| D8 | **Notifications through a Discord webhook** on every change to the register (or whatever chat the team already uses; Slack works the same way). | People read chat; nobody refreshes a dashboard. |
| D9 | **Physics model lives in one file (`src/model.ts`) with unit tests pinned to the numbers in 01_MASTER_CONTEXT.** | The sandbox and the project files can never disagree. |
| D10 | **The register is the truth for numbers.** 01_MASTER_CONTEXT stays the narrative and is updated at each Rev. When they disagree, the register wins. | Two sources of truth is how this project got burned twice. |

---

## 3. The workflow, as the README will state it

**Own it → change it.** The owner of a row edits `data/register.yaml` (on GitHub's web editor or via Claude Code), sets `changed` and `checked` to today, and writes one commit line in decision-log format:
`TX-02: 200 → 1 mW · coordinator review, Class 2 baseline · Berky`

**Don't own it → propose it.** Open the sandbox, set the change, press *Propose*. A GitHub issue opens, assigned to the owner(s), with the share link and the modeled effect already in it. The owner commits or closes with a reason.

**Downstream → re-check, not approve.** When a row changes, every row in its `feeds_into` list becomes stale. Their owners see it in *Inbox* and in Discord. They clear it by re-checking their row (value may not change) and committing with `checked: today`.

**Measured beats modeled.** To record a measurement, change `tag: MEASURED`, fill `conditions:`, and link the evidence file under `evidence/`. Missing conditions = build fails = the change does not go live.

**Interfaces.** The upstream owner drafts the one-line spec in `data/interfaces.yaml`. The downstream owner edits it until they can build against it, adds their name, and sets `status: agreed`. If the spec text changes later, status drops back to `draft` automatically.

**Weekly, 10 minutes.** The Monday sync opens the dashboard's *Stale* list and *Missing interfaces* list and assigns each one. That ritual is worth more than any feature below.

---

## 4. Phases

### Phase 0 — Berky, about 20 minutes, before running Claude Code
1. Create a GitHub organisation `borealis-capstone` (free) and a repo `dashboard` (public, or private if the team objects). Invite all five teammates as members with write access.
2. Put `06_PARAMETER_REGISTER.csv` (from this Project) in the repo root as `seed/register.csv`. Also copy `01_MASTER_CONTEXT.md`, `02_COMPONENT_REGISTER.md`, `04_ENGINEERING_PLAYBOOKS.md` and `05_DECISION_LOG_and_OPEN_ITEMS.md` into `docs/`. Claude Code seeds every subsystem page from these, so the pages start accurate instead of invented.
3. Create a Discord channel `#borealis-changes` → channel settings → Integrations → Webhooks → copy the URL. Add it to the repo as a secret named `DISCORD_WEBHOOK` (Settings → Secrets → Actions).
4. Enable GitHub Pages: Settings → Pages → Source: GitHub Actions.
5. Open Claude Code in the repo folder and paste the prompt in the appendix.

### Phase 1 — Claude Code, one session: "a working site by tonight"
- Scaffold (Vite + vanilla TypeScript, no framework), YAML data files seeded from the CSV and from `docs/`, `model.ts` with tests, five page types (map, subsystem, sandbox, interfaces, register), lint checks, GitHub Pages deploy.
- **Every subsystem gets a page.** One template, nine subsystems (transmitter, optics, receiver, firmware, ground software, tracking, power, safety, flight). Nothing on a page is typed into the page: it is all pulled from the data files, so one edit to `register.yaml` changes every page, tile and gauge that number touches, on the next rebuild (under two minutes).
- **What a subsystem page shows, and where each part comes from:** Start-here intro and gotchas (01 §3, §6, §7, §13) · parameters with tag, stale reason, owner, history (register) · parts with their status ladder candidate → ordered → received → bench-verified → integrated (02, by section: A = transmitter, B = receiver, C = optics and mount, D/E = flight, F = ground software) · interfaces touching it (interfaces.yaml) · open items with owner and due date (05 §3) · decisions that shaped it (05 §2, filtered by area) · depends-on and feeds-into · Edit on GitHub on every field · "changed since you last looked" highlights.
- Done when: the site is live, all nine subsystem pages exist and their parameter counts match the register, the sandbox reproduces −53.3 dB / −35.8 dBm / +14.2 dB / 15.9 mV for the Rev D.2 baseline, and a change to `register.yaml` on GitHub shows on every affected page within two minutes.

### Phase 2 — Claude Code, second session, within two weeks
- Discord notification on every register change: what changed, by whom, which rows went stale, tagged owners.
- Auto-created "Re-check" issues per stale row, assigned to the owner; closing the issue is the acknowledgement.
- History panel per row from `git log`.
- Measurement entry form that generates the YAML block to paste.

### Phase 3 — content, owned by the team, ongoing
- Each owner writes their interface lines (I-01 … I-12). I-06 and I-07 first; they gate October.
- Each owner writes the 4-line "Start here" for their subsystem and picks their top gotchas from 01 §13.
- Safety block mirrors 03's status lines exactly: `not sent · sent · received`.

---

## 5. What Berky was not considering (now in the design)

1. **Interfaces, not just parameters.** Integration fails at the handoffs (logic levels, connectors, packet formats), not inside the boxes. The interface list is the single most useful thing here for February. Right now 0 of 12 are agreed.
2. **Nobody keeps a dashboard alive by goodwill.** The 10-minute Monday ritual and the Discord feed are the real product; the site is the display.
3. **Stale must be automatic**, or it will be wrong within a week.
4. **The site should refuse to lie.** Build-time checks: dangling IDs, core-depends-on-flight, measured-without-conditions, links that do not close, filter/laser mismatch.
5. **Onboarding.** A sixth member is joining. Every subsystem page opens with plain-language "Start here" and the gotchas that bit previous revisions.
6. **Public vs private** is a real decision with real consequences for hosting (D7). Decide before Phase 0.
7. **Two truths.** The register and 01_MASTER_CONTEXT must have a precedence rule (D10) or they will drift.
8. **The Class 2 problem is not a dashboard problem.** The sandbox shows that C1 at 1 mW/660 nm is about −10 dB on paper and that narrowing to 20 mrad at 5 kbps gets it to about +5 dB (modeled; pointing tolerance drops to ±0.57°). C2 only closes at around 100 m instead of 300 m. That decision is Berky's and Zhang's, before Oct 4, and the tool cannot make it.

---

## 5b. Keeping the site and this Claude Project in step (optional, no build)

Teammates who ask questions in this Claude Project get answers from the files here, not from the repo. Two cheap ways to keep them aligned:
- Each subsystem page carries a link "Ask the project assistant" that opens this Claude Project. Zero build; the Project already knows the docs.
- A weekly scheduled task in this Project pulls `data/register.yaml`, `interfaces.yaml` and `parts.yaml` from the repo and writes them into the Project files, so answers here use the current numbers. Ask for it once the repo exists.

---

## 6. Risks and assumptions

- Assumes the team is comfortable editing a YAML file on GitHub. If a week in they are not, Phase 2 adds an in-page edit form that writes the commit through GitHub's API (still no backend; needs each person's GitHub login).
- Assumes Discord. If the team is on WhatsApp, there is no free webhook; fall back to GitHub notifications (issues assigned to people).
- Assumes the repo is also where firmware and ground software will live (`firmware/`, `ground/` folders later). If the team wants separate repos, the dashboard stays in its own repo and links out.
- The responsivity values in the sandbox (0.50 A/W at 850 nm, 0.40 at 660 nm) are ASSUMED from the BPW34 curve shape; Bilal replaces them from the datasheet in Phase 3.

---

## Appendix — Claude Code kickoff prompt (paste as one message)

```
You are building the BOREALIS systems dashboard: a static website, generated from YAML data files in this repo, deployed to GitHub Pages. Read seed/register.csv first; it is the seed data. Then read docs/01_MASTER_CONTEXT.md, docs/02_COMPONENT_REGISTER.md and docs/05_DECISION_LOG_and_OPEN_ITEMS.md in full: every piece of content on the site must trace to one of these files or to the CSV, cited by section (e.g. "01 §7.2"). Do not invent specifications, part numbers or dates; where the docs say [TBD], the site says TBD. Read this whole prompt before writing any code. Ask nothing; make reasonable choices and list them at the end.

## The one rule that matters most
Nothing on any page is typed into that page. Every page is rendered from data/*.yaml through one template per page type. A change to one row in data/register.yaml must change every page, tile, gauge, inbox and health check that row touches on the next build. If you find yourself writing a number or a name into a page template, stop and move it to a data file.

## Purpose
A 6-person university capstone team (free-space optical laser link with autonomous telescope tracking) needs one place that shows: every subsystem, every shared parameter with its owner and confidence tag, every interface between subsystems, what is stale, and a what-if sandbox where anyone can try a change and see what it affects before anyone commits to it. No accounts, no database, no approvals. Owners commit directly; the site rebuilds.

## Stack
- Vite + vanilla TypeScript, no UI framework. One index.html, hash routes: #/ (map), #/s/<subsystem> (subsystem page), #/sandbox?<ID>=<value>&... (sandbox, state fully in the URL so it can be shared), #/interfaces, #/register, #/inbox/<person>.
- Data in data/*.yaml, parsed at build time into a single src/generated/data.json by scripts/build-data.ts. The browser never parses YAML.
- src/model.ts: the physics. Pure functions, no DOM. Unit tests with vitest pinned to the numbers below.
- scripts/lint-data.ts: validates the data and FAILS the build on errors (see Checks).
- GitHub Actions: on push to main → lint → test → build → deploy to GitHub Pages. Also on pull_request → lint + test only.
- Fonts from Google Fonts: Barlow Condensed (display), IBM Plex Sans (body), IBM Plex Mono (numbers/IDs). Dark theme: background #0A1120, card #101A2F, border #1D2A47, text #E6EAF2, muted #A9B5CC, accent #7AA2FF, ok #4FD1A5, warn #F5B642, bad #FF7C86. Status marks must differ in shape as well as colour (circle = ok, square = re-check, diamond = broken).
- No emoji. Icons are inline stroke SVG, one per subsystem (laser beam for transmitter, telescope for optics, circuit board for receiver, chip for firmware, laptop for ground software, crosshair for tracking, battery for power, shield for safety).

## Data files (create these, seeding from seed/register.csv)

data/subsystems.yaml — list of:
  id (transmitter | optics | receiver | firmware | ground | tracking | power | safety | flight)
  name, owner (person id), icon, track (core | flight), intro (3–5 plain-language sentences for a newcomer, written from 01 §3, §6 and §7 for that subsystem, cited), gotchas (list of {n, text} taken verbatim from 01 §13, choosing the ones that apply to this subsystem), doc_refs (list of section references such as "01 §7.2", "02 B", "04 §2.2"), register_prefixes (e.g. receiver: [RX]).

data/parts.yaml — every entry from docs/02_COMPONENT_REGISTER.md, one row per part (A1…A6, B1…B5, C1…C7, D1…D2, E1…E10, F, G, H1…H8, I). Each: id, subsystem (A→transmitter, B→receiver, C→optics except C4–C6→tracking, D/E/I→flight, F→ground, G→flight, H→safety for eyewear/stops and optics for instruments), role (one line from the doc), status (candidate | ordered | received | bench-verified | integrated | flight-qualified; seed everything as candidate, exactly as 02 states), chosen_part (string or TBD), fields (list of {name, value} copied from the doc's Fields line, TBD kept as TBD), gotchas (from the doc's Gotchas line), downstream (from the doc's "Parameters that matter downstream" line, as free text), track (core | flight).

data/open_items.yaml — the 20 rows of 05 §3 verbatim: n, item, why, closing_action, owners (person ids), due (free text as written), subsystem (your best mapping; the ground software item maps to ground, EHS/TC/insurance to safety, site pair to power). If `gh auth status` succeeds, ALSO create one GitHub issue per row with labels `open-item` and `subsystem:<id>`, assignee = first owner's github handle, and record the issue number back into the yaml; if gh is not authenticated, skip that and say so.

data/decisions.yaml — every bullet of 05 §2 as {date, area, decision, reason, evidence, changes, owner, subsystems (list, your mapping)}. Subsystem pages show the decisions mapped to them.

data/people.yaml — id, name, role, github (handle), subsystems (list). Seed: berky (Berkan; optics/link, systems, safety, PM), bilal (receiver, RF, PCB), batu (embedded/firmware), shabazz (power, structures, field), matei (controls/tracking), open (ground software seat, unassigned).

data/register.yaml — list of parameters. Each:
  id (e.g. TX-02), name, subsystem, value (number or string), unit, tag (MEASURED | VERIFIED | MODELED | ASSUMED | TARGET | DECIDED | TBD), owner, feeds_into (list of ids), source (free text), track (core | flight), changed (date), checked (date), note, conditions (only when tag is MEASURED: range_m, power_dbm, attenuation_db, bandwidth_khz, temperature_c, evidence (path under evidence/)).
  Seed every row from seed/register.csv. Map the CSV column class2_flag as follows: CHANGED → changed: 2026-09-24, checked: 2026-09-24; RE-CHECK → checked: 2026-09-12 (so it computes as stale); OK → checked: 2026-09-12 and changed: the CSV last_changed. Rows whose id starts with FLT get track: flight; all others core.

data/interfaces.yaml — list of:
  id (I-01…), from (subsystem id), to (subsystem id), what (one-line spec), owners (list of person ids), status (agreed | draft | missing), spec_hash (computed at build: sha1 of `what`; if status is agreed and the stored spec_hash differs from the computed one, the build downgrades status to draft and warns), gap (what is missing), blocks (free text, e.g. "October parallel work").
  Seed these twelve:
  I-01 firmware→transmitter: TTL gate line, 100 kchip/s Manchester, 3.3 V logic, rise/fall <1 µs, idle = laser off. owners batu, shabazz. draft.
  I-02 power→transmitter: driver set current, compliance voltage, overshoot limit, key switch in supply path. shabazz, berky. draft.
  I-03 transmitter→optics (through air): wavelength, divergence, on-state power — the link budget. berky. draft (was agreed at Rev D.2; reopened by Class 2 change).
  I-04 optics→receiver: detector at focal plane, filter and field stop in front, focus travel for 50 m to 1 km. berky, bilal. missing.
  I-05 receiver internal: photodiode capacitance at chosen bias, bias voltage, lead length. bilal. draft.
  I-06 receiver→firmware: comparator output logic level, connector, STM32 timer pin, expected chip timing. bilal, batu. missing. blocks October parallel work.
  I-07 firmware→ground: USB serial baud, packet framing, one line per SSDV packet plus status words. batu, open. missing. blocks ground software start.
  I-08 tracking→ground: guide camera USB frames ≥10 fps, mono, exposure control from software. matei, open. draft.
  I-09 ground→tracking: rate-mode mount commands over SynScan/INDI, command latency, backlash. matei, open. draft (protocol proof due October).
  I-10 optics→tracking: total mass ≤3.5 kg, dovetail, boresight rigid between tubes. berky, matei. draft.
  I-11 power→all outdoor: voltages, connectors, run time for mount, laptop, camera, transmitter. shabazz. missing.
  I-12 ground→transmitter: command channel for shutter demo and TX on/off. open, berky. missing.

data/milestones.yaml — fixed dates: 2026-10-04 Phase 1 report; 2026-11-27 final design approval; 2026-11-29 Phase 2 report; 2027-02-15 (week of) in-lab pre-demo; 2027-03-22 (week of) in-lab final demo; 2027-04-02 final report. Test ladder rungs: 1 bench through filters; 2 corridor 50–80 m; 3 mount tracks a moving LED; 4 outdoor 200–300 m; 5 ≥1 km; 6 flight gates G1–G5 (track: flight). Each rung: status (not_started | in_progress | passed) and blocked_by (list of register or interface ids). Seed rung 1 as not_started, blocked_by [BUD-01, OPT-03].

data/approvals.yaml — id, name, authority, status (not_sent | sent | received), date, note. Seed: EHS registration for Class 3B upgrade (not_sent); TC CAR 601.21 inquiry (not_sent); LSO room plan for C3 (not_sent); NAV CANADA NOTAM (not_sent, track flight); university insurance/field ops (not_sent, track flight). The UI must never display an approval as obtained unless status is received.

## Derived state (computed in build-data.ts, never typed by hand)
- stale(row) = exists r in upstream(row) with r.changed > row.checked, where upstream = rows whose feeds_into includes row.id. Show the stale reason (which upstream row, when).
- subsystem status: broken if any of its rows fails a Check below or any interface touching it is missing; re-check if any of its rows is stale; else ok.
- confidence per subsystem: counts of rows by tag.
- inbox(person) = stale rows they own + interfaces they are an owner of with status != agreed + open GitHub issues assigned to them with label proposal or re-check (fetch client-side from the GitHub API, unauthenticated; if the fetch fails, show the first two lists only).

## Physics model — src/model.ts (must match these numbers exactly; write vitest tests for each)
Inputs (with register ids): pmW = TX-02, nm = TX-01, mrad = TX-06 (narrow beam, C1/C3), c2mrad = TX-07 (200), range_m = SYS-04, c2range_m = SYS-05, apMM = OPT-01, kbps = SYS-02, sens50_dbm = RX-02, rf_kohm = RX-04, txOpticsLoss_db = 1.0, atmRxLoss_db = LNK-04 (4.5), diffuserLoss_db = TX-08 (0), detectorSide_mm = 2.7, fl_mm = OPT-02 (use 750 when a range is given).
  responsivity(nm) = 0.50 if nm==850 else 0.40  (ASSUMED; tag it so in the UI)
  ptx_dbm = 10*log10(pmW)
  spot_m = mrad/1000 * range_m
  capture_db = 20*log10((apMM/1000)/spot_m)
  prx_dbm = ptx_dbm − txOpticsLoss_db + capture_db − atmRxLoss_db        (on-state; average is 3 dB lower — show both)
  sens_dbm = sens50_dbm + 5*log10(kbps/50) + 10*log10(0.5/responsivity)
  margin_db = prx_dbm − sens_dbm
  pointing_half_deg = (mrad/2) * 180/π / 1000
  i_a = 10^(prx_dbm/10)/1000 * responsivity;  v_tia = i_a * rf_kohm*1000
  att50_db = 20*log10(range_m/50)   (indoor attenuation to mimic the C1 received power at 50 m)
  c2: same chain with c2mrad and c2range_m, minus diffuserLoss_db
  fov_mrad = detectorSide_mm / fl_mm * 1000
  Test values for the Rev D.2 baseline (pmW 200, nm 850, mrad 60, range 1000, apMM 130, kbps 50, sens50 −50, rf 120): capture −53.3, prx −35.8, margin +14.2, v_tia 15.9 mV, att50 26.0, pointing ±1.72°. For 850 nm/200 mW at 50 m with no attenuation: v_tia ≈ 6.4 V (saturation warning above 4 V). For pmW 1, nm 660, everything else baseline: margin ≈ −9.8. For pmW 1, nm 660, mrad 20, kbps 5: margin ≈ +4.8 and pointing ±0.57°.

## Pages
1. #/ Map: header with next milestone countdown; stat tiles (C1 margin with baseline struck through, stale count, interfaces agreed x/12, measured count, open issues); test ladder strip with current rung and what blocks it; data path row (transmitter → optics → receiver → firmware → ground) with interface chips between blocks showing id + status; support row (tracking, power, safety); "recent changes" list from git log of data/register.yaml (last 10 commits; generate at build time with `git log --format` into generated/history.json) — clicking one highlights every subsystem it touches; health checks panel listing every warning/error from lint; a "How changes happen here" panel with the four workflow rules. Toggle "show flight track" (default hidden) that hides every track: flight item everywhere.
2. #/s/<id> Subsystem — one template rendered for all nine subsystems; every block on the map is a link to its page. Sections, in order: icon, owner, status, doc_refs; "Start here" intro + gotcha chips (each chip shows its number from 01 §13); confidence bar by tag; parameters table (its rows from the register: value, unit, tag, stale reason with the upstream row and date, owner) each with "Edit on GitHub" (opens data/register.yaml in GitHub's web editor) and a "History" expander (from generated/history.json, filtered to that id); parts table from parts.yaml (id, role, chosen part or TBD, status ladder drawn as five steps, TBD fields listed) each with Edit on GitHub; interfaces touching it with status; open items from open_items.yaml (and live issue state from the GitHub API when reachable); decisions from decisions.yaml mapped to it; depends-on and feeds-into as lists of linked rows; "Re-check" button that opens GitHub's editor with instructions to set checked: today; "Try a what-if" link that opens the sandbox scoped to its inputs; "changed since you last looked" — highlight rows whose changed date is after the timestamp stored in localStorage for this page, and update that timestamp on leave.
3. #/sandbox: left column inputs (power as pills 1/5/20/50/100/200 mW; wavelength 660/850; divergence slider 10–100; C1 range 200–1500; C2 range 100–500; bit rate 5/10/25/50; aperture 114/130/150/200; sensitivity −60…−40; TIA resistor 10–500 kΩ), each labelled with its register id and owner; presets: "Rev D.2 baseline", "Committed now" (values from register.yaml), and any preset listed in data/presets.yaml; right column: C1 and C2 margin gauges (−20…+20 dB, zero line, colour by threshold 0/6 dB), "everything downstream" grid (received power on-state and average, spot size, pointing tolerance, TIA output at range and at 50 m with saturation flag, indoor attenuation, FOV), "changed from committed" list, "who has to look" list (owners of changed inputs = decide; owners of feeds_into rows = re-check), share URL (the current hash), Propose button → opens https://github.com/<org>/<repo>/issues/new?title=…&body=… with labels proposal, the share link, the modeled before/after, and the owners; Reset. All state in the URL hash. Every output labelled MODELED.
4. #/interfaces: table (id, from→to, what, owners, status, gap, blocks), counts by status, sorted missing → draft → agreed; each row has "Edit on GitHub".
5. #/register: full table with filters by status (stale / changed in last 14 days / ok), subsystem, tag, owner; search box; each row: Edit on GitHub, history.
6. #/inbox/<person>: the derived inbox; a person picker at the top (no login; remember choice in localStorage only).

## Checks (scripts/lint-data.ts) — errors fail the build, warnings show in the health panel
Errors: unknown id in feeds_into; unknown owner or subsystem; duplicate ids; MEASURED row without complete conditions; core row whose feeds_into (transitively) contains a flight row; interface from/to not a subsystem; approval status not in the enum; any non-ASCII quote characters in ids.
Warnings: computed C1 margin < 0 with committed values; filter passband (OPT-03, parse "850/40") does not contain TX-01 wavelength; any row with tag TBD older than 30 days; interfaces with status missing that are in a rung's blocked_by; rows with no feeds_into and no note (probably incomplete); people with zero rows.

## GitHub integration (Phase 2 — scaffold the workflow files now, leave the Discord step commented with a TODO)
.github/workflows/deploy.yml as described. .github/workflows/notify.yml: on push to main touching data/register.yaml or data/interfaces.yaml → run scripts/diff-register.ts against the previous commit → post to the DISCORD_WEBHOOK secret: who, what changed (id: old → new), commit message, list of rows that became stale with their owners' names → and open one GitHub issue per newly stale row (label re-check, assignee = owner's github handle, body = why it is stale and the link to the row) unless an open one already exists for that row. Issue templates: proposal.md, re-check.md, measurement.md (measurement template asks for range, power, attenuation, bandwidth, temperature, evidence file).

## Repo files to write
README.md: what this is, the four workflow rules verbatim from above, how to edit a row on GitHub in 5 steps with screenshots omitted, how to run locally (npm i, npm run dev), precedence rule ("the register is the truth for numbers; 01_MASTER_CONTEXT is the narrative"), and the privacy rule (no emails, phone numbers, or regulatory correspondence in this repo).
CONTRIBUTING.md: commit message format `ID: old → new · reason · name`; when to add a decision-log entry; how to record a measurement.
evidence/README.md: naming convention YYYY-MM-DD_<subsystem>_<what>.<ext>, keep files under 5 MB.

## Definition of done for this session
- npm run lint, npm test, npm run build all pass; tests pin the numbers above.
- Site deploys to GitHub Pages from main.
- All nine subsystem pages exist and are reachable from the map. For each, the number of parameter rows equals the count of register rows with that subsystem, and the number of parts equals the count of parts.yaml rows with that subsystem (write this as a test).
- Every intro, gotcha, part, open item and decision on the site carries a doc citation, and lint fails on any subsystem whose intro is empty or whose gotchas list is empty.
- Changing a value in data/register.yaml on GitHub's web editor shows on the map tile, the register, the owner's inbox and the subsystem page within two minutes; changing TX-02 makes RX-04 stale on the receiver page without anyone touching RX-04 (write this as a test of the derived-state code).
- The sandbox URL #/sandbox?TX-02=1&TX-01=660&TX-06=20&SYS-02=5 opens with those values applied and shows C1 margin ≈ +4.8 dB.
- Print a short list of the choices you made, every place where the docs were ambiguous and what you chose, and anything you could not do.
```
