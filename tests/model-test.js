#!/usr/bin/env node

"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Model = require("../Model.js")

const fixturePath = path.join(__dirname, "fixtures", "hugin-nct6798.json")
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"))
const parsed = Model.parseSensors(fixture)

assert.deepEqual(parsed.fans, [
  { name: "Fan 1", channel: 1, role: "fan", rpm: 886 },
  { name: "Fan 2", channel: 2, role: "fan", rpm: 876 },
  { name: "Fan 3", channel: 3, role: "fan", rpm: 850 },
  { name: "Fan 4", channel: 4, role: "fan", rpm: 886 },
  { name: "Fan 5", channel: 5, role: "fan", rpm: 870 },
  { name: "Fan 6", channel: 6, role: "fan", rpm: 862 },
  { name: "AIO Pump", channel: 7, role: "pump", rpm: 2406 }
])

assert.deepEqual(parsed.temps, [
  { name: "CPU", value: "38.0" },
  { name: "Board 1", value: "31.5" },
  { name: "NVMe 0400", value: "42.9" }
])

assert.equal(Model.parseSensorsJson("not json"), null)
assert.deepEqual(Model.parseSensors(null), { fans: [], temps: [] })

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
