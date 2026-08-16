# Fan Monitor

Fan Monitor is an Omarchy+ bar application that shows fan speed and temperature status. It retains the accepted upstream visual design while its runtime contract, sensor model, tests, and deployment lifecycle are adapted for Omarchy+.

![Fan Monitor widget in the bar](preview.png)

## Status

Owned development is in progress. This repository is not yet the accepted production source for Hugin.

The permanent application ID is:

```text
io.github.ol4vr.fan-monitor
```

## Current behavior

- Polls `sensors -j` and the minimal NVIDIA query every 3 seconds; overlapping polls are suppressed.
- Shows a bar badge whose color reflects the highest displayed temperature.
- Opens a details popup with Hugin fan RPM, RTX 4090 aggregate fan percentage, and CPU, GPU, System, RAM, and NVMe temperatures.
- Refreshes immediately when the details popup opens.
- Does not control fans.

## Quattro runtime contract

`manifest.json` loads `BarWidget.qml`. The bar widget owns read-only sensor polling, badge state, and the bar button. It loads `Panel.qml` internally and forwards Quattro's open, close, toggle, Escape, focus, and bar-popup switching lifecycle.

The panel preserves the accepted upstream Fan Monitor information hierarchy, colors, labels, fan rows, and temperature rows while using Omarchy's native `KeyboardPanel` surface.

## Sensor model

`Model.js` parses `sensors -j` without Qt dependencies and is tested under Node with sanitized fixtures.

Supported data contracts:

| Chip family | Displayed data |
| --- | --- |
| `nct6798` | Hugin fan channels 1–6, monitored AIO pump channel 7, and allowlisted `SYSTIN` System temperature |
| `it8689` / `it87` | Fan speeds and valid legacy board temperatures |
| `coretemp` | CPU package temperature |
| `spd5118` | RAM-module temperatures, sorted by stable chip identity |
| `nvme` | Composite temperature, sorted by PCI identity |
| NVIDIA `nvidia-smi` | GPU temperature and aggregate fan percentage; no control and no RPM claim |

Fan Monitor only reads channel 7. It never writes pump or fan controls. Motherboard fan rows show RPM and the paired PWM1–PWM6 percentage. The GPU row uses NVIDIA's aggregate percentage and reads `Idle` when the driver reports 0%.

The Hugin fixture mirrors the live NCT6798D, four-DIMM SPD5118, CPU, and four-NVMe sensor shapes observed on 2026-08-16. The model accepts only the mapped NCT6798 `SYSTIN` reading; duplicate CPU inputs, unknown AUX inputs, zero-valued inputs, the observed 127°C artefact, and the currently unverified PCH input remain hidden.

Read-only display colors use the accepted Hugin boundaries: normal below 68°C, amber from 68°C, and urgent from 85°C. Separate hot, critical, and emergency model states preserve the 85°C, 90°C, and 95°C policy boundaries for later UI review.

See `docs/HUGIN_DISPLAY_POLICY.md` for measured acoustic evidence, the proposed controller curve, stability results, and safety limits.

## Security boundary

Runtime collection is read-only. The application executes `sensors -j` and a minimal `nvidia-smi` temperature/fan query as the signed-in user.

It does not use `sudo`, write hwmon controls, install packages, run services, contact a network endpoint, or change fan policy.

Do not run `sensors-detect` solely for this application. Hardware detection is a separate reviewed host-administration action when a system does not already expose the required sensors.

On Hugin, temporarily loading `nct6775` exposed the NCT6798D telemetry without an audible fan change. Persistent module loading remains a separate central Omarchy+ host-integration decision; this application neither loads the driver nor writes its PWM controls.

## Requirements

- Omarchy Quattro
- `lm_sensors`
- working sensor exposure through `sensors -j`; Hugin fan telemetry requires the read-only `nct6775` kernel driver
- NVIDIA systems: `nvidia-smi` supplied by the installed driver
- a Nerd Font supplied by the active Omarchy bar

## Development ownership

The authoritative source checkout on Hugin is:

```text
/home/ol4vr/Projects/omarchy-plus-apps/fan-monitor
```

The central `/home/ol4vr/Projects/omarchy-plus` repository owns production commit pins, host selection, enablement, placement, and integration validation.

Do not edit the live plugin directory as authoritative source.

## Development tools

Validate source without changing live configuration:

```bash
./scripts/validate
```

Validate the complete development deployment path without installing anything:

```bash
./scripts/dev-deploy --check
```

Deploy a disposable live development copy only after review:

```bash
./scripts/dev-deploy
```

The deployment refuses Git-managed production checkouts and unrecognized directories. It does not enable the application automatically. A successful live deployment restarts `omarchy-shell` because Quattro cannot currently evict changed plugin QML from its component cache; it never uses `omarchy refresh shell`, which would reset `shell.json`.

Inspect or remove only a marker-owned development copy:

```bash
./scripts/dev-remove --check
./scripts/dev-remove
```

The removal command never removes the source repository or a Git-managed production checkout.

## Provenance

Fan Monitor is derived from [`elynch303/fan-monitor`](https://github.com/elynch303/fan-monitor) at commit `0c0b45716517f50f668e4df51e725130ebde628e`.

The fork preserves the upstream Git history, MIT license, copyright notice, and attribution. See `UPSTREAM.md` for the update policy.

## License

MIT. See `LICENSE`.
