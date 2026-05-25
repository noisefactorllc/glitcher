// SPDX-License-Identifier: MIT
/**
 * PresetRail — DOM view for the preset chips, effect readout, intensity
 * slider, and the GLITCHIFY pulse animation.
 *
 * View-only. Coalescing logic, compile lifecycle, and glitchify randomness
 * live in the app controller so they can share the renderer lock with
 * source-switch code.
 */

export class PresetRail {
    /**
     * @param {object} opts
     * @param {Array<{ name: string }>} opts.presets
     * @param {(idx: number) => void} opts.onChipClick
     * @param {(value: number) => void} opts.onIntensityInput
     */
    constructor({ presets, onChipClick, onIntensityInput }) {
        this._presets = presets
        this._onChipClick = onChipClick
        this._onIntensityInput = onIntensityInput
    }

    /** Build chips into the rail and wire the intensity slider. */
    init(initialIntensity) {
        const rail = document.getElementById('preset-rail')
        rail.innerHTML = ''
        this._presets.forEach((preset, i) => {
            const btn = document.createElement('button')
            btn.className = 'preset-chip' + (i === 0 ? ' active' : '')
            btn.textContent = preset.name
            btn.dataset.index = i
            btn.setAttribute('role', 'tab')
            btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false')
            btn.addEventListener('click', () => this._onChipClick(i))
            rail.appendChild(btn)
        })

        const slider = document.getElementById('intensity')
        slider.value = String(initialIntensity)
        document.getElementById('intensity-value').textContent = String(initialIntensity)
        slider.addEventListener('input', (e) => this._onIntensityInput(Number(e.target.value)))
    }

    setActiveChip(idx) {
        const chips = document.querySelectorAll('.preset-chip')
        chips.forEach((el, i) => {
            const active = i === idx
            el.classList.toggle('active', active)
            el.setAttribute('aria-selected', active ? 'true' : 'false')
        })
        // Manually scroll only the rail container, never the page.
        const rail = document.getElementById('preset-rail')
        const active = rail.querySelector('.preset-chip.active')
        if (rail && active) {
            const railRect = rail.getBoundingClientRect()
            const chipRect = active.getBoundingClientRect()
            const offset = (chipRect.left + chipRect.right) / 2 - (railRect.left + railRect.right) / 2
            rail.scrollBy({ left: offset, behavior: 'smooth' })
        }
    }

    setReadout(name) {
        document.getElementById('effect-readout').textContent = `▸ ${name}`
    }

    setIntensity(value) {
        document.getElementById('intensity').value = String(value)
        document.getElementById('intensity-value').textContent = String(value)
    }

    /** Restart the GLITCHIFY button shake animation. */
    pulseGlitchifyButton() {
        const btn = document.getElementById('glitchify-btn')
        btn.classList.remove('pulse')
        void btn.offsetWidth // reflow so the animation restarts
        btn.classList.add('pulse')
    }

    /** Full-screen flash overlay for a successful glitch pulse. */
    static showGlitchPulse() {
        const overlay = document.createElement('div')
        overlay.className = 'glitch-pulse-overlay'
        document.body.appendChild(overlay)
        overlay.addEventListener('animationend', () => overlay.remove())
    }
}
