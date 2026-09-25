# 01 — BOREALIS Master Context
**Baseline:** Rev D.2 (reviewed 2026-09-09) · assembled 2026-09-12
This file is the single complete description of the project. Everything else in the package elaborates a section of it.

---

## §1 Identity

| Field | Value |
|---|---|
| Project | BOREALIS — Free-Space Optical Data Link with Autonomous Tracking |
| Course | ELEC/COEN 490 Capstone, Concordia University (Gina Cody School), 2026–27 |
| Lead | Berkan "Berky" Bozoglu (ELEC) — berkan.bozogluwork@gmail.com |
| Team (5 of 6) | Bilal Samee (COEN; 3 co-op terms at MDA Space, RF PCB, STM32) · Batu Erata (COEN; embedded) · Shabazz Khan (PCB, power electronics) · Matei Moldovan (COEN; embedded, signal processing) · seat 6 open (ground software; candidate Aryan, full-stack + ESP32) |
| Supervisor | Prof. John Xiupu Zhang, ECE Photonics Research Group — confirmed (has read the proposal) |
| Co-supervisor | Controls, to be confirmed (candidates: Rodrigues, Skonieczny, Khorasani) |
| Coordinators | Bahareh Goodarzi, Luis Rodrigues · Engineer in Residence: Dmitry Rozhdestvenskiy (lab space, procurement) |
| Proposal | Submitted 2026-09-14 (form text in decision log appendix) |
| Budget | ~$4,600 CAD incl. contingency (itemized in §12) |

**One sentence:** we transmit a photograph across open air on an 850 nm laser beam; a telescope on a motorized mount finds that beam by itself, follows it while the transmitter moves, and rebuilds the picture on a laptop. The balloon flight is the goal we are building toward; the grade does not depend on it.

---

## §2 Fixed external dates (Concordia ECE capstone, verified)

| Date | Event |
|---|---|
| 2026-09-11 | Capstone orientation |
| 2026-09-14 | Proposal submission |
| 2026-09-18 | Team formation |
| 2026-10-04 / wk of 10-05 | Phase 1 report / presentation |
| 2026-11-27 | Final design approval |
| 2026-11-29 | Phase 2 report; presentation wk of 11-30 |
| wk of 2027-02-15 | In-lab pre-demo |
| wk of 2027-03-22 | In-lab final demo |
| 2027-04-02 | Final report; poster TBA |

Prerequisites (ELEC 490): ENGR 301, 371; COEN 311; ELEC 342 or 364; ELEC 390; ≥75 credits; C-Edge/co-op term. COEN 490 members: COEN 390, SOEN 341.

---

## §3 Scope — the two tiers

### 3.1 Core deliverables (graded; flight-independent)

**C1 — Range link, stationary, ≥1 km.** Transmitter on a tripod aimed at the receiver's surveyed position; 130 mm telescope on the AZ-GTi aimed back; nothing moves. 60 mrad beam, ≤200 mW on-state (Class 3B). PIN photodiode receiver. Rate: 100 kchip/s Manchester → 50 kbps coded → ~40 kbps image payload (SSDV 205/256 bytes). Acceptance: post-FEC BER ≤1e-5 over ≥10⁷ compared reference bits, with pre-FEC BER, packet loss, goodput and outage time reported alongside; live image transfer.

**C2 — Tracking link, moving transmitter, 200–500 m (300 m baseline).** Transmitter on a **fixtured carrier** (cart; car optional only after mount rate capability is proven) with a **200 mrad diffuser** so orientation error stays inside the beam. Station: acquires from a coarse seeded position (±2°), SEARCH spiral over the guide field, TRACK on guide-camera centroid at 10 Hz with rate-mode mount commands and feed-forward, COAST on loss, re-acquire autonomously. Two scripted interruptions: (a) shutter at receiver aperture — data stops, tracking continues, resumes; (b) shutter at transmitter — full COAST→SEARCH→TRACK recovery. Blackout tests 1 s, 5 s, 15 s with measured recovery time. Baseline motion: walking speed (0.27°/s at 300 m); ±3 m lateral travel changes bearing ±0.57°.

