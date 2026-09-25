# 02 — Component Register
**Live file.** Update the `Chosen part`, `Status`, and `Measured` fields as parts are selected and characterized. Everything not marked [VERIFIED] or [MEASURED] is a candidate or an assumption.

Each entry: **What it does · Why it's here · Key parameters that matter downstream · Candidates · Gotchas · Fields to fill.**
Status vocabulary: `candidate` → `ordered` → `received` → `bench-verified` → `integrated` → `flight-qualified`.

---

## A. CAMPUS TRANSMITTER (C1 / C2 / C3) — owners R1 (optics), R4 (driver/power)

### A1. Laser diode, campus
- **Role:** the light source for Path B on campus. Class 3B by design (≤200 mW on-state at 850 nm).
- **Why:** 850 nm sits in an atmospheric window and matches silicon detector peak responsivity; ≤200 mW keeps the campus program Class 3B (NOHD ~2 m) instead of Class 4.
- **Parameters that matter downstream:** center wavelength at 20 °C and drift (≈0.3 nm/K) → filter passband (A6/C3); emitter size and raw divergence (fast/slow axis) → collimator choice (A2); threshold and operating current → driver (A4); rise/fall at 100 kHz gate → eye opening; package (TO-18/TO-5/C-mount) → mount and heatsinking.
- **Candidates:** 850 nm single-emitter diodes 100–200 mW (TO-can); avoid 808 nm pump diodes for campus (outside 850/40 filter). Vendor examples to verify at order time: Ushio/Oclaro 850 nm class, Thorlabs L850-series, Laser Components.
- **Gotchas:** datasheet "typical" wavelength has ±10 nm part-to-part spread — measure each diode's spectrum or at least check with the filter in the path; ESD-sensitive; never power without current limit; invisible beam.
- **Fields:** Chosen part `[TBD]` · Wavelength@20°C `[TBD nm]` · Emitter size `[TBD µm]` · Ith/Iop `[TBD mA]` · Max on-state power used `[TBD mW]` · Status `candidate` · Measured `[none]`

### A2. Collimating optic (narrow beam, 60 mrad)
- **Role:** turns the diode's raw cone (tens of degrees) into a ~60 mrad full-angle beam for C1/C3.
- **Parameters:** focal length and NA (fast axis of a diode can be ~30° full → NA ≥0.28 to collect it); AR coating for 850 nm; adjustable focus barrel so divergence can be set by defocus; beam ellipticity.
- **Candidates:** aspheric lens f = 4–8 mm, NA 0.5 class, in an adjustable barrel (Thorlabs C-series asphere + adjustable mount, or equivalent).
- **Gotchas:** defocus does not fix astigmatism/ellipticity; measure the far-field pattern in both axes (see 04 §2.3); the "20 mrad natural" estimate is one axis only.
- **Fields:** Chosen lens `[TBD]` · f `[TBD mm]` · NA `[TBD]` · Measured divergence X/Y `[TBD/TBD mrad]` · Status `candidate`

### A3. Engineered diffuser (wide beam, 200 mrad) — C2
- **Role:** spreads the collimated beam to ~200 mrad full angle so transmitter orientation error up to ±5.7° stays inside the beam on the moving carrier.
- **Parameters:** divergence angle (e.g., 10°/12° full), transmission efficiency (insertion loss), profile shape (top-hat preferred), 850 nm suitability.
- **Candidates:** engineered/holographic diffusers 10–12° (Thorlabs ED1-series, RPC Photonics, Edmund).
- **Gotchas:** insertion loss and profile are unmeasured — they directly change the C2 link budget; uniformity at the edge decides the real usable pointing allowance.
- **Fields:** Chosen diffuser `[TBD]` · Nominal angle `[TBD°]` · Measured transmission `[TBD dB]` · Measured full-angle at 50% `[TBD mrad]` · Status `candidate`

