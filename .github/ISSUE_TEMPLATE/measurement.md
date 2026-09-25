---
name: Measurement
about: Record a measurement that replaces a modeled, assumed or target value
title: "Measurement: ID parameter name"
labels: measurement
---

**Row:** ID (current value and tag: )

**Measured value:**  (unit: )

**Conditions** (all required; the build fails without them)
- Range (m):
- Received / optical power (dBm):
- Attenuation in the path (dB):
- Bandwidth (kHz):
- Temperature (°C):
- Evidence file (under `evidence/`, named `YYYY-MM-DD_<subsystem>_<what>.<ext>`, under 5 MB):

**Run ID / session header** (04 §4.1):

**YAML to paste into `data/register.yaml`:**

```yaml
  value: 
  tag: MEASURED
  changed: YYYY-MM-DD
  checked: YYYY-MM-DD
  conditions:
    range_m: 
    power_dbm: 
    attenuation_db: 
    bandwidth_khz: 
    temperature_c: 
    evidence: evidence/YYYY-MM-DD_subsystem_what.ext
```