**C3 — In-lab demonstration, 50–80 m, attenuated.** Same system indoors (EV atrium or corridor) with a **locked, calibrated attenuator** reproducing the 1 km received power (26.0 dB at 50 m, 23.7 dB at 65 m, 21.9 dB at 80 m — calibrate to measured detector power on the day). 60 mrad beam; slow constrained carrier: ±0.5 m at 0.2 m/s. Live image reconstruction. This is what the department watches in February and March. Requires a room-specific LSO plan and coordinator agreement that indoor + witnessed outdoor logs constitute the graded evidence.

**C4 — Ground control software.** Python application: serial in from RX board and LoRa modem; guide-camera frames in; rate commands out to the mount (SynScan/INDI); packet decode; SSDV image rebuild; transmitter command; **live acceptance panel** (lock state, goodput, pre/post-FEC BER, packet loss, re-acquisition time, tracking error) and run logging.

**C5 — Documentation and safety file.** Link budgets (C1/C2/C3/flight), written acceptance procedures (signed with supervisor in Phase 1), receiver characterization report, tracking report, EHS/LSO file, Transport Canada / NAV CANADA correspondence.

### 3.2 Extended track (not graded; gated)

**E1** Flight payload ≤1.1 kg all-in: camera, high-altitude GNSS, two-way LoRa telemetry and command, interlocked 2 W transmitter on a **pan/tilt gimbal that points at the station** (GPS vector + IMU + magnetometer), 100 mrad beam, 5–10 kbps.
**E2** APD flight receiver with measured sensitivity (BER vs power curves).
**E3** Thermal / low-pressure qualification of the full payload (3 h profile).
**E4** Low-altitude airborne test (drone or tethered balloon, 50–120 m) if aircraft, site and payload approvals settle in time.
**E5** Balloon flight to ~28 km after gates G1–G5. Target: ≥1 image received optically from >20 km. CAN-SBX (CSA, August campaigns, Timmins) is a second-flight stretch, uncommitted.

### 3.3 Flight gates
- **G1** Station-directed pointing holds beam on station at 1–5 km with payload deliberately swung.
- **G2** APD receiver passes acquisition, fade and BER tests at flight-equivalent power.
- **G3** Full-profile thermal/vacuum qualification passed.
- **G4** Interlock fault tests passed (command expiry 5 s, GNSS-invalid inhibit, >1 km AGL, physical arming plug, independent enable line, stuck-on).
- **G5** Written approvals: TC directed-light authorization (CAR 601.21); TC interpretation of CAR 602.42 for the actual envelope; NAV CANADA NOTAM; Concordia EHS; university field-ops and insurance; site/landowner permissions.

Realistic flight window if all gates pass: **summer 2027**. Probability language is deliberately avoided; conditions and decision dates replace it.

---

## §4 Physics reference (the four ideas)

1. **Photons are countable.** E = hc/λ = 2.34×10⁻¹⁹ J at 850 nm. 200 mW on-state ≈ 8.56×10¹⁷ photons/s. C1 delivers ~1.1×10⁷ photons per coded bit averaged over Manchester on/off — enormous slack; the difficulty is alignment, control and integration, not photon starvation.
2. **Divergence.** Footprint ≈ θ(rad) × range. Étendue: emitter size / focal length sets the minimum divergence (100 µm / 5 mm ≈ 20 mrad natural; widened deliberately). **Pointing tolerance is the half-angle, independent of range:** 60 mrad → ±1.72°; 200 mrad → ±5.73°; 100 mrad → ±2.87°. A real diode/diffuser has no sharp edge; usable allowance is less.
3. **Geometric loss.** capture = (D_aperture/D_spot)². 130 mm in a 60 m spot → 4.7×10⁻⁶ → −53.3 dB. Widening 60→200 mrad costs 10.5 dB; shortening 1 km→300 m gains 10.5 dB — C2 has the same on-axis power as C1 only if diffuser loss and beam shape are accounted for.
4. **Detection.** Si responsivity ≈0.5 A/W [ASSUMED]. C1: 0.265 µW on-state → 132 nA → 15.9 mV through 120 kΩ. PIN receiver placeholder sensitivity −50 dBm (5 nA, 0.60 mV) [TARGET]; resistor noise alone 0.116 nA RMS over 100 kHz; ideal resistor-noise-only OOK sensitivity ≈ −57 dBm. APD (flight) placeholder −60 dBm [TARGET]; APD adds internal gain (~20–50×), excess noise, and a bias supply — not a drop-in upgrade.

