// Pure telemetry parsing and presentation helpers for Fan Monitor.
//
// Keep this file independent of Qt and Quickshell so the same data contract
// can be verified under Node before the plugin is loaded into omarchy-shell.

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function finiteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null
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

function validTemperature(value, maximum) {
  return value !== null && value > -50 && value < maximum
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
  if (match[1] === "1") return "CPU Fans"
  if (match[1] === "2") return "Case Fans"
  if (match[1] === "7") return "AIO Pump"
  return "Fan " + match[1]
}

function pwmPercentage(sensor, sensorName) {
  if (!isObject(sensor)) return null
  var value = finiteNumber(sensor[sensorName])
  if (value === null) value = finiteNumber(sensor[sensorName + "_input"])
  if (value === null || value < 0 || value > 100) return null
  return Math.round(value)
}

function appendBoardData(chip, chipData, fans, systemTemps, legacyBoardTemps) {
  var isNct6798 = String(chip).toLowerCase().indexOf("nct6798") !== -1
  var sensorNames = Object.keys(chipData)
  var percentages = {}

  for (var dutyIndex = 0; dutyIndex < sensorNames.length; dutyIndex++) {
    var dutyName = sensorNames[dutyIndex]
    var dutyMatch = /^pwm([1-6])$/.exec(dutyName)
    if (!dutyMatch) continue
    var duty = pwmPercentage(chipData[dutyName], dutyName)
    if (duty !== null) percentages[Number(dutyMatch[1])] = duty
  }

  for (var i = 0; i < sensorNames.length; i++) {
    var sensorName = sensorNames[i]
    var sensor = chipData[sensorName]
    if (!isObject(sensor)) continue

    var fanMatch = /^fan([0-9]+)$/.exec(sensorName)
    if (fanMatch) {
      var channel = Number(fanMatch[1])
      if (isNct6798 && channel >= 3 && channel <= 6) continue
      var rpm = finiteNumber(sensor[sensorName + "_input"])
      if (rpm !== null && rpm >= 0) {
        var fan = {
          name: fanDisplayName(chip, sensorName),
          channel: channel,
          role: fanMatch[1] === "7" && isNct6798 ? "pump" : "fan",
          rpm: Math.round(rpm)
        }
        if (percentages[channel] !== undefined)
          fan.percent = percentages[channel]
        fans.push(fan)
      }
      continue
    }

    // Hugin's NCT6798D exposes several duplicate, unlabelled, zero, or
    // demonstrably spurious motherboard readings. SYSTIN is the sole board
    // temperature accepted for display until the other inputs are mapped.
    if (isNct6798) {
      if (sensorName === "SYSTIN") {
        var systemValue = firstInputValue(sensor)
        if (validTemperature(systemValue, 120))
          systemTemps.push({ name: "System", value: systemValue.toFixed(1) })
      }
      continue
    }

    var tempMatch = /^temp([0-9]+)$/.exec(sensorName)
    if (tempMatch) {
      var boardValue = finiteNumber(sensor[sensorName + "_input"])
      if (validTemperature(boardValue, 120)) {
        legacyBoardTemps.push({
          name: "Board " + tempMatch[1],
          value: boardValue.toFixed(1)
        })
      }
    }
  }
}

function appendCpuTemperature(chipData, temps) {
  var value = firstInputValue(chipData["Package id 0"])
  if (!validTemperature(value, 120)) return
  temps.push({ name: "CPU", value: value.toFixed(1) })
}

function appendMemoryTemperature(chip, chipData, memorySources) {
  var value = firstInputValue(chipData.temp1)
  if (!validTemperature(value, 100)) return
  memorySources.push({ chip: String(chip), value: value })
}

function appendNvmeTemperature(chip, chipData, nvmeSources) {
  var value = firstInputValue(chipData.Composite)
  if (!validTemperature(value, 100)) return
  nvmeSources.push({ chip: String(chip), value: value })
}

function parseSensors(data) {
  if (!isObject(data)) return { fans: [], temps: [] }

  var fans = []
  var cpuTemps = []
  var systemTemps = []
  var memorySources = []
  var legacyBoardTemps = []
  var nvmeSources = []
  var chips = Object.keys(data)

  for (var i = 0; i < chips.length; i++) {
    var chip = chips[i]
    var chipData = data[chip]
    if (!isObject(chipData)) continue

    var lowerChip = String(chip).toLowerCase()
    if (isBoardChip(chip))
      appendBoardData(chip, chipData, fans, systemTemps, legacyBoardTemps)
    else if (lowerChip.indexOf("coretemp") !== -1)
      appendCpuTemperature(chipData, cpuTemps)
    else if (lowerChip.indexOf("spd5118") !== -1)
      appendMemoryTemperature(chip, chipData, memorySources)
    else if (lowerChip.indexOf("nvme") !== -1)
      appendNvmeTemperature(chip, chipData, nvmeSources)
  }

  fans.sort(function(a, b) { return a.channel - b.channel })
  memorySources.sort(function(a, b) { return a.chip.localeCompare(b.chip) })
  nvmeSources.sort(function(a, b) { return a.chip.localeCompare(b.chip) })

  var memoryTemps = []
  for (var memoryIndex = 0; memoryIndex < memorySources.length; memoryIndex++) {
    memoryTemps.push({
      name: "RAM " + (memoryIndex + 1),
      value: memorySources[memoryIndex].value.toFixed(1)
    })
  }

  var nvmeTemps = []
  for (var nvmeIndex = 0; nvmeIndex < nvmeSources.length; nvmeIndex++) {
    var parts = nvmeSources[nvmeIndex].chip.split("-")
    nvmeTemps.push({
      name: "NVMe " + parts[parts.length - 1],
      value: nvmeSources[nvmeIndex].value.toFixed(1)
    })
  }

  return {
    fans: fans,
    temps: cpuTemps.concat(systemTemps, memoryTemps, legacyBoardTemps, nvmeTemps)
  }
}

