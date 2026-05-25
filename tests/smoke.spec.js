// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'

test.describe('Glitcher smoke', () => {
    test('boots, applies presets, captures a photo', async ({ page }) => {
        await page.goto('/')

        // Wait for renderer to be ready
        await expect(page.locator('#stage-canvas')).toBeVisible()
        await expect(page.locator('.preset-chip')).toHaveCount(15)
        await expect(page.locator('#effect-readout')).toContainText('Datamosh')
        await page.waitForTimeout(2500)

        // Switch preset via chip click
        await page.locator('.preset-chip', { hasText: 'CRT' }).click()
        await page.waitForTimeout(1500)
        await expect(page.locator('#effect-readout')).toContainText('CRT')

        // Intensity slider updates the live readout
        await page.locator('#intensity').fill('90')
        await expect(page.locator('#intensity-value')).toHaveText('90')

        // GLITCHIFY randomizes to another preset
        const readoutBefore = await page.locator('#effect-readout').textContent()
        await page.click('#glitchify-btn')
        await page.waitForTimeout(2500)
        const readoutAfter = await page.locator('#effect-readout').textContent()
        expect(readoutAfter).not.toEqual(readoutBefore)

        // Photo capture downloads a file
        const downloadPromise = page.waitForEvent('download', { timeout: 8000 })
        await page.click('#shutter-btn')
        const dl = await downloadPromise
        expect(dl.suggestedFilename()).toMatch(/glitcher-\d+\.png/)

        // Filmstrip thumbnail appears
        await expect(page.locator('.filmstrip-thumb').first()).toBeVisible()
    })

    test('keyboard shortcuts work', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const initialReadout = await page.locator('#effect-readout').textContent()

        // Right arrow cycles to next preset
        await page.locator('body').focus()
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(1500)
        const afterArrow = await page.locator('#effect-readout').textContent()
        expect(afterArrow).not.toEqual(initialReadout)

        // 'g' triggers glitchify
        await page.keyboard.press('g')
        await page.waitForTimeout(2500)
        const afterG = await page.locator('#effect-readout').textContent()
        expect(afterG).toBeTruthy()
    })

    test('no horizontal page scroll after preset cycle', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        // Click last preset to maximally scroll the rail
        await page.locator('.preset-chip').last().click()
        await page.waitForTimeout(1200)

        const scrollX = await page.evaluate(() => window.scrollX)
        const docWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        const viewWidth = await page.evaluate(() => window.innerWidth)
        expect(scrollX).toBe(0)
        expect(docWidth).toBe(viewWidth)
    })

    test('image upload swaps source and keeps effect rendering', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        // A minimal valid PNG (1×1 red pixel)
        const pngBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        )

        // Switch to a heavy-corruption preset so the effect output is visibly different from the source
        await page.locator('.preset-chip', { hasText: 'Datamosh' }).click()
        await page.waitForTimeout(1500)

        await page.setInputFiles('#file-input', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngBuffer
        })
        await page.waitForTimeout(2000)

        // Upload button should be in the active state
        await expect(page.locator('#upload-btn')).toHaveClass(/active/)
        await expect(page.locator('#camera-btn')).not.toHaveClass(/active/)
        // Effect readout should still show the preset (it was Datamosh)
        await expect(page.locator('#effect-readout')).toContainText('Datamosh')

        // Switching presets after upload still works (verifies _compileCurrent honors the image source)
        await page.locator('.preset-chip', { hasText: 'CRT' }).click()
        await page.waitForTimeout(1500)
        await expect(page.locator('#effect-readout')).toContainText('CRT')

        // And we can still capture a photo from the upload+effect chain
        const downloadPromise = page.waitForEvent('download', { timeout: 8000 })
        await page.click('#shutter-btn')
        const dl = await downloadPromise
        expect(dl.suggestedFilename()).toMatch(/glitcher-\d+\.png/)
    })

    test('camera flag toggles back on after viewing an uploaded image', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const pngBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        )
        await page.setInputFiles('#file-input', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngBuffer
        })
        await page.waitForTimeout(1500)

        await page.click('#camera-btn')
        await page.waitForTimeout(2000)

        await expect(page.locator('#camera-btn')).toHaveClass(/active/)
        await expect(page.locator('#upload-btn')).not.toHaveClass(/active/)
    })
})
