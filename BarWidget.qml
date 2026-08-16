import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// Bar host and read-only sensor collector. The nested Panel.qml owns the
// details surface; this root forwards the lifecycle required by Quattro.
BarWidget {
  id: root
  moduleName: "io.github.ol4vr.fan-monitor"

  property var fans: []
  property var temps: []
  property bool loaded: false

  readonly property bool hasDeadFan: {
    var f = fans
    for (var i = 0; i < f.length; i++) {
      if (f[i].rpm === 0) return true
    }
    return false
  }

  function refresh() {
    if (!sensorsProc.running) sensorsProc.running = true
  }

  function parseSensors(raw) {
    try {
      var data = JSON.parse(raw)
      var newFans = []
      var newTemps = []
      var chips = Object.keys(data)

      for (var ci = 0; ci < chips.length; ci++) {
        var chip = chips[ci]
        var chipData = data[chip]
        if (typeof chipData !== "object" || chipData === null) continue
        var skeys = Object.keys(chipData)

        if (chip.indexOf("it8689") !== -1 || chip.indexOf("it87") !== -1) {
          for (var si = 0; si < skeys.length; si++) {
            var sname = skeys[si]
            var sval = chipData[sname]
            if (typeof sval !== "object" || sval === null) continue

            if (sname.indexOf("fan") === 0) {
              var fk = sname + "_input"
              if (sval.hasOwnProperty(fk))
                newFans.push({ name: sname, rpm: Math.round(sval[fk]) })
            } else if (sname.indexOf("temp") === 0) {
              var tk = sname + "_input"
              if (sval.hasOwnProperty(tk)) {
                var boardTemp = sval[tk]
                if (boardTemp > -50 && boardTemp < 120)
                  newTemps.push({ name: "Board " + sname.replace("temp", ""), value: boardTemp.toFixed(1) })
              }
            }
          }
        } else if (chip.indexOf("coretemp") !== -1) {
          for (var coreIndex = 0; coreIndex < skeys.length; coreIndex++) {
            var coreName = skeys[coreIndex]
            if (coreName !== "Package id 0") continue
            var coreValue = chipData[coreName]
            if (typeof coreValue !== "object" || coreValue === null) continue
            var coreKeys = Object.keys(coreValue)
            for (var coreKeyIndex = 0; coreKeyIndex < coreKeys.length; coreKeyIndex++) {
              if (coreKeys[coreKeyIndex].indexOf("_input") !== -1) {
                newTemps.unshift({ name: "CPU", value: coreValue[coreKeys[coreKeyIndex]].toFixed(1) })
                break
              }
            }
          }
        } else if (chip.indexOf("nvme") !== -1) {
          for (var nvmeIndex = 0; nvmeIndex < skeys.length; nvmeIndex++) {
            var nvmeName = skeys[nvmeIndex]
            if (nvmeName !== "Composite") continue
            var nvmeValue = chipData[nvmeName]
            if (typeof nvmeValue !== "object" || nvmeValue === null) continue
            var nvmeKeys = Object.keys(nvmeValue)
            for (var nvmeKeyIndex = 0; nvmeKeyIndex < nvmeKeys.length; nvmeKeyIndex++) {
              if (nvmeKeys[nvmeKeyIndex].indexOf("_input") !== -1) {
                var nvmeTemp = nvmeValue[nvmeKeys[nvmeKeyIndex]]
                if (nvmeTemp > -50 && nvmeTemp < 100)
                  newTemps.push({ name: "NVMe " + chip.slice(-4), value: nvmeTemp.toFixed(1) })
                break
              }
            }
          }
        }
      }

      fans = newFans
      temps = newTemps
      loaded = true
    } catch (error) {
      // Keep the last good values when a collection is incomplete.
    }
  }

  Process {
    id: sensorsProc
    command: ["sensors", "-j"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.parseSensors(text)
    }
  }

  Timer {
    interval: 30000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  readonly property string tooltipText: {
    if (fans.length === 0) return "Fans & temps\nClick to view details"
    var parts = []
    for (var i = 0; i < fans.length; i++)
      parts.push(fans[i].name + ": " + (fans[i].rpm === 0 ? "STOPPED" : fans[i].rpm + " RPM"))
    return parts.join("\n") + "\nClick to view details"
  }

  readonly property color primaryColor: root.bar ? root.bar.barForeground : Color.foreground

  readonly property real worstTemp: {
    var highest = -999
    for (var i = 0; i < temps.length; i++) {
      var value = parseFloat(temps[i].value)
      if (value > highest) highest = value
    }
    return highest
  }

  function badgeColor() {
    if (worstTemp >= 80) return Color.urgent
    if (worstTemp >= 65) return "#e8a33d"
    return root.primaryColor
  }

  // Quattro panel lifecycle forwarded from the nested Panel.qml.
  readonly property bool opened: panelLoader.item
    ? panelLoader.item.opened === true
    : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true
    : false

  function open() {
    root.refresh()
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (!panelLoader.item) return
    if (typeof panelLoader.item.closeForPopoutSwitch === "function")
      panelLoader.item.closeForPopoutSwitch()
    else
      panelLoader.item.close()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    target.bar = root.bar
    target.anchorItem = button
    target.hostWidget = root
  }

  visible: true
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰈐"
    slotSize: Style.bar.statusSlot
    fontSize: Style.bar.iconFont
    tooltipText: root.tooltipText
    activeColor: root.badgeColor()
    active: true
    onPressed: root.toggle()
  }
}
