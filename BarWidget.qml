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

  property var sensorData: ({ fans: [], temps: [] })
  property var gpuData: null
  property var fans: []
  property var temps: []
  property bool loaded: false

  readonly property bool hasDeadFan: {
    var f = fans
    for (var i = 0; i < f.length; i++) {
      if (Model.fanStopped(f[i])) return true
    }
    return false
  }

  function rebuildTelemetry() {
    var merged = Model.mergeGpuTelemetry(sensorData, gpuData)
    fans = merged.fans
    temps = merged.temps
  }

  function refresh() {
    if (!sensorsProc.running) sensorsProc.running = true
    if (!nvidiaProc.running) nvidiaProc.running = true
  }

  function parseSensors(raw) {
    var parsed = Model.parseSensorsJson(raw)
    if (!parsed) return
    sensorData = parsed
    loaded = true
    rebuildTelemetry()
  }

  function parseNvidia(raw) {
    gpuData = Model.parseNvidiaCsv(raw)
    rebuildTelemetry()
  }

  Process {
    id: sensorsProc
    command: ["sensors", "-j"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.parseSensors(text)
    }
  }

  Process {
    id: nvidiaProc
    command: [
      "nvidia-smi",
      "--query-gpu=temperature.gpu,fan.speed",
      "--format=csv,noheader,nounits"
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.parseNvidia(text)
    }
  }

  Timer {
    interval: 3000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  readonly property string tooltipText: Model.fanTooltipText(fans)

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
