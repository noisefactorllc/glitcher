// SPDX-License-Identifier: MIT
/**
 * About dialog wiring (Handfish AboutDialog component).
 */

import { AboutDialog } from 'handfish'

const APP_VERSION = '0.1.0-SNAPSHOT'

const about = new AboutDialog({
    name: 'Glitcher',
    version: APP_VERSION,
    logo: '<img src="icon.svg" alt="Glitcher" draggable="false">',
    repo: 'noisefactorllc/glitcher',
    ecosystem: 'Glitcher is a free tool by <a href="https://noisefactor.io/" target="_blank" rel="noopener">Noise Factor</a>, powered by the <a href="https://noisemaker.app/" target="_blank" rel="noopener">Noisemaker</a> open source engine. See also <a href="https://photobox.noisefactor.io/" target="_blank" rel="noopener">Photobox</a> for un-glitched real-time camera effects.',
})

fetch('./deployment-meta.json', { cache: 'no-store' }).then(async (res) => {
    if (!res.ok) return
    const data = await res.json()
    const hash = data.git_hash?.trim().slice(0, 8) || 'LOCAL'
    const deployed = data.date ? new Date(data.date * 1000) : null
    about.setBuild({ hash, deployed })
}).catch(() => {})

about.setNoisemakerFromUrl('https://shaders.noisedeck.app/1/deployment-meta.json')

export { about as aboutDialog }