dB primer: −3 dB = half; −10 dB = tenth; +23 dBm = 200 mW; −36 dBm = 0.25 µW. Always state on-state vs average (Manchester 50% duty → average is 3 dB below on-state).

---

## §5 Link budgets [MODELED unless tagged]

### 5.1 C1 campus, 1 km, on-state
| Term | Value |
|---|---|
| TX optical | +23.0 dBm |
| TX optics | −1.0 dB |
| Capture Ø130 mm in 60 m spot | −53.3 dB |
| Atmosphere, RX optics, obstruction | −4.5 dB |
| **Received** | **−35.77 dBm · 0.265 µW** |
| PIN sensitivity [TARGET] | −50 dBm |
| **Margin** | **~14 dB** (10.7 dB at 1.5 km) |

Received vs range (same TX): 50 m −9.8 dBm (6.4 V at TIA — saturated); 80 m −13.8 dBm (2.5 V); 200 m −21.8 dBm (397 mV); 300 m −25.3 dBm (176 mV); 500 m −29.8 dBm (64 mV); 1 km −35.8 dBm (16 mV); 1.5 km −39.3 dBm (7 mV).

### 5.2 C2, 300 m, 200 mrad
Same on-axis received power as C1 (θR = 60 m in both) **minus** diffuser insertion loss and off-axis profile loss [TBD, measure]. Pointing allowance ±5.73° shared among aiming error, bearing change and carrier rotation.

### 5.3 C3, indoor
Attenuate to −35.8 dBm at the detector: 26.0 dB at 50 m, 21.9 dB at 80 m. Calibrate on the day.

### 5.4 Flight, 30 km slant, station-directed 100 mrad, 2 W
| Term | Value |
|---|---|
| TX | +33.0 dBm |
| TX optics | −1.0 |
| Capture Ø130 mm in 3.0 km spot | −87.3 |
| Atmosphere/scintillation | −2.0 |
| RX optics, filter, obstruction | −2.5 |
| Beam profile + pointing allocation | −3.0 |
| **Received on-state** | **−62.8 dBm · 0.5 nW** (brief: 1.06 nW on-state / 0.53 nW average under the 5.5 dB allocation) |
| APD sensitivity [TARGET] 50 kbps / 5 kbps | −60 / −65 dBm |
| **Margin @5 kbps** | **+2.2 dB** (+6.2 dB if −64 dBm demonstrated; +3.7 dB signal with 200 mm tube, ~+1.9 dB net after background) |

Fallbacks: adaptive rate 5–10 kbps; 200 mm tube; passive damped mount at 100 mrad/10 kbps ≈ +6.9 dB (conditional).

---

## §6 System architecture

### 6.1 Signal chain (campus)
Image file (JPEG) → **SSDV packetizer** (256 B packets: 15 B header, 4 B CRC, 32 B RS parity, 205 B payload — one FEC layer) → **Manchester** 100 kchip/s → **laser driver** (constant-current, TTL gate) → **850 nm diode + collimator** (60 mrad; or 200 mrad diffuser for C2) → free space → **telescope** 130 mm → **850/40 nm filter + field stop** → **PIN photodiode** → **TIA** (120 kΩ, ~100 kHz) → AC coupling → **comparator/slicer** → **STM32 timer capture** → clock recovery, frame sync, RS decode → USB → **Ground Control** → image on screen.

Parallel loop (carries no data): **guide scope** (50 mm class, ~3° field, IR-transmitting mono camera) → centroid → error → **mount rate commands** (AZ-GTi over SynScan/INDI) with feed-forward and backlash compensation → state machine IDLE→SLEW→SEARCH→TRACK→COAST.

