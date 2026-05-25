// SPDX-License-Identifier: MIT
import { defineConfig } from '@playwright/test'

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