### A4. Laser driver, campus
- **Role:** constant-current source for A1, gated on/off by a TTL signal at 100 kchip/s from the STM32.
- **Parameters:** compliance voltage vs diode Vf; current limit; rise/fall time (<1 µs for clean 10 µs chips); overshoot on turn-on (can exceed diode max — protect); enable/interlock input; key-switch in the supply path.
- **Candidates:** discrete op-amp + MOSFET current sink from a low rail (choose rail ≈ Vf + 1 V to keep sink dissipation small); iC-Haus iC-HG class driver; commercial TTL-modulated laser driver modules.
- **Gotchas:** a linear sink from 12 V at 2.5 A dissipates ~25 W (flight-relevant, but the lesson applies at 200 mW scale too); switching transients couple into the receiver bench tests; verify modulation depth (fully off between chips) with a fast photodiode on the bench.
- **Fields:** Topology `[TBD]` · Rail `[TBD V]` · I set `[TBD mA]` · Measured rise/fall `[TBD ns]` · Overshoot `[TBD %]` · Status `candidate`

### A5. Transmitter mechanical: sight, mount, carrier
- **Role:** repeatable aiming (mechanical sight aligned on an approved reference), tripod for C1, **fixtured cart mount** for C2 (rigid, aimed once, moved along a straight path), visible LED beside the aperture for location identification, key switch, beam-stop/shutter for the interruption demo.
- **Gotchas:** no unassessed aiming laser (LSO); the visible LED shows *where* the TX is, not where the IR beam points; the car mount is optional and only after mount rate capability is proven.
- **Fields:** Sight type `[TBD]` · Cart `[TBD]` · Shutter `[TBD]` · Status `candidate`

### A6. Calibrated attenuator stage (C3 and all short-range tests)
- **Role:** reproduce the 1 km received power indoors (26.0 dB at 50 m; 21.9 dB at 80 m) and prevent receiver saturation at short range.
- **Candidates:** absorptive ND filters (OD 1–3 stack) in a locked holder at the transmitter; calibrated at 850 nm with the optical power meter (H1).
- **Gotchas:** ND filter OD is wavelength-dependent; stacking reflective ND filters causes etalon effects — use absorptive; calibrate to measured detector power on the day, not to a table.
- **Fields:** Filter set `[TBD]` · Measured OD@850 `[TBD]` · Status `candidate`

---

## B. RECEIVER, CAMPUS (C1–C3) — owner R2, shared with R1

### B1. PIN photodiode
- **Role:** photons → current. Campus detector; also the receiver-board development device.
- **Parameters:** responsivity at 850 nm (≈0.5 A/W [ASSUMED]); active area (sets FOV = area / focal length — BPW34 7.5 mm² → ~2.7 mm side → ~3.6 mrad at 750 mm FL); capacitance (BPW34: 70 pF at 0 V, 25 pF at 3 V reverse) → TIA stability/bandwidth; dark current.
- **Candidates:** Vishay BPW34 (cheap, large area) [datasheet VERIFIED]; alternatives with larger area or lower C (BPW34S, SFH 2xx, Hamamatsu S1223) if FOV or bandwidth needs it.
- **Gotchas:** package window and lens change acceptance angle — measure it; reverse-bias for lower C; 850 nm response of "visible" diodes varies.
- **Fields:** Chosen `[TBD]` · Active area `[TBD mm²]` · C at bias `[TBD pF]` · Measured responsivity `[TBD A/W]` · Measured angular acceptance `[TBD mrad ×/y]` · Status `candidate`

### B2. Transimpedance amplifier
- **Role:** current → voltage; the noise-critical stage.
- **Parameters:** Rf (120 kΩ baseline → 132 nA → 15.9 mV at 1 km); required bandwidth ~100 kHz (100 kchip/s); feedback capacitor for stability against Cd; op-amp noise (voltage, current), GBW, minimum stable gain.
- **Candidates:** TI OPA657 (gain-of-7 stable — needs a designed feedback network, not just a big Cf) [datasheet VERIFIED]; OPA818; LTC6268; ADA4817.
- **Gotchas:** oscillation with 25–70 pF at the input; DC background can saturate the TIA before AC coupling removes it (use a DC-restoring/bias path or lower Rf gain setting); 6.4 V output at 50 m without attenuation — overload; switchable gain requires stability verification per setting.
- **Fields:** Op-amp `[TBD]` · Rf `[TBD kΩ]` · Cf `[TBD pF]` · Measured −3 dB BW `[TBD kHz]` · Measured input-referred noise `[TBD pA/√Hz]` · Overload recovery `[TBD µs]` · Status `candidate`

