# Evidence

Files that back a `MEASURED` row in `data/register.yaml` (its `conditions.evidence` points here).

- Name: `YYYY-MM-DD_<subsystem>_<what>.<ext>` — e.g. `2026-10-14_receiver_ber-curve.csv`,
  `2026-10-20_transmitter_far-field-50pct.png`. `<subsystem>` is a subsystem id from `data/subsystems.yaml`.
- Keep each file under 5 MB. Link larger raw data from here instead of committing it.
- Include the run ID from the session header (04 §4.1) in the file or next to it.
- No emails, phone numbers or regulatory correspondence (see README, privacy rule).