### 6.2 Three channels (flight)
- Optical downlink (Path B): 850 nm, payload → ground.
- RF (two-way): LoRa 915 MHz ISED-certified module. Down: GNSS 1 Hz, housekeeping. Up: station position, TX_ON/OFF, mode.
- GNSS: u-blox MAX-M10 class, airborne <2g dynamic model set via VALSET (CFG-NAVSPG-DYNMODEL) and read back every boot; 80 km ceiling in airborne mode; default portable mode stops ~12–18 km.

### 6.3 Three light paths (conceptual)
- Path A — the picture: sunlight → camera → bytes (photonics ends at the shutter).
- Path B — the data beam: laser → air → photodiode (the only optical channel).
- Path C — the tracking light: guide camera sees the source; steers the telescope; carries no message.

---

## §7 Subsystem specifications (current design; parts in 02_COMPONENT_REGISTER)

### 7.1 Campus transmitter (C1/C2/C3)
850 nm diode ≤200 mW on-state; aspheric collimator → 60 mrad; engineered diffuser option → 200 mrad; constant-current driver with TTL gate at 100 kchip/s (switching vs linear chosen from current/noise/thermal); key switch; mechanical sight aligned to an approved reference; visible LED beside the aperture for location (not beam direction); tripod (C1) or fixtured cart mount (C2); calibrated ND attenuator stage (C3). Rise/fall and driver overshoot to be measured.

### 7.2 Receiver (campus)
BPW34-class PIN (7.5 mm² active; 70 pF at 0 V, 25 pF at 3 V reverse) → TIA (OPA657 candidate; gain-of-7 stable — feedback network must be designed for stability, not just bandwidth; alternatives OPA818, LTC6268) → AC coupling → comparator with hysteresis / simple AGC → STM32 capture. Characterized gain settings only; each setting stability-verified. Overload recovery time documented. Measured: sensitivity (BER vs power), angular acceptance (two axes), stability, overload.

### 7.3 Optical front end
130 mm Newtonian ≤3.5 kg (focal length ~650–750 mm [TBD by chosen OTA]); 850/40 nm bandpass (chosen to hold diode drift 838–856 nm over −20…+40 °C at 0.3 nm/K); field stop; detector mount at focal plane; focus jig (finite-object focus shift ≈ 11.4 mm at 50 m, 7.1 mm at 80 m for 750 mm FL); boresight jig (guide/receiver separation ~200 mm → 3.8 mrad parallax change between 1 km and 50 m). Receiver FOV ≈ detector size / focal length ≈ 3.6–7 mrad; measure.

### 7.4 Guide and mount
Sky-Watcher AZ-GTi (5 kg capacity — weigh OTA + guide scope + detector + cables); separate co-aligned 50 mm guide scope with IR-transmitting monochrome camera (avoid IR-cut variants); rate-mode command over SynScan/INDI [protocol proof required in October]; feed-forward; backlash characterization; zenith-avoidance rule for alt-az.

### 7.5 Ground software (C4)
Python; pyserial; OpenCV; numpy; PyQt or web front end; INDI/SynScan wrapper; SSDV decoder; RS library. Modules: decoder service, image assembler, mount controller (state machine), guide processor (10 Hz), acceptance recorder. Metrics reported together: pre-FEC BER, post-FEC BER (denominator stated), packet loss, goodput, outage time, re-acquisition time, tracking error.

### 7.6 Flight payload (E1) — design, not built
STM32H743 + FreeRTOS; OV5640 (JPEG out); u-blox MAX-M10; ISED-certified LoRa 915 MHz (500 kHz BW or hopping); MS5611 baro (rated to 10 mbar); IMU + magnetometer; PT1000 exterior temp; microSD full-rate log; 2 W 850 nm diode on buck-preregulated current sink (linear sink from 12 V would burn ~25 W); pan/tilt brushless gimbal ±45° tilt, own 500 Hz IMU loop, GPS-vector targeting; 8× L91 Li-FeS₂ cells kept warm, low per-cell drain (datasheet: ~1.6 Ah at 250 mA at −40 °C, ~0 at 1 A); 15 mm EPP shell; diode heat-sunk to battery plate (first conduction model suggests box may run cold, ~−44 °C — needs transient model). Mass budget 860 g vs 1,100 g ceiling (CAR 602.42: <3.256 m³ gas-carrying capacity to avoid TC authorization — interpretation needed). Energy need ~17–20 Wh mode-based vs pack capacity at temperature [TBD by test]; laser on-time gated by uplink command, 40 min budget.

