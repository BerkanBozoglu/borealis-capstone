# 05 — Decision Log and Open Items
**Live file.** Append entries in the format: `date · area · decision · reason · evidence · changes · owner`. Never delete history; supersede it.

---

## §1 Revision history (how the design got here)

| Rev | Date | What it was | What killed it / changed it |
|---|---|---|---|
| A | 2026-08-13 | Balloon optical downlink; 500 mW, 20 mrad nadir beam; 35 km slant; +15 dB margin; 8" Dob | Deep-dive research: payload pendulum makes a 20 mrad nadir beam useless; GPS stops >18 km; wavelength drift vs filter; 8" Dob too heavy for a tracking mount |
| B | 2026-09-02 | 2 W, 60 mrad, IMU gimbal; larger APD; portable OGS | First external review |
| C | 2026-09-03 | Dusk self-launch; ≤1.1 kg under CARs 602.42; uplink-gated TX; brushless gimbal; CAN-SBX as Flight 2 | First review found: nadir beam + downrange station geometrically impossible; CAR 601.21 missed; linear driver burns 25 W; APD bias/wavelength mismatch; 41 vs 50 kbps; sensors out of range; L91 cold capacity; OD 3 short; RSS-247; sequencing |
| D | 2026-09-07 | Station-directed pan/tilt pointing; 100 mrad; 5–10 kbps flight; gates G1–G5; Class 3B campus link with PIN; CAR 601.21 | Team lead: graded scope looked too large; second review |
| D.1 | 2026-09-08 | Scope re-tiered: core C1–C5 graded, flight E1–E5 gated; pointing gimbal moved to G1 | Second review found: "TX orientation irrelevant" wrong (±1.72°); PHD2 not precedent for 1°/s; indoor walking faster than car; re-acquisition needs states; two-shutter demo; focus/boresight shift; SFOC for drone laser; tethered rules |
| **D.2** | **2026-09-09** | **Reviewed brief: wide beam (200 mrad) + fixtured carrier for C2; rate-mode mount; state machine; C3 at 60 mrad, 0.2 m/s ±0.5 m; single FEC layer (SSDV); metrics defined; November ≥1 km attempt** | **Current baseline** |

---

## §2 Decisions (with reasons)

- 2026-09-03 · flight ops · **Self-launch designed under 3.256 m³ (CARs 602.42)** · avoid TC balloon authorization on critical path · CAR text · mass ceiling 1.1 kg · Berkan
- 2026-09-03 · flight · **Laser fires only on ground command with 40-min on-time budget** · power budget cannot carry 3 h of 6.5 W · energy calc · uplink command path · R3
- 2026-09-07 · flight arch · **Station-directed pan/tilt pointing replaces nadir beam** · nadir cone (~1.7 km at 28 km) cannot reach a station 20 km downrange · review finding 1 · gimbal spec, 100 mrad, 5–10 kbps · R5
- 2026-09-07 · safety · **Campus transmitter capped at ≤200 mW (Class 3B)**; 2 W stays on the bench under LSO until G5 · shrink EHS burden for graded work; NOHD ~2 m · MPE calc · budget line for a 3B diode · R1
- 2026-09-07 · regulatory · **CAR 601.21 inquiry covering rooftop, drone, balloon in one letter** · authorization required regardless of irradiance · CAR text · outreach 1.2 · Berkan
- 2026-09-07 · receiver · **PIN receiver is the graded baseline; APD is a flight gate** · campus has 14 dB margin; APD is the hard analog problem · link budgets · BOM · R2
- 2026-09-08 · scope · **Pointing gimbal demo moved from graded to gate G1** · flight likely after grading; only ground-station tracking needs grading · calendar · proposal deliverables · Berkan
- 2026-09-08 · C2 · **200 mrad diffuser + fixtured carrier; walking speed baseline; car optional after Rung 5** · pointing tolerance is an angle (±1.72° at 60 mrad) · review 2 · brief TB-04 · R1/R5
- 2026-09-08 · C3 · **Indoor demo at 60 mrad with locked attenuation, 0.2 m/s over ±0.5 m** · indoor walking = 1.6°/s at 50 m · rate table · brief TB-05 · all
- 2026-09-08 · demo · **Two-shutter interruption (receiver aperture; transmitter)** replaces "hand through beam" · a hand blocks nothing at 300 m · review 2 · C3 script · R6
- 2026-09-08 · framing · **One FEC layer: SSDV packets with built-in RS(255,223)** · avoid double FEC; SSDV proven for lossy links · SSDV spec · firmware · R3
- 2026-09-08 · metrics · **Rate defined as 100 kchip/s → 50 kbps coded → ~40 kbps payload; report pre/post-FEC BER, packet loss, goodput, outage together** · prevent "41 vs 50" and survivor-BER ambiguity · review 2 · acceptance §14 · Berkan
- 2026-09-08 · calendar · **Attempt ≥1 km in November before winter** · second window before pre-demo · reviewed brief · plan · Berkan
- 2026-09-09 · flight · **Flight 0 (drone/tether 50–120 m) is optional** pending CAR 901.43/SFOC determination and aircraft/site · 60-business-day standard · TC guidance · outreach 1.3 · Berkan
- 2026-09-10 · outreach · **MDA via Bilal's manager; MPBC via supervisor intro; asks sequenced small→large** · warm intros outperform cold · outreach package · Berkan/Bilal
- 2026-09-11 · claims · **No "first"; differentiation = range + autonomous acquisition/tracking; IEEE Lumentum project is a resource** · UBCO, FHNW, DLR, Loon, IEEE precedents · positioning · Berkan
- 2026-09-11 · team · **Berkan owns optics/link + PM; Shabazz power/structures; Matei controls; software seat open (Aryan candidate)** · match to recruited skills · proposal task distribution · Berkan
- 2026-09-11 · proposal · **Submitted 2026-09-14 with five names, one open seat; qualification moved to extended track; balloon intent stated** · form text in Appendix A · Berkan

