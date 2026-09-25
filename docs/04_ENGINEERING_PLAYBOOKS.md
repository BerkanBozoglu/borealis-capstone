# 04 — Engineering Playbooks
Procedures, troubleshooting trees, templates and conventions for building, testing and debugging BOREALIS. Written to be followed, not admired. Every procedure ends in a logged record.

---

## §1 The test ladder (never skip a rung)

| Rung | Where | What must be true before | What we prove | Log artifact |
|---|---|---|---|---|
| 1 | Bench, controlled path | driver current-limited; eyewear; key switch | LED → PIN → TIA waveform; then attenuated laser; one byte, then one image | R1-bench-YYYYMMDD |
| 2 | Corridor 30–80 m | Rung 1 passed; EHS bench approval; ND attenuation calibrated | first real alignment; focus/boresight procedure; image transfer | R2-corridor-… |
| 3 | Outdoor 200–300 m, night | Rung 2; outdoor procedure approved; site permission | outdoor routine; guide loop on the real dot; cold/wind | R3-outdoor-… |
| 4 | ≥1 km surveyed pair | Rung 3; site package; permitted beam direction | C1 acceptance run (≥10⁷ reference bits) | R4-range-… |
| 5 | Mount rate test (indoor, moving LED) | AZ-GTi protocol library working | rate-mode command, latency, residual error, backlash | R5-mount-… |
| 6 | Moving carrier 300 m | Rungs 3+5; 200 mrad diffuser measured | C2 acceptance: acquire, track, blackout 1/5/15 s, re-acquire | R6-track-… |
| 7 | Indoor attenuated 50–80 m | Rungs 4+6; LSO room plan | C3 demo script rehearsal ×3 | R7-lab-… |
| 8 | Field day / hoisted payload (E-track) | core complete | G1 pointing demo; deployment drill | R8-field-… |

---

## §2 Procedures

### 2.1 Bench link (Rung 1)
1. Eyewear on, key out, door sign up, buddy present.
2. Build the receiver on the bench with a **PIN diode, no telescope**. Verify TIA transfer function with a modulated LED first (scope on TIA out): expect clean square-ish chips at 100 kchip/s, no ringing (>20% overshoot = stability problem → fix Cf before proceeding).
3. Replace LED with the laser through the ND stack. Measure detector-plane power with H1. Target the C1 level: −35.8 dBm (0.26 µW). Record OD actually needed.
4. Transmit a known bit sequence (PRBS or the fixed reference file). Count errors pre-FEC and post-FEC. Record BER vs received power at 5–6 power levels → first sensitivity curve.
5. Transmit an image. Record time to complete, packets lost.
Pass: image received; BER curve logged; TIA stable at all gain settings used.

### 2.2 Receiver characterization
- **Sensitivity:** BER vs received power (H1-calibrated), at the operating chip rate, dark room and with a lamp on (background). Report the power for BER 1e-5 pre-FEC and post-FEC.
- **Angular acceptance:** rotate the assembled OTA+detector in az and el with a fixed source at ≥30 m; record power vs angle; FWHM in both axes is the receiver FOV. Do this for every focus/boresight configuration.
- **Stability:** step-response with a chopped source; overshoot/ringing per gain setting.
- **Overload:** apply the 50 m power level; measure time to recover after removal.
- **Background:** point the assembled receiver at the daytime and twilight sky (never near the Sun); log DC level and noise floor through the real filter.

### 2.3 Transmitter beam measurement
- Far-field: project onto a screen at ≥10 m (indoors, attenuated), image with the IR camera, fit the spot; compute full-angle at 50% and at 10% intensity in X and Y. Repeat with the diffuser. Record insertion loss with H1 (power before/after).
- Wavelength: if a spectrometer is available (Zhang/Kahrizi labs), measure λ at 20 °C and after 10 min warm-up; otherwise measure power through the 850/40 filter vs without (transmission ≥80% means the diode is inside the passband).
- Driver: rise/fall, overshoot, modulation depth (residual light in the "off" chip must be <5% of on-state).

### 2.4 Focus and boresight at each range (do before every session)
1. Focus: with the source at the test range, adjust focuser for maximum detector power (H1 or TIA DC). Record focuser position vs range (expect ~11 mm shift 50 m↔∞ for 750 mm FL).
2. Boresight: center the source in the guide camera; note detector power; iterate the guide-scope alignment until guide-center = detector-max. Record pixel offset vs range (expect ~3.8 mrad shift between 1 km and 50 m).
3. Write both into the session header. No run starts without them.