function parseSensorsJson(raw) {
  try {
    return parseSensors(JSON.parse(String(raw)))
  } catch (error) {
    return null
  }
}

function parseLegacyFanControlChannels(channels) {
  var duties = {}
  var protectedFound = false

  for (var i = 0; i < channels.length; i++) {
    var channel = channels[i]
    if (!isObject(channel)) return null
    var index = finiteNumber(channel.index)
    if (index === null || Math.floor(index) !== index) return null

    if (index >= 1 && index <= 6) {
      if (channel.role !== "controlled" || duties[index] !== undefined) return null
      var duty = finiteNumber(channel.commanded_duty_percent)
      var raw = finiteNumber(channel.commanded_pwm_raw)
      var enable = finiteNumber(channel.pwm_enable)
      if (duty === null || duty < 0 || duty > 100) return null
      if (raw === null || raw < 0 || raw > 255 || enable !== 1) return null
      duties[index] = Math.round(duty)
    } else if (index === 7) {
      if (protectedFound || channel.role !== "protected") return null
      if (channel.commanded_duty_percent !== null || channel.commanded_pwm_raw !== null)
        return null
      protectedFound = true
    } else {
      return null
    }
  }

  return Object.keys(duties).length === 6 && protectedFound ? duties : null
}

function parseGroupedFanControlChannels(channels) {
  var duties = {}
  var seen = {}
  var expectedGroups = { 1: "cpu_fans", 2: "case_fans" }
  var expectedNames = { 1: "CPU Fans", 2: "Case Fans" }

  for (var i = 0; i < channels.length; i++) {
    var channel = channels[i]
    if (!isObject(channel)) return null
    var index = finiteNumber(channel.index)
    if (index === null || Math.floor(index) !== index || index < 1 || index > 7)
      return null
    if (seen[index]) return null
    seen[index] = true

    if (index === 1 || index === 2) {
      if (channel.role !== "controlled" ||
          channel.fan_group_id !== expectedGroups[index] ||
          channel.name !== expectedNames[index]) return null
      var duty = finiteNumber(channel.commanded_duty_percent)
      var raw = finiteNumber(channel.commanded_pwm_raw)
      var enable = finiteNumber(channel.pwm_enable)
      if (duty === null || duty < 0 || duty > 100) return null
      if (raw === null || raw < 0 || raw > 255 || enable !== 1) return null
      duties[index] = Math.round(duty)
    } else if (index >= 3 && index <= 6) {
      if (channel.role !== "unused") return null
      if (channel.commanded_duty_percent !== null || channel.commanded_pwm_raw !== null)
        return null
    } else {
      if (channel.role !== "protected") return null
      if (channel.commanded_duty_percent !== null || channel.commanded_pwm_raw !== null)
        return null
    }
  }

  return Object.keys(seen).length === 7 && Object.keys(duties).length === 2 ? duties : null
}

function parseFanControlStatus(data) {
  if (!isObject(data) || (data.schema !== 1 && data.schema !== 2)) return null
  if (data.service_state !== "running" || data.control_mode !== "manual") return null
  if (data.writes_performed !== true || data.snapshot_fresh !== true || data.error !== null)
    return null
  if (!isObject(data.controller) || data.controller.name !== "nct6798") return null
  if (!isObject(data.policy) || !Array.isArray(data.channels) || data.channels.length !== 7)
    return null

  var duties = data.schema === 1
    ? parseLegacyFanControlChannels(data.channels)
    : parseGroupedFanControlChannels(data.channels)
  if (duties === null) return null

  if (data.schema === 1) {
    var policyDuty = finiteNumber(data.policy.duty_percent)
    if (policyDuty === null || policyDuty < 0 || policyDuty > 100) return null
  } else {
    if (!isObject(data.policy.outputs)) return null
    var cpuOutput = data.policy.outputs.cpu_fans
    var caseOutput = data.policy.outputs.case_fans
    if (!isObject(cpuOutput) || !isObject(caseOutput)) return null
    if (finiteNumber(cpuOutput.duty_percent) !== duties[1] ||
        finiteNumber(caseOutput.duty_percent) !== duties[2]) return null
  }

  return {
    duties: duties,
    tierId: String(data.policy.tier_id || "")
  }
}

