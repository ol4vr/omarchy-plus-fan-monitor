#!/usr/bin/env node

"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Model = require("../Model.js")

const fixturePath = path.join(__dirname, "fixtures", "hugin-nct6798.json")
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"))
const controlFixturePath = path.join(__dirname, "fixtures", "hugin-fan-control-status.json")
const controlFixture = JSON.parse(fs.readFileSync(controlFixturePath, "utf8"))
const parsed = Model.parseSensors(fixture)

assert.deepEqual(parsed.fans, [
  { name: "Fan 1", channel: 1, role: "fan", rpm: 967, percent: 44 },
  { name: "Fan 2", channel: 2, role: "fan", rpm: 959, percent: 44 },
  { name: "Fan 3", channel: 3, role: "fan", rpm: 927, percent: 44 },
  { name: "Fan 4", channel: 4, role: "fan", rpm: 968, percent: 44 },
  { name: "Fan 5", channel: 5, role: "fan", rpm: 955, percent: 44 },
  { name: "Fan 6", channel: 6, role: "fan", rpm: 946, percent: 44 },
  { name: "AIO Pump", channel: 7, role: "pump", rpm: 2419 }
])

assert.deepEqual(parsed.temps, [
  { name: "CPU", value: "38.0" },
  { name: "System", value: "34.0" },
  { name: "RAM 1", value: "38.8" },
  { name: "RAM 2", value: "39.0" },
  { name: "RAM 3", value: "38.8" },
  { name: "RAM 4", value: "36.8" },
  { name: "NVMe 0200", value: "42.9" },
  { name: "NVMe 0300", value: "39.9" },
  { name: "NVMe 0500", value: "38.9" },
  { name: "NVMe 0900", value: "37.9" }
])

assert.equal(parsed.temps.some(item => item.name === "CPUTIN"), false)
assert.equal(parsed.temps.some(item => item.value === "127.0"), false)
assert.equal(parsed.temps.some(item => item.name.indexOf("PCH") !== -1), false)
assert.equal(Model.parseSensorsJson("not json"), null)
assert.deepEqual(Model.parseSensors(null), { fans: [], temps: [] })

const gpu = Model.parseNvidiaCsv("52, 0\n")
assert.deepEqual(gpu, {
  temp: { name: "GPU", value: "52.0" },
  fan: { name: "GPU Fans", role: "gpu", percent: 0 }
})
assert.equal(Model.parseNvidiaCsv("N/A, N/A"), null)

const merged = Model.mergeGpuTelemetry(parsed, gpu)
assert.equal(merged.fans[6].name, "GPU Fans")
assert.equal(merged.fans[7].name, "AIO Pump")
assert.equal(merged.temps[0].name, "CPU")
assert.equal(merged.temps[1].name, "GPU")
assert.equal(Model.fanStopped(gpu.fan), false)
assert.equal(Model.fanReadingText(gpu.fan, true), "Idle")
assert.equal(Model.fanReadingText(parsed.fans[0], true), "967 RPM (44%)")
assert.equal(Model.fanReadingText(parsed.fans[6], true), "2419 RPM")

const controlStatus = Model.parseFanControlStatus(controlFixture)
assert.deepEqual(controlStatus, {
  duties: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 },
  tierId: "idle",
  dutyPercent: 10
})
assert.deepEqual(Model.parseFanControlStatusJson(JSON.stringify(controlFixture)), controlStatus)
assert.equal(Model.parseFanControlStatusJson("not json"), null)

const controlled = Model.mergeFanControlStatus(merged, controlStatus)
assert.equal(controlled.fans[0].percent, 10)
assert.equal(controlled.fans[0].percentSource, "native-controller")
assert.equal(controlled.fans[6].name, "GPU Fans")
assert.equal(controlled.fans[6].percent, 0)
assert.equal(controlled.fans[7].name, "AIO Pump")
assert.equal(controlled.fans[7].percent, undefined)
assert.equal(Model.fanReadingText(controlled.fans[0], true), "967 RPM (10%)")

const failedControlFixture = JSON.parse(JSON.stringify(controlFixture))
failedControlFixture.service_state = "failed"
assert.equal(Model.parseFanControlStatus(failedControlFixture), null)
const unsafePumpFixture = JSON.parse(JSON.stringify(controlFixture))
unsafePumpFixture.channels[6].commanded_duty_percent = 100
assert.equal(Model.parseFanControlStatus(unsafePumpFixture), null)
const missingChannelFixture = JSON.parse(JSON.stringify(controlFixture))
missingChannelFixture.channels.splice(5, 1)
assert.equal(Model.parseFanControlStatus(missingChannelFixture), null)

const tooltipLines = Model.fanTooltipText(merged.fans).split("\n")
assert.equal(tooltipLines[0].trimEnd(), "Fan 1: 967 RPM (44%)")
assert.equal(tooltipLines[6].trimEnd(), "GPU Fans: Idle")
assert.equal(tooltipLines[7].trimEnd(), "AIO Pump: 2419 RPM")
assert.equal(tooltipLines[8].trimEnd(), "Click to view details")
assert.equal(new Set(tooltipLines.map(line => line.length)).size, 1)

const legacy = Model.parseSensors({
  "it8689-isa-0a40": {
    fan1: { fan1_input: 720.4 },
    temp1: { temp1_input: 30.0 }
  }
})
assert.deepEqual(legacy.fans, [
  { name: "fan1", channel: 1, role: "fan", rpm: 720 }
])
assert.deepEqual(legacy.temps, [
  { name: "Board 1", value: "30.0" }
])

assert.equal(Model.temperatureState("invalid"), "unknown")
assert.equal(Model.temperatureState(67.9), "normal")
assert.equal(Model.temperatureState(68), "elevated")
assert.equal(Model.temperatureState(84.9), "elevated")
assert.equal(Model.temperatureState(85), "hot")
assert.equal(Model.temperatureState(89.9), "hot")
assert.equal(Model.temperatureState(90), "critical")
assert.equal(Model.temperatureState(94.9), "critical")
assert.equal(Model.temperatureState(95), "emergency")

console.log("Fan Monitor model tests: PASS")