### 2.5 Mount rate-tracking proof (Rung 5, October gate)
1. Command a constant az rate via the protocol; measure actual rate with the guide camera on a fixed target (encoder if available).
2. Measure command latency: timestamp a command, observe motion start in video.
3. Track a moving LED on a rail/cart across a room at 0.2, 0.5, 1.0°/s; record residual centroid error and lag.
4. Reverse direction; measure backlash dead-band in az and el.
Pass criteria [TARGET]: latency <150 ms; residual <2 mrad at 0.3°/s; backlash characterized and compensated in software.

### 2.6 C2 acceptance run
Preconditions: site permission, LSO outdoor approval, surveyed station position, carrier path marked, diffuser fitted, ND calibrated.
1. Seed pointing with the carrier's known start position (±2°). Start SEARCH. Log time to TRACK (t_acq).
2. Move carrier at walking speed along the marked path (±3 m lateral at 300 m). Log tracking error and goodput.
3. Shutter the **receiver aperture** 5 s: expect goodput → 0, tracking continues, goodput resumes. Log.
4. Shutter the **transmitter** 1 s / 5 s / 15 s: expect COAST → (SEARCH) → TRACK; log t_reacq each.
5. Repeat step 2–4 three times.
Pass: all re-acquisitions within t_reacq [TARGET]; BER/goodput within spec during TRACK.

### 2.7 C3 demo script (two minutes) — rehearse ×3
0:00 idle · 0:10 acquire (SLEW→SEARCH→TRACK) · 0:30 image building; acceptance panel live · 1:00 carrier moves (0.2 m/s, ±0.5 m) · 1:20 receiver shutter (data stops, tracking holds, resumes) · 1:40 transmitter shutter (COAST→SEARCH→TRACK; recovery time shown) · 2:00 image complete, BER shown.

### 2.8 Laser operating procedure (campus, Class 3B) — skeleton for the LSO plan
Roles: operator (key), safety observer (buddy). Pre-op: eyewear check, beam path clear and terminated, signage, key inserted last. During: no one enters the NOHD zone (~2 m) without eyewear; no viewing optics into the beam; carrier moves only along the approved path. Post-op: key out, log entry. Any incident: stop, key out, report to LSO.

### 2.9 Cold/vacuum qualification (E3, extended)
Full payload, flight harness, flight battery pack; 3 h profile: −40 °C soak (dry ice cooler) or vacuum chamber to ~10 mbar if available; log every temperature, bus voltage, laser current, GNSS status; run the link through the lid; verify wavelength stays in-filter (power through filter).

---

## §3 Troubleshooting trees

### 3.1 "No signal at the receiver"
1. **Measure received power with H1 at the detector plane.** If power is present → electrical problem (go to 3.2). If absent → optical problem:
   - Is the laser on? (visible LED beside aperture, IR camera on the aperture, current reading on the driver)
   - Is the TX aimed at the receiver? (mechanical sight; at 1 km the spot is 60 m — being off by a building is possible)
   - Is the receiver aimed at the TX? (guide camera shows the dot? if not → SEARCH manually)
   - Focus/boresight done at this range? (2.4)
   - Filter in the path and diode inside the passband? (power with/without filter)
   - Obstruction, window, condensation on the OTA?
2. Never assume a fault before measuring power.

### 3.2 "Power is there but no bits"
- TIA output on the scope: saturated flat top → overload (add ND); ringing → instability (Cf, compensation); noisy with no structure → gain/bandwidth wrong or DC background saturating (check DC level, reduce field stop, use DC restore).
- Comparator output: chips present but decoder fails → clock recovery/threshold; check chip rate (100 kchip/s) and Manchester polarity.
- Decoder: sync found but RS fails → burst errors (fading/mechanical vibration) or wrong packet format; test with the fixed reference file.

### 3.3 "Link works stationary, fails moving"
- Transmitter illumination: is the diffuser fitted? carrier rotation >±5.7°? (log carrier attitude; add a bubble level/IMU to the carrier).
- Receiver FOV: dot centered in guide camera but no data → boresight at this range not done (2.4).
- Tracking lag: residual error vs rate from 2.5; feed-forward on? latency crept up (USB, camera exposure)?
- Backlash on reversal: watch error spikes at direction change; compensate.

### 3.4 "Acquisition never locks"
- Seed error > guide field? (survey station position; level the mount; check heading reference).
- Search spiral too fast/coarse relative to the field and camera exposure?
- Camera can't see the dot (IR-cut window; exposure; false bright sources) — verify with a hand-held IR source at short range.
- Solar exclusion tripped?

