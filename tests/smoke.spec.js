// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'

const MIN_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
)

test.describe('Glitcher smoke', () => {
    test('boots, loads default stack, switches starter, captures a photo', async ({ page }) => {
        await page.goto('/')

        await expect(page.locator('#stage-canvas')).toBeVisible()

        // Default starter (Datamosh) populates the stack on boot
        await expect(page.locator('.starter-chip')).toHaveCount(10)
        await expect(page.locator('.stack-slot')).not.toHaveCount(0)
        await page.waitForTimeout(2500)

        // Tap a starter chip → stack rebuilds
        await page.locator('.starter-chip', { hasText: 'CRT' }).click()
        await page.waitForTimeout(1500)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'CRT' })).toBeVisible()

        // Photo capture downloads a file
        const downloadPromise = page.waitForEvent('download', { timeout: 8000 })
        await page.click('#shutter-btn')
        const dl = await downloadPromise
        expect(dl.suggestedFilename()).toMatch(/glitcher-\d+\.png/)

        // Filmstrip thumbnail appears
        await expect(page.locator('.filmstrip-thumb').first()).toBeVisible()
    })

    test('per-slot intensity slider updates the live readout', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const firstSlider = page.locator('.stack-slot .slot-intensity-slider').first()
        const firstValue = page.locator('.stack-slot .slot-intensity-value').first()

        await firstSlider.fill('90')
        await expect(firstValue).toHaveText('90')

        await firstSlider.fill('15')
        await expect(firstValue).toHaveText('15')
    })

    test('add-effect picker appends a slot to the stack', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const initialCount = await page.locator('.stack-slot').count()
        await page.click('#add-effect-btn')
        await expect(page.locator('#effect-picker.open')).toBeVisible()

        await page.locator('.effect-picker-item', { hasText: 'Pixel Sort' }).click()
        await page.waitForTimeout(2000)

        await expect(page.locator('#effect-picker.open')).toHaveCount(0)
        await expect(page.locator('.stack-slot')).toHaveCount(initialCount + 1)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Pixel Sort' })).toBeVisible()
    })

    test('dice button on a slot triggers the roll animation', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const firstDice = page.locator('.stack-slot .slot-dice').first()
        await firstDice.click()
        await expect(firstDice).toHaveClass(/rolling/)
    })

    test('slot remove button shrinks the stack', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const initialCount = await page.locator('.stack-slot').count()
        await page.locator('.stack-slot .slot-remove').first().click()
        await page.waitForTimeout(1500)
        await expect(page.locator('.stack-slot')).toHaveCount(initialCount - 1)
    })

    test('GLITCHIFY rebuilds the stack', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const before = await page.locator('.stack-slot .slot-name').allTextContents()
        await page.click('#glitchify-btn')
        await page.waitForTimeout(2500)
        const after = await page.locator('.stack-slot .slot-name').allTextContents()

        // Composition or count should change; running it once shouldn't
        // produce the exact same list (catalog has 16 effects, GLITCHIFY
        // picks 2-4 random).
        expect(after.join('|')).not.toEqual(before.join('|'))
    })

    test('keyboard: G glitchifies, R re-rolls', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        const before = await page.locator('.stack-slot .slot-name').allTextContents()
        await page.locator('body').focus()
        await page.keyboard.press('g')
        await page.waitForTimeout(2500)
        const after = await page.locator('.stack-slot .slot-name').allTextContents()
        expect(after.join('|')).not.toEqual(before.join('|'))

        // R should fire the rolling animation on at least one slot
        await page.keyboard.press('r')
        await expect(page.locator('.stack-slot .slot-dice.rolling').first()).toBeVisible()
    })

    test('no horizontal page scroll after starter cycle', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        await page.locator('.starter-chip').last().click()
        await page.waitForTimeout(1500)

        const scrollX = await page.evaluate(() => window.scrollX)
        const docWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        const viewWidth = await page.evaluate(() => window.innerWidth)
        expect(scrollX).toBe(0)
        expect(docWidth).toBe(viewWidth)
    })

    test('image upload swaps source and keeps the stack rendering', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        await page.locator('.starter-chip', { hasText: 'Datamosh' }).click()
        await page.waitForTimeout(1500)

        await page.setInputFiles('#file-input', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: MIN_PNG
        })
        await page.waitForTimeout(2000)

        await expect(page.locator('#upload-btn')).toHaveClass(/active/)
        await expect(page.locator('#camera-btn')).not.toHaveClass(/active/)
        // Stack is preserved across the source swap
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Corrupt' })).toBeVisible()

        // Switching starter after upload still works
        await page.locator('.starter-chip', { hasText: 'CRT' }).click()
        await page.waitForTimeout(1500)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'CRT' })).toBeVisible()

        // And we can still capture a photo
        const downloadPromise = page.waitForEvent('download', { timeout: 8000 })
        await page.click('#shutter-btn')
        const dl = await downloadPromise
        expect(dl.suggestedFilename()).toMatch(/glitcher-\d+\.png/)
    })

    test('camera flag toggles back on after viewing an uploaded image', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        await page.setInputFiles('#file-input', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: MIN_PNG
        })
        await page.waitForTimeout(1500)

        await page.click('#camera-btn')
        await page.waitForTimeout(2000)

        await expect(page.locator('#camera-btn')).toHaveClass(/active/)
        await expect(page.locator('#upload-btn')).not.toHaveClass(/active/)
    })

    test('rapid structural changes coalesce into final stack state', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        // Click three starters in rapid succession before any compile can finish
        await page.locator('.starter-chip', { hasText: 'Datamosh' }).click()
        await page.waitForTimeout(40)
        await page.locator('.starter-chip', { hasText: 'CRT' }).click()
        await page.waitForTimeout(40)
        await page.locator('.starter-chip', { hasText: 'Static' }).click()

        await page.waitForTimeout(4000)

        // Final stack should match the LAST starter (Static)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Degauss' })).toBeVisible()
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Snow' })).toBeVisible()
        // No leftover slots from earlier starters
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Corrupt' })).toHaveCount(0)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'CRT' })).toHaveCount(0)
    })
})
