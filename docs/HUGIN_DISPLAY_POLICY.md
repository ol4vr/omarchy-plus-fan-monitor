# Hugin Display Policy

This document records how Fan Monitor presents Hugin's accepted post-upgrade fan topology and temperature evidence.

Fan Monitor is read-only. The central Omarchy+ service owns privileged motherboard fan control.

## Accepted fan topology

The topology was re-established after Hugin received a new AIO cooler and new fans on 2026-08-20:

| NCT6798 channel | Display name | Role |
| ---: | --- | --- |
| 1 | CPU Fans | controlled radiator-fan group |
| 2 | Case Fans | controlled chassis-fan hub |
| 3–6 | hidden | physically unused |
| 7 | AIO Pump | protected, RPM-only |

Channels 3–6 report zero RPM because no fan is connected. They are not stopped fans and must never trigger the `FAN STOPPED` warning. Channel 7 remains visible for pump monitoring but never receives a commanded duty.

## Measured acoustic evidence

The new fans were swept independently at idle and from 30% through 100%:

- CPU Fans were quiet through 40%, acceptable through 70%, and still free of resonance at 100%.
- Case Fans were quiet at 30%, acceptable at 40–50%, loud at 60–70%, and too loud at 80–100% for ordinary use.
- No resonance was heard anywhere in either high-range sweep.
- A slight background hum persisted across every fan setting and is most consistent with the full-speed AIO pump. It is acceptable and the pump remains untouched.

The former hardware's 25–35% resonance restriction no longer applies to this topology.

## Accepted independent controller curve

Fan Monitor displays the separate commanded duties published for the active temperature tier:

| Tier | CPU Fans | Case Fans |
| --- | ---: | ---: |
| idle | 25% | 18% |
| warm | 40% | 30% |
| gaming | 60% | 40% |
| high | 80% | 60% |
| very-high | 100% | 80% |
| emergency | 100% | 100% |

The existing temperature thresholds, rise grace periods, filtering, hysteresis, progressive cooldown, and immediate 95°C emergency response remain host-policy responsibilities.

## Native status migration

Fan Monitor accepts two exact runtime contracts during the deployment transition:

- schema 1: legacy shared control on channels 1–6 with channel 7 protected;
- schema 2: independent control on channels 1 and 2, channels 3–6 explicitly unused, and channel 7 protected.

Both contracts must report a running manual controller, performed writes, a fresh snapshot, no error, seven unique channels, valid commanded values for controlled channels, and null commands for protected or unused channels. Schema 2 must also identify `cpu_fans` / `CPU Fans` and `case_fans` / `Case Fans`, and its policy outputs must match the per-channel commands.

The dual reader lets Fan Monitor 0.7.0 deploy safely before the controller migrates to schema 2. Invalid or unhealthy status is rejected and cannot override read-only sensor percentages.

## Temperature presentation

| Temperature | State | Presentation |
| ---: | --- | --- |
| below 68°C | normal | active bar foreground |
| 68–84.9°C | elevated | amber |
| 85–89.9°C | hot | urgent color |
| 90–94.9°C | critical | urgent color |
| at or above 95°C | emergency | urgent color |

CPU uses `coretemp` / `Package id 0`. System uses NCT6798 `SYSTIN`. Four SPD5118 module readings are sorted as RAM 1–4. NVMe composite temperatures retain stable PCI suffixes. Duplicate CPU readings, unmapped AUX inputs, zero-valued PCH inputs, and known spurious readings remain hidden.

## Safety boundary

- Read CPU Fans on channel 1 and Case Fans on channel 2.
- Hide physically unused channels 3–6.
- Monitor AIO Pump channel 7 without presenting a commanded duty.
- Never write motherboard fan or pump controls.
- Never write RTX 4090 fan controls.
- Never write PSU fan controls.
- Preserve NVIDIA automatic zero-RPM idle behavior.
- Accept commanded duty only from a healthy, fresh native-controller status.

The RTX 4090 row uses NVIDIA's aggregate fan percentage because the installed interface does not expose fan RPM. A reported 0% is presented as `Idle`.

The collector polls every three seconds, refuses overlapping process runs, remains read-only, and performs no control write.