### B3. Post-amp, AC coupling, comparator/slicer
- **Role:** turns the analog waveform into clean chips for the MCU timer.
- **Parameters:** high-pass corner (Manchester allows AC coupling; corner well below 25 kHz spectral content ~ few hundred Hz); comparator hysteresis; optional AGC or peak-detect threshold.
- **Candidates:** rail-to-rail op-amp gain stage; fast comparator (TLV3501-class) with hysteresis.
- **Fields:** `[TBD]` · Status `candidate`

### B4. Receiver PCB
- **Role:** board hosting B1–B3 plus optional APD bias (D-section). Three revisions budgeted.
- **Gotchas:** guard rings and short input traces at the TIA; shield; separate analog/digital grounds; test points for received-power measurement; connector to the STM32 timer input.
- **Fields:** Rev `[A]` · Fab `[TBD]` · Status `candidate`

### B5. RX microcontroller and decode path
- **Role:** timer capture of chips → clock recovery → frame sync (SSDV sync/header) → RS decode (in SSDV) → packets over USB to Ground Control.
- **Candidates:** STM32H743 (WeAct or Nucleo) or STM32F4-class for the ground side.
- **Fields:** Board `[TBD]` · Firmware repo `[TBD]` · Status `candidate`

---

## C. OPTICAL FRONT END AND MOUNT — owners R1 (optics), R5 (mount)

### C1. Telescope (OTA)
- **Role:** the photon bucket; ~130 mm aperture (capture −53.3 dB at 1 km, 60 m spot).
- **Parameters:** aperture; focal length (sets FOV and focus shift: 11.4 mm at 50 m for 750 mm); mass (≤3.5 kg to leave margin on the 5 kg mount); focuser travel (must cover finite-object focus); central obstruction (Newtonian).
- **Candidates:** used 130 mm f/5 Newtonian OTA (~650 mm FL, ~3–3.5 kg); 114–150 mm alternatives if mass/FL fit better.
- **Gotchas:** 8" Dob exceeds mount capacity; Newtonian pointed near the Sun is a fire/detector hazard — solar exclusion in software; dew.
- **Fields:** Chosen OTA `[TBD]` · Aperture `[TBD mm]` · FL `[TBD mm]` · Mass `[TBD kg]` · Focuser travel `[TBD mm]` · Status `candidate`

### C2. Field stop and detector mount
- **Role:** limits sky background reaching the detector; holds B1 at the focal plane; allows focus and boresight calibration at each range.
- **Fields:** `[TBD]` · Status `candidate`

