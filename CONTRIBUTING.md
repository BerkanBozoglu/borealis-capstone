# Contributing

## Commit messages

One line, decision-log format:

```
ID: old → new · reason · name
```

Examples:
- `TX-02: 200 → 1 mW · coordinator review, Class 2 baseline · Berky`
- `RX-04: re-checked, no change · <why it still holds> · Bilal`
- `I-06: draft → agreed · <what was agreed> · Batu`

Several rows in one commit: separate them with `;` before the first `·`.

## Owning and proposing

- Edit rows you own directly on `main` (see README, "Edit a row on GitHub in 5 steps").
- Rows you don't own: use the sandbox's **Propose** button, or open a *Proposal* issue.
- When your row goes stale, re-check it: set `checked:` to today (and `changed:` if the value moves) and commit.

## When to add a decision-log entry

Add an entry to `data/decisions.yaml` **and** to `docs/05_DECISION_LOG_and_OPEN_ITEMS.md` §2 when:
- a part is chosen (02 §J step 3),
- a `DECIDED` row changes value,
- a scope, safety, regulatory or schedule choice is made,
- an interface becomes `agreed`.

Format: `date · area · decision · reason · evidence · changes · owner` (04 §4.3). Map it to the
subsystems it affects in `subsystems:`. Never delete history; supersede it.

## How to record a measurement

1. Put the evidence file in `evidence/` as `YYYY-MM-DD_<subsystem>_<what>.<ext>` (under 5 MB; see `evidence/README.md`).
2. In `data/register.yaml`, on the row: set `value`, `tag: MEASURED`, `changed` and `checked` to today, and add (placeholder values shown)

   ```yaml
   conditions:
     range_m: <number>
     power_dbm: <number>
     attenuation_db: <number>
     bandwidth_khz: <number>
     temperature_c: <number>
     evidence: evidence/YYYY-MM-DD_receiver_ber-curve.csv
   ```
3. Commit: `RX-02: −50 → <measured> dBm · BER curve, run <run ID> · Bilal`.

All six conditions are required and the evidence file must exist, or the build fails and the
change does not go live. The *Measurement* issue template has the same checklist.

## Interfaces

The upstream owner drafts the one-line spec (`what`). The downstream owner edits it until they can
build against it, adds their name to `owners`, sets `status: agreed` and pastes the spec hash shown
on the Interfaces page into `spec_hash`. If `what` changes later, the build drops it back to draft.