---

## §3 Open items (ranked; each has an owner and a closing action)

| # | Item | Why it matters | Closing action | Owner | Due |
|---|---|---|---|---|---|
| 1 | Sixth member (ground software) | C4 quality; acceptance panel | Aryan yes/no; else Batu+Matei minimal app | Berkan | 09-18 |
| 2 | EHS registration + LSO; C3 room plan | blocks Rung 2 and the graded demo | file; meet LSO | Berkan | Sept |
| 3 | TC 601.21 / 901.43 / 602.42 letter | flight gate G5; rooftop assessment | send | Berkan | Sept |
| 4 | ≥1 km site pair (primary + backup) with access | C1 | survey, permissions, site package | Berkan/Shabazz | Sept |
| 5 | Coordinator agreement on acceptance criteria and evidence | grading contract | Phase 1 sign-off | Berkan | Oct 4 |
| 6 | AZ-GTi rate-mode command proof (latency, residual, backlash) | C2 feasibility; car test decision | Rung 5 | Matei | Oct |
| 7 | PIN receiver sensitivity, stability, angular acceptance | link budget placeholders | 04 §2.2 | Bilal | Oct |
| 8 | Diffuser transmission and profile | C2 budget | 04 §2.3 | Berkan | Oct |
| 9 | Diode wavelength vs filter | link works at all | measure | Berkan | Oct |
| 10 | Sky background (day/twilight) through real filter | daylight tests; flight window | measure | Berkan/Bilal | Oct |
| 11 | OTA choice (≤3.5 kg, FL, focuser travel) | mount load, FOV, focus shift | buy used | Berkan | Sept |
| 12 | Guide camera IR window verification | acquisition | check spec/measure | Matei | Sept |
| 13 | Certified LoRa module and mode | RSS-247 | select | Bilal | Oct |
| 14 | t_acq / t_reacq targets | acceptance | propose after Rung 5/6 | Matei | Nov |
| 15 | CAN-SBX dates + laser policy | Flight 2 | email cansbx@seds.ca | Berkan | Sept |
| 16 | Co-supervisor (controls) | tracking review | ask Zhang for intro | Berkan | Sept |
| 17 | Thermal model + L91 cold capacity (E-track) | G3 | model; test | Shabazz | Dec |
| 18 | APD part selection with 850 nm curves (E-track) | G2 | choose; order one | Bilal | Sept/Nov |
| 19 | University insurance/field-ops for any flight | G5 | inquire | Berkan | Oct |
| 20 | MDA / MPBC / UBCO / IEEE / Space Concordia outreach | mentorship, gear, chamber | send per 03 | Berkan/Bilal | after 09-14 |

---

## §4 Placeholders that must become measurements (status board)

