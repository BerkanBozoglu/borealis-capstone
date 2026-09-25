---
name: Re-check
about: A row became stale because something upstream changed (usually opened automatically)
title: "Re-check ID: parameter name"
labels: re-check
---

**Row:** ID parameter name

**Why it is stale:** UPSTREAM-ID changed on YYYY-MM-DD, after this row was last checked on YYYY-MM-DD.

**To clear it:** look at the upstream change; if your row still holds, set `checked:` to today in `data/register.yaml` (and `changed:` too if the value changes) and commit:
`ID: re-checked, no change · reason · name`

Closing this issue is the acknowledgement.
