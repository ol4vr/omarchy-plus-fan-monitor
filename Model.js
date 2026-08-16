// Pure lm_sensors JSON parsing for Fan Monitor.
//
// Keep this file independent of Qt and Quickshell so the same data contract
// can be verified under Node before the plugin is loaded into omarchy-shell.

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function finiteNumber(value) {
  var number = Number(value)
  return isFinite(number) ? number : null
}

function firstInputValue(sensor) {
  if (!isObject(sensor)) return null
  var keys = Object.keys(sensor)
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].indexOf("_input") === -1) continue
    var number = finiteNumber(sensor[keys[i]])
    if (number !== null) return number
  }
  return null
}

function isBoardChip(chip) {
  var name = String(chip).toLowerCase()
  return name.indexOf("nct6798") !== -1 ||
    name.indexOf("it8689") !== -1 ||
    name.indexOf("it87") !== -1
}

function fanDisplayName(chip, sensorName) {
  var match = /^fan([0-9]+)$/.exec(sensorName)
  if (!match) return sensorName
  if (String(chip).toLowerCase().indexOf("nct6798") === -1) return sensorName
  return match[1] === "7" ? "AIO Pump" : "Fan " + match[1]
}

function appendBoardData(chip, chipData, fans, temps) {
  var sensorNames = Object.keys(chipData)
  for (var i = 0; i < sensorNames.length; i++) {
    var sensorName = sensorNames[i]
    var sensor = chipData[sensorName]
    if (!isObject(sensor)) continue

    var fanMatch = /^fan([0-9]+)$/.exec(sensorName)
    if (fanMatch) {
      var fanKey = sensorName + "_input"
      var rpm = finiteNumber(sensor[fanKey])
      if (rpm !== null && rpm >= 0) {
        fans.push({
          name: fanDisplayName(chip, sensorName),
          channel: Number(fanMatch[1]),
          role: fanMatch[1] === "7" && String(chip).toLowerCase().indexOf("nct6798") !== -1
            ? "pump"
            : "fan",
          rpm: Math.round(rpm)
        })
      }
      continue
    }

    var tempMatch = /^temp([0-9]+)$/.exec(sensorName)
    if (tempMatch) {
      var tempKey = sensorName + "_input"
      var boardTemp = finiteNumber(sensor[tempKey])
      if (boardTemp !== null && boardTemp > -50 && boardTemp < 120) {
        temps.push({
          name: "Board " + tempMatch[1],
          value: boardTemp.toFixed(1)
        })
      }
    }
  }
}

function prependCpuTemperature(chipData, temps) {
  var sensor = chipData["Package id 0"]
  var value = firstInputValue(sensor)
  if (value === null || value <= -50 || value >= 120) return
  temps.unshift({ name: "CPU", value: value.toFixed(1) })
}

function appendNvmeTemperature(chip, chipData, temps) {
  var value = firstInputValue(chipData.Composite)
  if (value === null || value <= -50 || value >= 100) return
  var parts = String(chip).split("-")
  temps.push({ name: "NVMe " + parts[parts.length - 1], value: value.toFixed(1) })
}

function parseSensors(data) {
  if (!isObject(data)) return { fans: [], temps: [] }

  var fans = []
  var temps = []
  var chips = Object.keys(data)

  for (var i = 0; i < chips.length; i++) {
    var chip = chips[i]
    var chipData = data[chip]
    if (!isObject(chipData)) continue

    if (isBoardChip(chip))
      appendBoardData(chip, chipData, fans, temps)
    else if (String(chip).toLowerCase().indexOf("coretemp") !== -1)
      prependCpuTemperature(chipData, temps)
    else if (String(chip).toLowerCase().indexOf("nvme") !== -1)
      appendNvmeTemperature(chip, chipData, temps)
  }

  return { fans: fans, temps: temps }
}

function parseSensorsJson(raw) {
  try {
    return parseSensors(JSON.parse(String(raw)))
  } catch (error) {
    return null
  }
}

// Read-only presentation tiers derived from Hugin's proposed controller
// boundaries. They do not apply PWM duty or change host fan policy.
function temperatureState(value) {
  var temperature = finiteNumber(value)
  if (temperature === null) return "unknown"
  if (temperature >= 95) return "emergency"
  if (temperature >= 90) return "critical"
  if (temperature >= 85) return "hot"
  if (temperature >= 68) return "elevated"
  return "normal"
}

if (typeof module !== "undefined") {
  module.exports = {
    parseSensors: parseSensors,
    parseSensorsJson: parseSensorsJson,
    temperatureState: temperatureState
  }
}