| Quantity | Current value | Tag | Replaced by |
|---|---|---|---|
| PIN receiver sensitivity @50 kbps | −50 dBm | TARGET | 04 §2.2 BER curve |
| APD receiver sensitivity @50/5 kbps | −60/−65 dBm | TARGET | E-track bench |
| Responsivity at 850 nm | 0.5 A/W | ASSUMED | datasheet + measurement |
| Receiver FOV | 3.6–7 mrad | MODELED | angular acceptance scan |
| Diffuser insertion loss | 0 dB | ASSUMED | power before/after |
| Beam divergence X/Y (narrow, wide) | 60 / 200 mrad | TARGET | far-field measurement |
| Diode wavelength and drift | 850 nm, 0.3 nm/K | ASSUMED | filter transmission test / spectrometer |
| Mount command latency | <150 ms | TARGET | Rung 5 |
| Residual tracking error @0.3°/s | <2 mrad | TARGET | Rung 5/6 |
| Backlash az/el | — | TBD | Rung 5 |
| t_acq, t_reacq (1/5/15 s) | — | TBD | Rung 6 |
| Indoor attenuation | 26.0 / 21.9 dB | MODELED | on-the-day H1 calibration |
| Atmosphere + scintillation | 2 dB | ASSUMED | outdoor runs vs range |
| Payload mass | 860 g | MODELED | scale |
| L91 pack capacity at −40 °C | ~20 Wh | ASSUMED | cold test |
| Payload interior temperature at 1 kPa | −44 °C (one model) | MODELED | chamber test |
| Flight received power | −62.8 dBm | MODELED | never measured until flight; bench via 90 dB attenuation |

---

## §5 Known errors corrected (so nobody re-introduces them)
- "Beam is 18 m wide so a person can carry it" — wrong; tolerance is ±1.72° (angle).
- Rev C fallback margin listed +3.9 dB; correct value +6.9 dB (2 W).
- Ground irradiance ratio to MPE: 3.5×10⁷ not 3×10⁶ (trivial, but wrong).
- Photons/bit at 2.4 nW: ~1×10⁵ average (Manchester 50% duty), not 2×10⁵.
- Background shot noise after gain: 3.5 nA, not 0.5 nA (SNR ~17, not ~100).
- "Autoguiding solves tracking" — sidereal 0.004°/s vs our 0.3–1°/s.
- "Payload sunlit while station at −6° to −10°" — payload in shadow below ≈ −5.4°.
- NAV5 for MAX-M10 — deprecated; use VALSET CFG-NAVSPG-DYNMODEL; ceiling 80 km; "Airborne <1g" has a 100 m/s velocity limit (freefall) → use <2g.
- BME280 / DS18B20 out of range at altitude/temperature.
- "12 Wh mission energy" — 17–20 Wh plus converter losses.
- "16 cells" fix for power — conflicts with the 1.1 kg mass line; replaced by uplink-gated TX.
- "Hand through the beam" demo; "phone GPS is enough"; "re-acquisition is automatic"; "PIN receiver has no overload issue at short range" — all corrected in Rev D.2.

---

## APPENDIX A — Proposal form as submitted (2026-09-14), for reference

**Title:** Borealis: Free-space Optical Data Link with Autonomous Tracking
**Students:** Berkan Bozoglu, Bilal Samee, Batu Erata, Shabazz Khan, Matei Moldovan (+1 open)
**Supervisor:** Prof. John Xiupu Zhang, ECE Photonics Research Group (agreed)

**Description (summary):** industry moving to laser comms; problem is closing an optical link between a moving airborne platform and a ground receiver with affordable hardware: aiming from a swinging platform, collecting light through a telescope at distance, recovering clean bits from photocurrent, staying pointed at a moving target; stratospheric environment and laser/aviation regulation. Two review rounds; UBCO precedent; independent design emphasizing transmitter payload and receiver electronics. Core (graded) C1 stationary 1 km link; C2 autonomous tracking on a fixtured carrier with wide beam and shutter blackouts; C3 in-lab attenuated demo; C4 ground software with acceptance panel; C5 documentation and safety file. Extended (gated): E1 payload; E2 APD receiver; E3 qualification; E4 low-altitude airborne test; E5 balloon after G1–G5; CAN-SBX uncommitted. "The balloon flight is the goal we are building toward, and we intend to attempt it. The gates exist so that our grade does not depend on weather or on Transport Canada's response times, not to hedge the ambition."

**Required resources, student requirements, task distribution:** as in 01_MASTER_CONTEXT §7, §9, §12 and 03 Part 1.