function parseFanControlStatusJson(raw) {
  try {
    return parseFanControlStatus(JSON.parse(String(raw)))
  } catch (error) {
    return null
  }
}

function mergeFanControlStatus(sensorData, controlData) {
  var base = isObject(sensorData) ? sensorData : { fans: [], temps: [] }
  var sourceFans = Array.isArray(base.fans) ? base.fans : []
  var temps = Array.isArray(base.temps) ? base.temps.slice() : []
  var fans = []

  for (var i = 0; i < sourceFans.length; i++) {
    var source = sourceFans[i]
    var fan = {}
    var keys = Object.keys(source)
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex++)
      fan[keys[keyIndex]] = source[keys[keyIndex]]

    if (controlData && isObject(controlData.duties) && fan.role === "fan" &&
        controlData.duties[fan.channel] !== undefined) {
      fan.percent = controlData.duties[fan.channel]
      fan.percentSource = "native-controller"
    }
    fans.push(fan)
  }

  return { fans: fans, temps: temps }
}

function parseNvidiaCsv(raw) {
  var line = String(raw || "").trim().split(/\r?\n/)[0]
  if (!line) return null
  var fields = line.split(",")
  if (fields.length < 2) return null

  var temperature = finiteNumber(fields[0].trim())
  var percentage = finiteNumber(fields[1].trim())
  var result = { temp: null, fan: null }

  if (validTemperature(temperature, 120))
    result.temp = { name: "GPU", value: temperature.toFixed(1) }
  if (percentage !== null && percentage >= 0 && percentage <= 100) {
    result.fan = {
      name: "GPU Fans",
      role: "gpu",
      percent: Math.round(percentage)
    }
  }

  return result.temp || result.fan ? result : null
}

function mergeGpuTelemetry(sensorData, gpuData) {
  var base = isObject(sensorData) ? sensorData : { fans: [], temps: [] }
  var fans = Array.isArray(base.fans) ? base.fans.slice() : []
  var temps = Array.isArray(base.temps) ? base.temps.slice() : []

  if (gpuData && gpuData.fan) {
    var pumpIndex = fans.length
    for (var fanIndex = 0; fanIndex < fans.length; fanIndex++) {
      if (fans[fanIndex].role === "pump") {
        pumpIndex = fanIndex
        break
      }
    }
    fans.splice(pumpIndex, 0, gpuData.fan)
  }

  if (gpuData && gpuData.temp) {
    var cpuIndex = -1
    for (var tempIndex = 0; tempIndex < temps.length; tempIndex++) {
      if (temps[tempIndex].name === "CPU") {
        cpuIndex = tempIndex
        break
      }
    }
    temps.splice(cpuIndex + 1, 0, gpuData.temp)
  }

  return { fans: fans, temps: temps }
}

function fanStopped(fan) {
  if (!isObject(fan) || fan.role === "gpu") return false
  var rpm = finiteNumber(fan.rpm)
  return rpm !== null && rpm === 0
}

function fanReadingText(fan, includePercentage) {
  if (!isObject(fan)) return "Unavailable"
  var rpm = finiteNumber(fan.rpm)
  var percentage = finiteNumber(fan.percent)
  var text = ""

  if (fan.role === "gpu" && percentage === 0)
    return "Idle"
  if (rpm !== null)
    text = rpm === 0 ? "STOPPED" : Math.round(rpm) + " RPM"
  else if (percentage !== null)
    return Math.round(percentage) + "%"
  else
    return "Unavailable"

  if (includePercentage && percentage !== null)
    text += " (" + Math.round(percentage) + "%)"
  return text
}

function padRight(value, width) {
  var text = String(value)
  while (text.length < width) text += "\u00a0"
  return text
}

function fanTooltipText(fans) {
  var rows = []
  var values = Array.isArray(fans) ? fans : []
  if (values.length === 0) rows.push("No fan data")
  else {
    for (var i = 0; i < values.length; i++)
      rows.push(values[i].name + ": " + fanReadingText(values[i], true))
  }
  rows.push("Click to view details")

  var width = 0
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex++)
    if (rows[rowIndex].length > width) width = rows[rowIndex].length
  for (var padIndex = 0; padIndex < rows.length; padIndex++)
    rows[padIndex] = padRight(rows[padIndex], width)
  return rows.join("\n")
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
    parseNvidiaCsv: parseNvidiaCsv,
    parseFanControlStatus: parseFanControlStatus,
    parseFanControlStatusJson: parseFanControlStatusJson,
    mergeFanControlStatus: mergeFanControlStatus,
    mergeGpuTelemetry: mergeGpuTelemetry,
    fanStopped: fanStopped,
    fanReadingText: fanReadingText,
    fanTooltipText: fanTooltipText,
    temperatureState: temperatureState
  }
}