Tasks: SUPERVISOR 1 Hz; SENSORS 100 Hz; CAMERA 1/10 s; FRAMER event; TX-MOD ISR 100 kHz; TELEMETRY 1 Hz; GIMBAL 500 Hz (own controller); LOGGER.

Platform dynamics (HAVOC, BAMS 2023): ±10° tilt below 10 km; up to 51° near the jet; pendulum period ~4.5 s for 5 m train. Loon: floating platforms have small pointing disturbance at float.

### 7.7 Dusk launch geometry (flight)
Horizon depression at 28 km = 5.36°; payload is sunlit until station sun elevation ≈ −5.4°. Usable window: station sun −1° to −5°, ~20 min; time L-0 so the 20–28 km climb (≈T+65–93 min at 5 m/s) lands in it. Laser-as-beacon acquisition does not need a sunlit payload.

---

## §8 Safety and regulation (summary; details and status in 03)

- Campus TX ≤200 mW at 850 nm = **Class 3B**, invisible; NOHD ≈ 2 m for 60 mrad [MODELED, MPE ≈2 mW/cm² for t>10 s, C_A≈2] — a calculation, not an approved boundary. Requires Concordia EHS registration, LSO, training, OD 4+ eyewear (800–900 nm), key switch, beam stop, controlled area; room-specific plan for C3.
- Flight TX 2 W = **Class 4**; NOHD ≈ 6 m at 60 mrad, ~4 m at 100 mrad; ground irradiance at float ~0.3–0.6 µW/m²; interlocked off <1 km AGL; bench only under LSO until G5.
- **CAR 601.21**: written TC authorization to project a directed bright light into navigable airspace — applies to balloon, drone-borne, and the rooftop projection is assessed under it. One inquiry covering all three.
- **CAR 901.43**: hazardous payload on a drone may require SFOC-RPAS (60-business-day service standard).
- **CAR 602.42**: unoccupied free balloon >115 ft³ (3.256 m³) gas-carrying capacity needs TC authorization (602.44); "capacity" vs fill volume needs TC interpretation. Tethered: Standard 621 Ch. 11 marking/lighting thresholds (≥1.8 m dia or >3 m³).
- NAV CANADA NOTAM (CNOP §5.5.13–14) — a NOTAM is notification, not permission.
- RSS-247: single-channel 125 kHz LoRa not automatically compliant; use certified module, ≥500 kHz DTS or FHSS mode. 433 MHz sits in the amateur 70 cm band (licence).
- Montréal handheld-laser possession rules: document educational purpose for transport.

---

## §9 Team roles (as submitted)

| # | Role | Owner | Owns |
|---|---|---|---|
| R1 | Optics, link, project lead | Berkan | collimation, diffuser, far-field measurement, receiver optical layout, focus/boresight, attenuation calibration, link budget validation; acceptance criteria, schedule, EHS/LSO, TC/NAV CANADA filings (front-loaded Sep–Nov) |
| R2 | Receiver, RF, PCB | Bilal | PIN receiver board, APD receiver + bias (extended), LoRa link, sensitivity/background measurements |
| R3 | Embedded, flight SW | Batu | STM32 firmware, FreeRTOS, camera/SSDV, RS, Manchester, clock recovery, interlocks, GNSS config readback, logging |
| R4 | Power, structures, field | Shabazz | laser driver board (buck), field power, carrier fixture, enclosures, site logistics; flight energy/thermal/battery qual |
| R5 | Controls, tracking | Matei | centroid detection, rate-mode mount control, feed-forward, backlash, state machine, re-acquisition tests, moving-target demos; flight gimbal |
| R6 | Ground software | open (Aryan?) | real-time app, telemetry, mount interface, decoding, image rebuild, acceptance panel, logging |