### C3. Bandpass filter
- **Role:** rejects sky/background outside the laser line.
- **Parameters:** center 850 nm, FWHM 40 nm (holds diode drift 838–856 nm), transmission >80% at 850, size to fit the detector path (1.25" or 25 mm).
- **Candidates:** 850/40 nm interference filter (Thorlabs FB850-40, Edmund, or Chinese equivalents).
- **Gotchas:** interference filters shift blue at angle — mount near-normal; verify transmission at the actual diode wavelength.
- **Fields:** Chosen `[TBD]` · Measured T@diode λ `[TBD %]` · Status `candidate`

### C4. Mount
- **Role:** motorized alt-az pointing and rate-mode tracking.
- **Parameters:** 5 kg (11 lb) payload [VERIFIED]; WiFi SynScan protocol; dual encoders; slew/rate command capability and latency [to prove]; backlash.
- **Candidates:** Sky-Watcher AZ-GTi [chosen candidate]; OnStep DIY conversion of a Dob (Path 2, more schedule).
- **Gotchas:** capacity ≠ tracking accuracy; commanding repeated GoTos is not a control strategy — use rate commands; zenith singularity; tripod stiffness in wind.
- **Fields:** Chosen `[AZ-GTi, TBD purchase]` · Protocol library `[TBD]` · Measured command latency `[TBD ms]` · Measured backlash az/el `[TBD arcmin]` · Status `candidate`

### C5. Guide scope
- **Role:** wide-field acquisition and tracking sensor path, separate from the data receiver so the APD/PIN path stays lossless.
- **Parameters:** ~50 mm aperture, short FL (~200 mm) for ~3° field with the chosen camera; co-aligned; rigid to the OTA (boresight stability).
- **Fields:** Chosen `[TBD]` · FL `[TBD mm]` · Measured field `[TBD°]` · Status `candidate`

### C6. Guide camera
- **Role:** sees the 850 nm source as a dot; feeds centroid at ≥10 fps.
- **Parameters:** monochrome, IR-transmitting window (no IR-cut), sensitivity at 850 nm, frame rate, USB.
- **Candidates:** IMX290/IMX462-class mono astro cameras (ZWO ASI120MM-S / ASI290MM, SVBONY SV305M Pro — verify window).
- **Gotchas:** some colour/IR-cut variants block 850 nm; exposure/saturation at short range; false bright sources (streetlights).
- **Fields:** Chosen `[TBD]` · Window `[IR-pass?]` · Measured detection SNR at 300 m `[TBD]` · Status `candidate`

### C7. Dew control, adapters, tripod power
- **Role:** dew heater strip + shield (outdoor), adapters, field power for mount/laptop/camera.
- **Fields:** `[TBD]` · Status `candidate`

---

## D. RECEIVER, FLIGHT (E2) — owner R2 (extended track only)

### D1. Avalanche photodiode
- **Role:** flight detector; internal gain 20–50× buys ~10–15 dB before amplifier noise.
- **Parameters:** wavelength-optimized for 850 nm (responsivity at 850 at the operating gain); breakdown/operating voltage (part-specific — S8664 class ~400 V; near-IR-optimized parts 150–250 V); excess noise factor F(M); active area (FOV); capacitance.
- **Candidates:** Excelitas C30902-class; Hamamatsu near-IR series (verify 850 nm curves); Thorlabs APD130A packaged module (~US$1,495 — only if a lab lends one).
- **Gotchas:** one wiring mistake at bias kills it — current-limit the supply; long lead time (order one in September from the extension allowance, second at design approval); gain and noise must be computed from the actual part's curves.
- **Fields:** Chosen `[TBD]` · Vbr `[TBD V]` · Vop for M=`[TBD]` · R(850)@M `[TBD A/W]` · Area `[TBD mm]` · Measured sensitivity @50 kbps/@5 kbps `[TBD dBm]` · Status `candidate`

### D2. Bias supply
- **Role:** stable, current-limited high voltage for D1 with temperature compensation (gain drifts with T).
- **Fields:** `[TBD]` · Status `candidate`

---

## E. FLIGHT PAYLOAD (E1) — owners R3 (avionics/firmware), R4 (power/thermal/structure), R5 (gimbal)

### E1. Flight computer
- **Candidates:** STM32H743 (WeAct or Nucleo) [candidate]. FreeRTOS; DCMI for camera; timers/DMA for modulation; SDMMC logging; IWDG watchdog.
- **Gotchas:** DCMI overrun behavior; cache/DMA coherence; SD write stalls.
- **Fields:** Board `[TBD]` · Status `candidate`

### E2. Camera
- **Candidates:** OV5640 module (native JPEG). **Fields:** `[TBD]`

### E3. GNSS
- **Candidates:** u-blox MAX-M10S breakout (Uputronics-class). Configure airborne <2g via VALSET (CFG-NAVSPG-DYNMODEL), read back every boot, re-assert after brownout; 80 km ceiling in airborne mode [VERIFIED integration manual].
- **Fields:** Module `[TBD]` · Firmware ver `[TBD]` · Config verified `[no]`

### E4. RF link
- **Candidates:** ISED-certified 915 MHz LoRa modules (e.g., certified RFM95W-based or Ebyte/RAK modules with ISED ID), 500 kHz BW or FHSS mode for RSS-247; authorized antenna. Ground side: same module + Yagi.
- **Gotchas:** single-channel 125 kHz LoRa is not automatically compliant; 433 MHz is amateur band (licence).
- **Fields:** Module `[TBD]` · ISED cert `[TBD]` · Mode `[TBD]`

### E5. Sensors
- MS5611 barometer (10–1200 mbar) — not BME280 (300–1100 hPa).
- IMU + magnetometer (ICM-20948 class) for gimbal fusion and heading.
- PT1000 or thermistor for exterior (−60 °C) — not DS18B20 (−55 °C limit).
- **Fields:** `[TBD]`

### E6. Flight laser diode (2 W)
- **Parameters:** 850 nm (not 808 — filter), multimode C-mount class, Vf ~2 V at 2–2.5 A, 0.3 nm/K drift, raw divergence ~8°×33°; thermal path to a heat plate.
- **Fields:** Chosen `[TBD]` · λ@20 °C `[TBD]` · Iop `[TBD A]`

### E7. Flight laser driver
- **Topology:** buck pre-regulator to ~Vf+0.5–1 V, then current sink; TTL gate; fail-off interlocks (command expiry 5 s, GNSS-invalid inhibit, >1 km AGL, physical arming plug, independent hardware enable line, stuck-on detection); measured battery-input power.
- **Fields:** `[TBD]`

### E8. Gimbal (pan/tilt)
- **Candidates:** brushless 2-axis with open-source controller (STorM32/SimpleBGC class), own IMU at 500 Hz, tilt range ≥±45°, pan for station-directed pointing; cable management.
- **Gotchas:** ±10° swing and 50° jet excursions; cold-motor behavior unverified; heading from magnetometer needs calibration near motors.
- **Fields:** `[TBD]`

### E9. Power
- 8× Energizer L91 (Li-FeS₂) [datasheet VERIFIED: ~1.6 Ah at 250 mA at −40 °C; ~0 at 1 A]; keep warm; low per-cell drain (consider parallel strings); heater film 1 W; energy budget by mode (~17–20 Wh need) vs measured pack capacity at temperature.
- **Fields:** Pack config `[TBD]` · Measured cold capacity `[TBD Wh]`

### E10. Structure and thermal
- 15 mm EPP shell; aluminum plate coupling diode to battery; rigging, swivel, parachute, radar reflector; mass ≤1.1 kg all-in (860 g budget, unweighed).
- **Fields:** Weighed mass `[TBD g]` · Thermal model `[none]`

---

## F. GROUND SOFTWARE (C4) — owner R6 (or R3+R5 fallback)

- Python 3.x; pyserial; OpenCV; numpy; PyQt5/6 or web (FastAPI + browser) front end; INDI or SynScan-protocol library for AZ-GTi; SSDV decoder (open-source C via wrapper or Python port); RS library (reedsolo or via SSDV).
- Modules: decoder service; image assembler; mount controller + state machine; guide processor; acceptance recorder; transmitter command; run logging (timestamped CSV/JSONL).
- **Fields:** Repo `[TBD]` · Framework `[TBD]` · Status `candidate`

---

## G. RF GROUND STATION — owner R2
- Certified LoRa module + Yagi; USB serial; NOTE: only needed for E-track and for GPS-seeded acquisition in C2 if the carrier carries a GNSS; C2 baseline can use a surveyed/known path instead.

---

## H. TEST EQUIPMENT (borrow/buy) — owner R1/R4
- H1 Optical power meter or calibrated photodiode (850 nm) — the single most important instrument; every attenuation and sensitivity number depends on it.
- H2 Oscilloscope ≥100 MHz; H3 bench supplies with current limit; H4 SDR/spectrum analyzer (RF link); H5 absorptive ND filter set (OD 1–3) + calibrated fiber attenuator for 90 dB flight tests; H6 beam profiler or camera-on-screen method for far-field measurement; H7 laser eyewear OD 4+ at 800–900 nm ×3; beam stops, signage, key switch; H8 dry ice cooler / vacuum chamber access (E-track).

---

## I. BALLOON OPERATIONS (E5) — owner R1/R4
- 800–1000 g latex envelope (800 g + 1.1 kg → ~2.97 m³ He for 5 m/s, ~29.7 km burst per CUSF model); parachute; line; swivel; radar reflector; helium (~3 m³); recovery beacon (independent, post-landing endurance requirement).
- **Fields:** Envelope `[TBD]` · Fill `[TBD m³]` · TC 602.42 interpretation `[pending]`

---

## J. UPDATE PROTOCOL
When a part is chosen:
1. Fill `Chosen part` and `Status: ordered/received`.
2. Note every downstream parameter it changes (wavelength → filter; C → TIA; mass → mount; Vbr → bias supply; area → FOV).
3. Add a decision-log entry (05) with date and reason.
4. When characterized, fill `Measured` fields and change the tag in 01_MASTER_CONTEXT where that number appears.
