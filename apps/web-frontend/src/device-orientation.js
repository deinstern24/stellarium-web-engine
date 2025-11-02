/**
 * AR Feature for Stellarium Web Engine
 * Copyright (C) 2025 Ansgar Burmann - https://deinstern24.de
 *
 * Licensed under the GNU Affero General Public License v3 (AGPLv3)
 * or any later version. See the LICENSE file in the project root.
 *
 * Description:
 *   Adds augmented reality (AR) support for Stellarium Web Engine.
 */

class DeviceOrientationController {
  constructor (stellarium) {
    this.stellarium = stellarium
    this.enabled = false
    this.alpha = 0
    this.beta = 0
    this.gamma = 0
    this.compassHeading = 0
    this.smoothAzimuth = null
    this.smoothAltitude = null

    // AR Navigation
    this.targetObject = null
    this.targetAz = null
    this.targetAlt = null
    this.overlay = null
    this.arrow = null
    this.lastTargetUpdate = 0

    this.onOrientationChange = this.onOrientationChange.bind(this)
    this.onCompassHeading = this.onCompassHeading.bind(this)
  }

  async requestPermission () {
    // Für iOS 13+ wird Permission benötigt
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission()
        return permission === 'granted'
      } catch (error) {
        console.error('Permission denied:', error)
        return false
      }
    }
    return true
  }

  async enable () {
    // iOS: Zeige erst Hinweis, dann aktiviere
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      const userConfirmed = await this.showIOSCalibrationHint()
      if (!userConfirmed) {
        throw new Error('User cancelled iOS calibration')
      }
    }

    const hasPermission = await this.requestPermission()
    if (!hasPermission) {
      throw new Error('Device orientation permission denied')
    }

    if (window.DeviceOrientationEvent) {
      // Prüfen, ob Sensor echte Werte liefert
      const sensorSupported = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 1000) // 1s Timeout
        const listener = (e) => {
          window.removeEventListener('deviceorientation', listener)
          clearTimeout(timeout)
          resolve(e.alpha !== null && e.beta !== null && e.gamma !== null)
        }
        window.addEventListener('deviceorientation', listener)
      })

      if (!sensorSupported) {
        throw new Error('Device orientation not supported on this device')
      }

      // EventListener registrieren
      window.addEventListener('deviceorientation', this.onOrientationChange)

      // Für absoluten Kompass-Heading (wenn verfügbar)
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', this.onCompassHeading)
      }

      this.enabled = true
      this.smoothAzimuth = null
      this.smoothAltitude = null

      // initialize AR navigation
      this.initARNavigation()

      console.log('Device orientation enabled')
    } else {
      throw new Error('Device orientation not supported')
    }
  }

  disable () {
    window.removeEventListener('deviceorientation', this.onOrientationChange)
    window.removeEventListener('deviceorientationabsolute', this.onCompassHeading)
    this.enabled = false

    // hide AR navigation overlay
    if (this.overlay) {
      this.overlay.style.display = 'none'
    }

    console.log('Device orientation disabled')
  }

  onCompassHeading (event) {
    if (event.absolute && event.alpha !== null) {
      this.compassHeading = event.alpha
    }
  }

  onOrientationChange (event) {
    if (!this.enabled) return
    /*
    // --- Debug-Ausgabe auf dem Bildschirm ---
    let debug = document.getElementById('debug')
    if (!debug) {
      debug = document.createElement('div')
      debug.id = 'debug'
      debug.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.7);
        color: #0f0;
        font-family: monospace;
        font-size: 12px;
        padding: 8px;
        border-radius: 6px;
        z-index: 9999;
        white-space: pre;
      `
      document.body.appendChild(debug)
    } */
    this.alpha = event.alpha || 0
    this.beta = event.beta || 0
    this.gamma = event.gamma || 0

    // iOS: webkitCompassHeading ist zuverlässiger
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    let heading = this.alpha

    if (isIOS) {
      if (event.webkitCompassHeading !== undefined) {
        heading = (event.webkitCompassHeading + 180) % 360
      } else {
        heading = -this.alpha
      }
    } else if (event.absolute) {
      heading = this.alpha
    } else {
      heading = this.compassHeading || this.alpha
    }

    /* debug.textContent =
      `alpha: ${event.alpha?.toFixed(1)}\n` +
      `beta: ${event.beta?.toFixed(1)}\n` +
      `gamma: ${event.gamma?.toFixed(1)}\n` +
      `webkitCompassHeading: ${event.webkitCompassHeading?.toFixed(1)}\n` +
      `absolute: ${event.absolute}\n` +
      `used heading: ${heading?.toFixed(1)}` */

    // NEU: iPhone spezifisch - Gamma invertieren
    const isIPhone = /iPhone/.test(navigator.userAgent)
    const alpha = isIPhone ? -heading : heading
    this.updateStellariumView(alpha, this.beta, this.gamma)

    // Update AR navigation
    this.updateARNavigation()
  }

  updateStellariumView (alpha, beta, gamma) {
    // convert to radiant for calculations
    const alphaRad = alpha * Math.PI / 180
    const betaRad = beta * Math.PI / 180
    const gammaRad = gamma * Math.PI / 180

    // Device Orientation uses ZXY Euler-Arc
    // alpha (Z) = compass, beta (X) = tilt front/back, gamma (Y) = tilt left/right
    // We calculate the viewing direction of the devices camers

    const ca = Math.cos(alphaRad)
    const sa = Math.sin(alphaRad)
    const cb = Math.cos(betaRad)
    const sb = Math.sin(betaRad)
    const cg = Math.cos(gammaRad)
    const sg = Math.sin(gammaRad)

    // camera initially points back/up in relation to the device
    // using rotationmatrix for ZXY order on (0, -1, 0) vector
    const x = ca * sg + sa * sb * cg
    const y = -ca * cg * sb + sa * sg
    const z = cb * cg

    // Convert Cartesian coordinates to horizontal coordinates (Az/Alt)
    // Azimuth: Angle from north (0°) clockwise
    let calcAzimuth = Math.atan2(x, y) * 180 / Math.PI
    if (calcAzimuth < 0) calcAzimuth += 360

    // Correction: 180° offset for correct cardinal directions
    calcAzimuth = (calcAzimuth + 180) % 360

    // Altitude: Angle above horizon (negative for correct control)
    const horizDistance = Math.sqrt(x * x + y * y)
    const calcAltitude = -Math.atan2(z, horizDistance) * 180 / Math.PI

    // Smoothing for smoother motion - adaptive based on beta angle
    let smoothFactor = 0.2

    // Initialization on first run
    if (this.smoothAzimuth === null) {
      this.smoothAzimuth = calcAzimuth
      this.smoothAltitude = calcAltitude
    } else {
      // Calculate rate of change
      let azDiff = calcAzimuth - this.smoothAzimuth
      if (azDiff > 180) azDiff -= 360
      if (azDiff < -180) azDiff += 360
      const altDiff = calcAltitude - this.smoothAltitude

      // At beta close to 90° (horizon): MUCH stronger smoothing for azimuth
      const betaAbs = Math.abs(beta)
      if (betaAbs > 85 && betaAbs < 95) {
        // Critical area around the horizon: Very strong azimuth smoothing
        smoothFactor = 0.05
      } else if (betaAbs > 80 && betaAbs < 100) {
        // Close to the critical range
        smoothFactor = 0.1
      } else {
        // Normal: Adaptive based on movement speed
        const maxChangeRate = Math.max(Math.abs(azDiff), Math.abs(altDiff))
        if (maxChangeRate > 10) {
          smoothFactor = 0.4
        } else if (maxChangeRate > 5) {
          smoothFactor = 0.3
        } else {
          smoothFactor = 0.2
        }
      }

      // Azimuth Smoothing mit Angle Wrapping
      this.smoothAzimuth = (this.smoothAzimuth + azDiff * smoothFactor) % 360
      if (this.smoothAzimuth < 0) this.smoothAzimuth += 360

      // Altitude Smoothing
      this.smoothAltitude += altDiff * smoothFactor
    }

    // Convert to Radiant
    const azRad = this.smoothAzimuth * Math.PI / 180
    const altRad = this.smoothAltitude * Math.PI / 180

    try {
      // Method 1: Via core.observer (test different property names)
      if (this.stellarium.core && this.stellarium.core.observer) {
        const obs = this.stellarium.core.observer

        if ('azimuth' in obs) obs.azimuth = azRad
        if ('altitude' in obs) obs.altitude = altRad
        if ('yaw' in obs) obs.yaw = azRad
        if ('pitch' in obs) obs.pitch = altRad
      }

      // Method 2: Using Stellarium itself
      if (typeof this.stellarium.setViewAltAz === 'function') {
        this.stellarium.setViewAltAz(altRad, azRad)
      }

      // Method 3: pointAndLock
      if (typeof this.stellarium.pointAndLock === 'function') {
        this.stellarium.pointAndLock([azRad, altRad])
      }

      // Method 4: setViewDirection
      if (typeof this.stellarium.setViewDirection === 'function') {
        this.stellarium.setViewDirection([azRad, altRad])
      }

      // Method 5: look_at
      if (typeof this.stellarium.look_at === 'function') {
        this.stellarium.look_at([azRad, altRad], 0)
      }
    } catch (error) {
      console.error('Error updating view:', error)
    }
  }

  // ===== AR NAVIGATION =====

  initARNavigation () {
    if (this.overlay) {
      this.overlay.style.display = 'block'
      this.updateTarget()
      return
    }

    // creating Overlay
    this.overlay = document.createElement('div')
    this.overlay.id = 'ar-navigation-overlay'
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `

    // compass element
    this.arrow = document.createElement('div')
    this.arrow.id = 'ar-arrow'
    this.arrow.innerHTML = `
      <svg width="100" height="100" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 8px rgba(0,255,136,0.6));">
        <!-- Kreis -->
        <circle cx="50" cy="50" r="45" fill="none" stroke="#00ff88" stroke-width="3" stroke-dasharray="250 30" stroke-dashoffset="53"/>

        <!-- Dreieck das sich dreht (zeigt nach oben) -->
        <polygon points="50,1 45,11 55,11" fill="#00ff88" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
    `
    this.arrow.style.cssText = `
      position: absolute;
      width: 100px;
      height: 100px;
      transform-origin: center center;
      transition: opacity 0.3s;
      opacity: 0;
    `

    this.overlay.appendChild(this.arrow)

    // Add overlay to page
    const canvas = document.querySelector('#stel-canvas') ||
                   document.querySelector('canvas') ||
                   document.body

    if (canvas.tagName === 'CANVAS' && canvas.parentElement) {
      canvas.parentElement.style.position = 'relative'
      canvas.parentElement.appendChild(this.overlay)
    } else {
      canvas.appendChild(this.overlay)
    }

    // Find selected object
    this.updateTarget()
  }

  updateTarget () {
    try {
      let selected = null

      // Try different methods
      if (this.stellarium.core && this.stellarium.core.selection) {
        selected = this.stellarium.core.selection

        if (selected) {
          const selType = typeof selected

          // If it is an array, take the first element
          if (Array.isArray(selected) && selected.length > 0) {
            selected = selected[0]
          }

          // If it's just a string/number, it's probably an ID.
          if (selType === 'string' || selType === 'number') {
            if (typeof this.stellarium.getObj === 'function') {
              selected = this.stellarium.getObj(selected)
            }
          }
        }
      }

      if (!selected && typeof this.stellarium.getSelectedObject === 'function') {
        selected = this.stellarium.getSelectedObject()
      }

      if (!selected && this.stellarium.selected) {
        selected = this.stellarium.selected
      }

      if (selected && selected !== this.targetObject) {
        this.targetObject = selected
        this.updateTargetPosition()
      } else if (!selected && this.targetObject) {
        // No more selection - delete target
        this.targetObject = null
        this.targetAz = null
        this.targetAlt = null
      }
    } catch (error) {
      console.error('Error updating target:', error)
    }
  }

  updateTargetPosition () {
    if (!this.targetObject) return

    try {
      let azAlt = null

      // MAIN METHOD: As in selected-object.vue
      if (this.stellarium.core && this.stellarium.core.observer) {
        try {
          // Get ICRF position (RA/Dec)
          const radec = this.targetObject.getInfo('radec')
          if (radec && radec.length >= 2) {
            // Convert ICRF -> OBSERVED (Az/Alt)
            const obsPos = this.stellarium.convertFrame(
              this.stellarium.core.observer,
              'ICRF',
              'OBSERVED',
              radec
            )

            // Convert Cartesian to spherical
            const azalt = this.stellarium.c2s(obsPos)
            if (azalt && azalt.length >= 2) {
              // Normalize angles
              const az = this.stellarium.anp(azalt[0]) // anp = normalize to 0-2π
              const alt = this.stellarium.anpm(azalt[1]) // anpm = normalize to -π to π

              azAlt = [az, alt]
            }
          }
        } catch (e) {
          console.error('Error converting coordinates:', e)
        }
      }

      // Fallback: Direct az/alt properties
      if (!azAlt && 'azimuth' in this.targetObject && 'altitude' in this.targetObject) {
        azAlt = [this.targetObject.azimuth, this.targetObject.altitude]
      }

      if (azAlt && azAlt.length >= 2) {
        this.targetAz = azAlt[0] * 180 / Math.PI
        this.targetAlt = azAlt[1] * 180 / Math.PI

        if (this.targetAz < 0) this.targetAz += 360
      }
    } catch (error) {
      console.error('Error getting target position:', error)
    }
  }

  updateARNavigation () {
    if (!this.overlay || !this.arrow) return

    // Update target continuously (not just every 500 ms)
    const now = Date.now()
    if (!this.lastTargetUpdate || now - this.lastTargetUpdate > 200) {
      this.updateTarget()
      this.lastTargetUpdate = now
    }

    if (!this.targetAz || !this.targetAlt) {
      this.arrow.style.opacity = '0'
      return
    }

    // Calculate difference to current viewing direction
    const currentAz = this.smoothAzimuth || 0
    const currentAlt = this.smoothAltitude || 0

    let azDiff = this.targetAz - currentAz
    if (azDiff > 180) azDiff -= 360
    if (azDiff < -180) azDiff += 360

    const altDiff = this.targetAlt - currentAlt
    const totalDistance = Math.sqrt(azDiff * azDiff + altDiff * altDiff)

    // Hide compass when star is in field of view (15° threshold)
    if (totalDistance < 15) {
      this.arrow.style.opacity = '0'
      return
    }

    // show compass
    this.arrow.style.opacity = '1'

    // Calculate angle for compass rotation
    const angleToTarget = Math.atan2(azDiff, altDiff) * 180 / Math.PI

    // Center the compass in the middle of the screen
    const x = window.innerWidth / 2
    const y = window.innerHeight / 2

    this.arrow.style.left = `${x - 50}px`
    this.arrow.style.top = `${y - 50}px`
    this.arrow.style.transform = `rotate(${angleToTarget}deg)`
  }

  // Public API for manually setting a target
  setTarget (stellariumObject) {
    this.targetObject = stellariumObject
    this.updateTargetPosition()
  }

  // iOS Calibration Hint (returns Promise)
  showIOSCalibrationHint () {
    return new Promise((resolve) => {
      const hint = document.createElement('div')
      hint.id = 'ios-calibration-hint'
      hint.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
      `

      const dialog = document.createElement('div')
      dialog.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 30px;
        max-width: 85%;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      `

      dialog.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 20px;">🧭</div>
        <div style="font-size: 22px; font-weight: bold; margin-bottom: 15px; color: #333;">
          Hinweis für iOS
        </div>
        <div style="font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 25px;">
          iOS Browser unterstützen keine automatische<br>
          Kompass-Ausrichtung.<br><br>
          Bitte richte dein Gerät <strong style="color: #007AFF;">nach Norden</strong> aus,<br>
          bevor du fortfährst.
        </div>
        <button id="ios-hint-ok" style="
          background: #007AFF;
          color: white;
          border: none;
          padding: 14px 40px;
          border-radius: 10px;
          font-size: 17px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,122,255,0.3);
        ">OK, verstanden</button>
      `

      hint.appendChild(dialog)
      document.body.appendChild(hint)

      document.getElementById('ios-hint-ok').addEventListener('click', () => {
        hint.remove()
        resolve(true)
      })

      // Auch bei Klick außerhalb schließen
      hint.addEventListener('click', (e) => {
        if (e.target === hint) {
          hint.remove()
          resolve(true)
        }
      })
    })
  }

  // ===== STATUS =====

  isSupported () {
    return 'DeviceOrientationEvent' in window
  }

  getStatus () {
    return {
      supported: this.isSupported(),
      enabled: this.enabled,
      orientation: {
        alpha: this.alpha,
        beta: this.beta,
        gamma: this.gamma
      },
      target: this.targetObject ? {
        hasTarget: true,
        azimuth: this.targetAz,
        altitude: this.targetAlt
      } : null
    }
  }
}

// Export for integration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeviceOrientationController
}