If R6 stays open: Batu + Matei build a minimal ground app; acceptance panel simplified.

---

## §10 Calendar (internal plan, Rev D.2)

- **September:** team, supervisor, EHS registration + TC 601.21 inquiry, site survey (primary + backup ≥1 km pair; indoor venue), core parts ordered (PIN diodes, optics, 3B diode, mount); APD only from a separate extension allowance.
- **October:** bench link through ND filters; mount rate-tracking proven on a moving LED (protocol, latency, residual error); PIN receiver characterized; acceptance criteria signed with supervisor/coordinators; twilight/day sky background measured through the real filter.
- **November:** outdoor closure 200–300 m; attempt ≥1 km before winter (permissions permitting); guide loop closed on the real source; design approval 11-27; Phase 2 report 11-29.
- **December–January:** complete/repeat ≥1 km acceptance evidence; moving link and recovery proven by January; indoor configuration calibrated; first cold test.
- **February:** repeatable moving-target demo; full rehearsal; in-lab pre-demo (wk of 02-15).
- **March–April:** final demo (wk of 03-22); report 04-02; poster.
- Flight track: gates, no dates.

---

## §11 Precedents and positioning

- DLR CAPANINA/STROPEX: 1.25 Gbps stratospheric optical downlink, 1550 nm.
- Google Loon: 130 Mbps balloon-to-balloon, >100 km, 20 km.
- FHNW (Switzerland): HAB FSO payload, 2-axis servo gimbal, 38.5 km test flight.
- UBC Okanagan "StratoLaser" capstone (Holzman, Integrated Optics Lab): targeting and tracking system for stratospheric laser links; flights via Stratoneers club/CSA; no public report of an optical link closed from altitude.
- MIT CLICK-A: 10 Mbps to a 28 cm portable ground station; PULSE-A (UChicago): undergraduate optical CubeSat, launch ~2027.
- IEEE Concordia / Lumentum project: benchtop TX/RX optical interconnect between microcontrollers — fixed alignment, short range; a resource and possible parts contact, not a competitor.
- **Positioning:** not "first"; the differentiator is range (~1 km, −53 dB capture) and autonomous acquisition/tracking of a moving transmitter. Campus link is categorically beyond a benchtop interconnect; the balloon adds altitude and regulatory risk, not engineering novelty.
- Industry: MDA Space integrates Tesat SCOT80 optical terminals (792 units) on Telesat Lightspeed at Ste-Anne-de-Bellevue; MPB Communications (Pointe-Claire) builds space-qualified 1550 nm amplifiers for OISLs and ground stations, has TVAC chambers, states academic collaboration policy; Lumentum sponsors the IEEE Concordia project.

---

## §12 Budget (CAD, estimates ±20%)

Ground: AZ-GTi + 130 mm OTA 900 · APD ×2 + filter + RX parts + PCBs 710 · guide scope + mono IR camera 290 · dew/adapters/mounts 90. Flight avionics 330. TX: 2 W diodes ×3 + beam-shaping + buck driver 280 · campus 3B TX + driver 40 · pan/tilt gimbal 120 · cells/heater/shell/rigging 220 · OD 4+ eyewear ×3, stops, signage 320 · balloons/chute/helium/test/ND/dry ice 720. **Total ≈ $4,600 incl. 15% contingency.** Unpriced: chamber access, field power, travel, spares, taxes/shipping. Flight-only spend (~$700 balloon/helium, APDs) deferred until gates.

---

## §13 Consolidated gotchas (every one found by the two reviews and our own work)