### 3.5 "Re-acquisition fails after blackout"
- COAST rate wrong (carrier reversed while hidden) → shorter t₁ before SEARCH; add path prediction.
- Target left the guide field → widen SEARCH; longer blackout tests are stress tests until proven.

### 3.6 "Mount misbehaves"
- Commands accepted but no motion → protocol/rate command not supported as assumed (Rung 5 exists for this).
- Oscillation → loop gain too high for the latency; reduce gain, add prediction.
- Slew near zenith → alt-az singularity; plan paths away from zenith.
- Payload over 5 kg / unbalanced → weigh and balance.

### 3.7 "Firmware/decoder issues"
- DCMI overrun (flight) → DMA/cache handling; lower frame size.
- SD stalls block TX task → decouple with queues; logging is lower priority than modulation.
- Timer ISR jitter → hardware-timed modulation via timer/DMA, not bit-banging.
- GNSS altitude stops updating (flight) → dynamic model not set/persisted; read back CFG-NAVSPG-DYNMODEL.

### 3.8 "Flight power/thermal" (extended)
- Battery voltage collapse under laser load → cold cells/high per-cell current; warm, parallel strings, reduce laser duty.
- Diode power drops / wavelength drifts out of filter → diode too hot or too cold; thermal path; log diode temperature.

---

## §4 Templates

### 4.1 Session header (top of every log)
```
Run ID: R4-range-20261118-01
Config: C1 | TX: [diode P/N] [on-state mW] [divergence mrad] [ND OD] | RX: [PIN P/N] [Rf] [gain setting] | OTA [FL] focus pos [mm] | boresight offset [px]
Site: [A→B], distance [m] (surveyed), heights, weather, temp, wind
People: operator, observer; eyewear ✔ key ✔ signage ✔
Reference file/PRBS: [name/hash]
```

### 4.2 Run record (one row per run)
| Run | Received power (dBm, H1) | Chip rate | Pre-FEC BER (n bits) | Post-FEC BER (n delivered bits) | Packets sent/lost | Goodput (kbps) | Outage (s) | t_acq (s) | t_reacq 1/5/15 s | Tracking err RMS (mrad) | Notes |

### 4.3 Decision-log entry (05)
`YYYY-MM-DD · [area] · Decision: … · Reason: … · Evidence: [run ID or source] · Changes: [files/sections] · Owner`

### 4.4 Component change notice
`Part: … replaces … · Reason · Downstream parameters affected: [wavelength/filter, C/TIA, mass/mount, Vbr/bias, area/FOV, current/driver] · Re-tests required: [list]`

### 4.5 BOM row
`Item | P/N | Vendor | Qty | Unit CAD | Lead time | Role code | Status | Datasheet link | Notes`

---

## §5 Repository layout (proposed)
```
borealis/
  docs/            proposal, brief, this package, acceptance procedures, safety file
  hw/
    rx-board/      KiCad, BOM, test reports
    tx-driver/
    flight-avionics/
  fw/
    tx/            STM32 transmitter (SSDV, Manchester, timer/DMA)
    rx/            STM32 receiver (capture, clock recovery, sync, USB)
    flight/        payload firmware (FreeRTOS tasks, interlocks, GNSS)
  sw/
    groundctl/     Python app (decoder, assembler, mount, guide, acceptance)
    tools/         link budget model, beam analysis, log analysis
  tests/           run logs (CSV/JSONL), reference files, BER scripts
  ops/             site packages, SOPs, checklists, outreach tracker
```

## §6 Firmware and software conventions
- Hardware-timed modulation (timer + DMA); no bit-banged chips.
- Every interlock has a hardware path and a firmware path; firmware fails **off**.
- GNSS configuration is read back and logged at every boot; a mismatch is a fault.
- All logs timestamped (monotonic + wall clock); every run has a Run ID.
- Ground software: one thread per input stream; UI never blocks on I/O; state machine in one module with explicit transitions logged.
- Metrics computed from logs, not from UI state; the acceptance recorder is the source of truth for reports.
- Version everything; tag the firmware/software used for each acceptance run.

## §7 Things nobody puts on the list until they've lost a night to them
- Bring the H1 power meter to every session. Bring spare batteries for it.
- Bring the ND stack, the shutter, tape, a headlamp, hand warmers, a level, a compass, a printed checklist.
- Survey site distances with GPS/maps before the night; mark the carrier path in daylight.
- Charge the mount's battery; bring a 12 V pack; the laptop dies in the cold — keep it in a bag.
- Dew heater on the OTA before it fogs, not after.
- Never "quickly check alignment by looking down the tube." That is how eyes are lost.
- Two people, always. Log before leaving the site.
