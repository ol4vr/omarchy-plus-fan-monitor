import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

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
    var parsed = Model.parseSensorsJson(raw)
    if (!parsed) return
    fans = parsed.fans
    temps = parsed.temps
    loaded = true
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
    var state = Model.temperatureState(worstTemp)
    if (state === "elevated") return "#e8a33d"
    if (state === "hot" || state === "critical" || state === "emergency")
      return Color.urgent
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
