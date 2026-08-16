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

- Polls `sensors -j` every 30 seconds.
- Shows a bar badge whose color reflects the highest displayed temperature.
- Opens a details popup with fan RPM and CPU, board, and NVMe temperatures.
- Refreshes immediately when the details popup opens.
- Does not control fans.

## Security boundary

Runtime collection is read-only. The application executes `sensors -j` as the signed-in user.

It does not use `sudo`, write hwmon controls, install packages, run services, contact a network endpoint, or change fan policy.

Do not run `sensors-detect` solely for this application. Hardware detection is a separate reviewed host-administration action when a system does not already expose the required sensors.

## Requirements

- Omarchy Quattro
- `lm_sensors`
- working sensor exposure through `sensors -j`
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

The deployment refuses Git-managed production checkouts and unrecognized directories. It does not enable the application automatically.

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
