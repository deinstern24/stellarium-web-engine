// Stellarium Web - Copyright (c) 2022 - Stellarium Labs SRL
//
// This program is licensed under the terms of the GNU AGPL v3, or
// alternatively under a commercial licence.
//
// The terms of the AGPL v3 license can be found in the main directory of this
// repository.

<template>

<div class="click-through" style="position:absolute; width: 100%; height: 100%; display:flex; align-items: flex-end;">
  <toolbar v-if="$store.state.showMainToolBar" class="get-click" @toggle-ar="toggleARMode" :ar-mode-active="arModeActive"></toolbar>
  <observing-panel></observing-panel>
  <template v-for="(item, i) in pluginsGuiComponents">
    <component :is="item" :key="i"></component>
  </template>
  <template v-for="(item, i) in dialogs">
    <component :is="item" :key="i + pluginsGuiComponents.length"></component>
  </template>
  <selected-object-info v-if="isMobile" style="position: absolute; top: 48px; left: 0px; width: screenSize; max-width: calc(100vw - 12px); margin: 6px" class="get-click"></selected-object-info>
  <selected-object-info v-if="!isMobile" style="position: absolute; top: 48px; left: 0px; width: 380px; max-width: calc(100vw - 12px); margin: 6px" class="get-click"></selected-object-info>
  <progress-bars style="position: absolute; bottom: 54px; right: 12px;"></progress-bars>
  <bottom-bar style="position:absolute; width: 100%; justify-content: center; bottom: 0; display:flex; margin-bottom: 0px" class="get-click"></bottom-bar>
</div>

</template>

<script>
import DeviceOrientationController from '@/device-orientation'
import Toolbar from '@/components/toolbar.vue'
import BottomBar from '@/components/bottom-bar.vue'
import SelectedObjectInfo from '@/components/selected-object-info.vue'
import ProgressBars from '@/components/progress-bars'

import DataCreditsDialog from '@/components/data-credits-dialog.vue'
import About from '@/components/about.vue'
import ViewSettingsDialog from '@/components/view-settings-dialog.vue'
import PlanetsVisibility from '@/components/planets-visibility.vue'
import LocationDialog from '@/components/location-dialog.vue'
import ObservingPanel from '@/components/observing-panel.vue'

export default {
  data () {
    return {
      orientationController: null,
      arModeActive: false
    }
  },
  mounted () {
    this.orientationController = new DeviceOrientationController(this.$stel)
  },
  methods: {
    toggleARMode: async function () {
      console.log('toggleARMode aufgerufen')
      console.log('Vorher - arModeActive:', this.arModeActive)
      try {
        if (!this.orientationController.enabled) {
          await this.orientationController.enable()
          this.arModeActive = true
          console.log('AR aktiviert - arModeActive:', this.arModeActive)
        } else {
          this.orientationController.disable()
          this.arModeActive = false
          console.log('AR deaktiviert - arModeActive:', this.arModeActive)
        }
      } catch (error) {
        alert('AR Mode Fehler: ' + error.message)
      }
    }
  },
  computed: {
    pluginsGuiComponents: function () {
      let res = []
      for (const i in this.$stellariumWebPlugins()) {
        const plugin = this.$stellariumWebPlugins()[i]
        if (plugin.guiComponents) {
          res = res.concat(plugin.guiComponents)
        }
      }
      return res
    },
    screenSize: function () {
      return ((screen.width / 2) - 5) + 'px'
    },
    isMobile: function () {
      if (screen.width < 800) {
        return true
      } else {
        return false
      }
    },
    dialogs: function () {
      let res = [
        'data-credits-dialog',
        'about',
        'view-settings-dialog',
        'planets-visibility',
        'location-dialog'
      ]
      for (const i in this.$stellariumWebPlugins()) {
        const plugin = this.$stellariumWebPlugins()[i]
        if (plugin.dialogs) {
          res = res.concat(plugin.dialogs.map(d => d.name))
        }
      }
      return res
    }
  },
  components: { Toolbar, BottomBar, DataCreditsDialog, About, ViewSettingsDialog, PlanetsVisibility, SelectedObjectInfo, LocationDialog, ProgressBars, ObservingPanel }
}
</script>

<style>
</style>
