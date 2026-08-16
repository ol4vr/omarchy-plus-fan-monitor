# Hugin Display Policy

This document records how Fan Monitor presents the accepted Hugin fan and temperature evidence.

Fan Monitor is read-only. This policy changes colors and labels only. It does not set PWM duty or control a fan; the separately reviewed native Omarchy+ service owns privileged control.

## Measured acoustic evidence

The pre-Omarchy 4 Hugin tests produced these observations:

| Duty | Observed speed | Assessment |
| ---: | ---: | --- |
| 10% | approximately 240–268 RPM | very quiet; accepted idle-floor candidate |
| approximately 30% | approximately 725–820 RPM | strong objectionable resonance; avoid |
| 35% | not retained as a fixed range | resonance begins to improve |
| 45% | approximately 1130–1200 RPM | acoustically clean; accepted normal gaming tier |
| 65% | approximately 1510–1645 RPM | acoustically clean but intentionally louder |

Do not design a future controller to dwell in the approximately 25–35% resonance band.

## Accepted controller policy

The accepted native CPU-temperature policy is:

| CPU temperature | Candidate duty |
| ---: | ---: |
| at or below 60°C | 10% |
| 61–67°C | 20% |
| 68–84°C | 45% |
| 85–89°C | 65% |
| 90–94°C | 85% |
| at or above 95°C | 100% |

The native controller jumps from 20% directly to 45%, reacts to sustained temperature instead of brief spikes, and cools down progressively.

## Fan Monitor temperature states

Fan Monitor derives read-only display states from the candidate temperature boundaries:

| Temperature | State | Presentation |
| ---: | --- | --- |
| below 68°C | normal | active bar foreground |
| 68–84.9°C | elevated | amber |
| 85–89.9°C | hot | urgent color |
| 90–94.9°C | critical | urgent color |
| at or above 95°C | emergency | urgent color |

The separate states preserve the evidence for future labels and notifications even when several states currently share the same urgent color.

## Safety boundary

- Monitor motherboard fan channels 1 through 6.
- Monitor channel 7 as the likely AIO pump, but never write it.
- Never write RTX 4090 fan controls.
- Never write PSU fan controls.
- Preserve NVIDIA automatic zero-RPM idle behavior.
- Treat the old measurements as migration evidence, not proof of current hwmon numbering.
- Accept commanded duty only from a healthy, fresh native-controller status.

## Stability evidence

A fixed 45% test completed for 900 seconds. The adaptive workload rerun also completed for 900 seconds with the heaviest available Satisfactory save and severe weather/reflections enabled.

An earlier adaptive freeze was not reproduced. No thermal failure, NVIDIA Xid, kernel panic, OOM, NVMe failure, or fan-transition cause was found.

## Live Quattro validation on 2026-08-16

Temporarily loading the available `nct6775` driver exposed an NCT6798D-compatible controller at `0x2e:0x290`. It caused no audible fan-speed change and made no control write.

The live read-only sample showed fan channels 1–6 at approximately 927–968 RPM and channel 7, the protected AIO pump, at approximately 2419 RPM. The application displayed all seven channels.

The accepted temperature presentation is deliberately narrower than the raw sensor inventory:

- CPU uses the `coretemp` package temperature.
- System uses the NCT6798D `SYSTIN` input.
- Four SPD5118 module readings are sorted and labelled RAM 1–4.
- Four NVMe composite readings retain their stable PCI suffixes.
- NCT `CPUTIN` and PECI readings are hidden as CPU duplicates.
- Unmapped AUX inputs, zero-valued PCH inputs, the observed 127°C artefact, and the unverified 68°C PCH input remain hidden.

The driver is not made persistent by this application. Persistent Hugin module loading belongs to the separately reviewed central Omarchy+ host integration.

## Native fan-control status integration

The central Omarchy+ service was persistently activated on 2026-08-16 after a bounded live gate. At the accepted 10% idle tier, channels 1–6 settled at approximately 252–268 RPM while CPU temperature remained 43–53°C. Channel 7 remained protected in Smart Fan IV mode at approximately 2406–2428 RPM. Stopping the bounded trial restored channels 1–6 to mode 5 before persistent activation was allowed.

Fan Monitor reads `/run/omarchy-plus/fan-control/status.json` without privilege. It accepts commanded duty only when schema 1 reports a running service, manual control, performed writes, a fresh snapshot, no error, exactly controlled channels 1–6, and protected channel 7 with null commands. Any missing or unhealthy contract is rejected and cannot be presented as authoritative controller data.

## GPU and refresh policy

The live RTX 4090 interface exposes GPU temperature and one aggregate fan percentage through `nvidia-smi`. It does not expose fan RPM through the installed interfaces. Fan Monitor therefore labels the row `GPU Fans`, displays active percentage only, and presents NVIDIA's normal 0% zero-RPM state as `Idle`. During live validation, the GPU returned automatically from its 30% minimum active duty to 0% without a control action; this is consistent with the card's automatic cooldown hysteresis and does not indicate a persistent override.

The motherboard PWM readings are paired only with fan channels 1–6 and rounded for display in the tooltip. Channel 7 remains RPM-only because its reported PWM value is not a valid percentage and the channel is protected as the likely AIO pump.

Five live samples measured `sensors -j` at 124–133 ms and the NVIDIA query at 14–17 ms. The accepted initial refresh interval is three seconds. The collector refuses overlapping process runs, remains read-only, and performs no control write.

The native Quattro shared tooltip centers each text line and exposes no alignment option to third-party widgets. Fan Monitor preserves that native surface and pads every monospaced line to an equal width so the visible content has a common left edge.
