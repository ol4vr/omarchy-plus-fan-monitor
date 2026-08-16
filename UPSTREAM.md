# Upstream Provenance

Fan Monitor is derived from:

```text
upstream repository: https://github.com/elynch303/fan-monitor
fork base commit: 0c0b45716517f50f668e4df51e725130ebde628e
owned repository: https://github.com/ol4vr/omarchy-plus-fan-monitor
license: MIT
```

The upstream Git history, `LICENSE`, copyright notice, and attribution remain preserved.

## Remote policy

```text
origin    Olav-owned fork; fetch and push
upstream  authoritative source; fetch only
```

Upstream push is disabled. `remote.pushDefault` is `origin`.

## Update policy

Do not merge or fast-forward upstream automatically.

For a useful upstream change:

1. fetch `upstream`;
2. inspect the exact commit range and file diff;
3. review runtime commands, dependencies, privileges, persistent state, network behavior, shell compatibility, and UI changes;
4. cherry-pick or adapt only the accepted change;
5. run source validation and live acceptance;
6. preserve Omarchy+ behavior and presentation unless a reviewed change improves it;
7. update this provenance record when the accepted upstream base changes.

An upstream deletion, redesign, or feature removal does not change the owned application automatically.