1. Pointing tolerance is an angle; a handheld transmitter rotates >1.7°. → wide beam + fixtured carrier.
2. Nadir beam + downrange station is geometrically impossible at 35 km (Rev C error). → station-directed pointing.
3. Tracking is not autoguiding (0.004°/s vs 0.3–1°/s). → rate-mode commands, prove in October.
4. Re-acquisition needs COAST/SEARCH states; a hidden reversing carrier defeats constant-rate coast.
5. Phone GPS (10 m) = 1.9° at 300 m > half a 3° guide field. → GPS seeds a spiral search.
6. Boresight parallax 3.8 mrad and focus shift 11 mm between 1 km and 50 m. → recalibrate per range.
7. Receiver saturates at short range (6.4 V at 50 m). → calibrated attenuation, characterized gain, overload recovery.
8. TIA stability: 25–70 pF diode C into OPA657 (gain-of-7 stable). → design the feedback network, measure transfer function.
9. Manchester on-state vs average power: 3 dB accounting error if mixed.
10. "50 kbps" must be defined: 100 kchip/s → 50 kbps coded → ~40 kbps payload.
11. SSDV includes RS; don't stack a second RS layer. Interleaving can't bridge multi-second fades; retransmit/schedule images.
12. Indoor walking (1.6°/s at 50 m) is faster than a car at 300 m. → 0.2 m/s, ±0.5 m.
13. "Hand through the beam" blocks nothing at 300 m. → two-shutter demo.
14. Class 3B/4 need LSO plans; enclosed housing ≠ enclosed beam; OD 3 is 0.4 OD short for 2 W → OD 4+.
15. CAR 601.21 applies regardless of irradiance; rooftop assessed too.
16. Drone laser payload → CAR 901.43 / SFOC, 60 business days.
17. CAR 602.42 "gas-carrying capacity" ≠ fill volume; get TC interpretation.
18. GNSS: default mode dies at 12–18 km; VALSET airborne <2g; readback every boot; freefall can exceed <1g velocity limit.
19. BME280 can't read 15 hPa; DS18B20 stops at −55 °C. → MS5611, PT1000.
20. Linear current sink from 12 V burns ~25 W at 2.5 A. → buck pre-regulator.
21. L91 cells: near-zero capacity at 1 A at −40 °C. → keep warm, low per-cell drain, qualify by test.
22. Thermal at 1 kPa: no convection; first model says cold (−44 °C), diode may still run hot locally. → transient model + full-profile test.
23. Dusk geometry: payload in shadow when station sun < −5.4°. → time the climb to −1…−5°.
24. 808 nm diodes don't pass an 850/40 filter; drift 838–856 nm. → freeze wavelength, match filter.
25. 8" Dob exceeds AZ-GTi capacity; 4.5 kg OTA leaves 0.5 kg. → ≤3.5 kg OTA; weigh everything.
26. Sequencing: characterize receiver before design approval; order one APD in September; PIN first.
27. Six people are six people: name core owners before any flight work.
28. Claims: not "first"; describe precedents accurately.

---

## §14 Acceptance definitions (to be signed in Phase 1)

- **Rate:** 100 kchip/s Manchester; 50 kbps coded; report payload goodput.
- **BER:** post-FEC BER on delivered bits over ≥10⁷ compared reference bits (zero errors in 3×10⁵ bits gives only a 95% upper bound of 1e-5 — run much longer); denominator stated; pre-FEC BER, packet loss and outage reported alongside; discarded frames counted.
- **Acquisition:** from a stated initial error envelope (±2° seed) to TRACK within t_acq [TARGET TBD]; re-acquisition after 1/5/15 s blackouts within t_reacq [TARGET TBD]; logged motion, power, outages.
- **Tracking:** residual pointing error vs angular rate, with latency measured; feed-forward on/off comparison.
- **Evidence:** indoor C3 live + witnessed, logged outdoor C1/C2 runs; coordinator agreement required.

---

## §15 Glossary (short)
OOK · Manchester · chip · TIA · PIN · APD · responsivity · BER · goodput · RS(255,223) · SSDV · divergence · étendue · boresight · backlash · NOHD · MPE · Class 3B/4 · CAR 601.21 / 602.42 / 901.43 · NOTAM · SFOC · VALSET · link margin · on-state vs average power. Definitions in the Team Brief "Words and units" and TB-10 glossary.
