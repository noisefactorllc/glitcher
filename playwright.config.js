// SPDX-License-Identifier: MIT
import fs from 'node:fs'
import { defineConfig } from '@playwright/test'

// Sandboxes where $HOME sits on a noexec tmpfs can't execute browsers from
// the default ~/.cache/ms-playwright root. If a browsers root was prepared
// inside the checkout (gitignored, e.g. after
// `PLAYWRIGHT_BROWSERS_PATH=$PWD/node_modules/.pw-browsers npx playwright
// install chromium`), prefer it. An explicit PLAYWRIGHT_BROWSERS_PATH and
// normal CI/dev setups are untouched.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const localBrowsers = new URL('./node_modules/.pw-browsers/', import.meta.url).pathname
    if (fs.existsSync(localBrowsers)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers
    }
}

const PORT = Number(process.env.GLITCHER_PORT) || 3007

export default defineConfig({
    testDir: './tests',
    timeout: 30000,
    use: {
        baseURL: `http://localhost:${PORT}`,
        permissions: ['camera'],
        launchOptions: {
            args: [
                '--use-fake-device-for-media-stream',
                '--use-fake-ui-for-media-stream',
            ],
        },
    },
    webServer: {
        command: `npx http-server public -p ${PORT} -c-1`,
        port: PORT,
        reuseExistingServer: true,
    },
})
