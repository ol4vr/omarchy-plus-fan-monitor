import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Quattro-native details surface. Its content preserves the accepted
// upstream Fan Monitor presentation while KeyboardPanel supplies focus,
// Escape handling, and bar popout coordination.
Panel {
  id: root
  moduleName: "io.github.ol4vr.fan-monitor"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  readonly property var fans: hostWidget ? hostWidget.fans : []
  readonly property var temps: hostWidget ? hostWidget.temps : []
  readonly property bool loaded: hostWidget ? hostWidget.loaded === true : false
  readonly property bool hasDeadFan: hostWidget ? hostWidget.hasDeadFan === true : false
  readonly property bool hasFanData: root.fans.length > 0
  readonly property color primaryColor: hostWidget ? hostWidget.primaryColor : Color.foreground
  readonly property real readingLabelWidth: 76

  function badgeColor() {
    return hostWidget ? hostWidget.badgeColor() : Color.foreground
  }

  function fanStopped(fan) {
    return Model.fanStopped(fan)
  }

  function fanText(fan) {
    return Model.fanReadingText(fan, true)
  }

  function tempColor(value) {
    var state = Model.temperatureState(value)
    if (state === "elevated") return "#e8a33d"
    if (state === "hot" || state === "critical" || state === "emergency")
      return Color.urgent
    return Color.popups.text
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  function open() {
    if (hostWidget) hostWidget.refresh()
    root.controller.show()
    Qt.callLater(function() {
      if (root.opened) root.setCenterHoverRevealSuppressed(true)
    })
  }

  function close() {
    root.setCenterHoverRevealSuppressed(false)
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(280))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Column {
        id: content
        width: parent.width
        spacing: Style.spacing.lg

        Row {
          width: parent.width
          spacing: Style.space(20)

          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: "󰈐"
            color: root.badgeColor()
            font.family: Style.font.family
            font.pixelSize: Style.font.heading
          }

          Column {
            anchors.verticalCenter: parent.verticalCenter
            spacing: 2

            Text {
              text: "Fan Monitor"
              color: Color.popups.text
              font.family: Style.font.family
              font.pixelSize: Style.font.subtitle
              font.bold: true
            }

            Text {
              text: !root.loaded ? "Loading…" : (!root.hasFanData ? "No fan data" : (root.hasDeadFan ? "FAN STOPPED" : "All fans OK"))
              color: root.hasDeadFan ? Color.urgent : (root.loaded && !root.hasFanData ? "#e8a33d" : root.primaryColor)
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
            }
          }
        }

        PanelSeparator {
          foreground: Color.popups.text
        }

        Column {
          width: parent.width
          spacing: Style.spacing.xs

          PanelSectionHeader {
            foreground: Color.popups.text
            text: "FAN SPEEDS"
          }

          Repeater {
            model: root.fans

            Row {
              required property var modelData
              width: parent.width
              spacing: Style.spacing.sm

              Text {
                text: modelData.name
                color: Qt.rgba(Color.popups.text.r, Color.popups.text.g, Color.popups.text.b, 0.6)
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                width: root.readingLabelWidth
                elide: Text.ElideRight
              }

              Text {
                text: root.fanText(modelData)
                color: root.fanStopped(modelData) ? Color.urgent : Color.popups.text
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                font.bold: root.fanStopped(modelData)
              }
            }
          }
        }

        PanelSeparator {
          foreground: Color.popups.text
        }

        Column {
          width: parent.width
          spacing: Style.spacing.xs

          PanelSectionHeader {
            foreground: Color.popups.text
            text: "TEMPERATURES"
          }

          Repeater {
            model: root.temps

            Row {
              required property var modelData
              width: parent.width
              spacing: Style.spacing.sm
              readonly property real tempVal: parseFloat(modelData.value)

              Text {
                text: modelData.name
                color: Qt.rgba(Color.popups.text.r, Color.popups.text.g, Color.popups.text.b, 0.6)
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                width: root.readingLabelWidth
              }

              Text {
                text: modelData.value + "°C"
                color: root.tempColor(parent.tempVal)
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
              }
            }
          }
        }
      }
    }
  }
}
