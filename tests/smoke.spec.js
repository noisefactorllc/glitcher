// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'

const MIN_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
)

/**
 * Click the shutter until a download actually lands.
 *
 * `CaptureController._capturePhoto()` returns immediately when the app's
 * `Lock` is held — i.e. while a compile is still in flight — without
 * capturing anything and without any observable signal. A click swallowed
 * that way fires no `download` event ever, so waiting longer can't help:
 * there is nothing pending to wait on. Re-clicking is the only way to close
 * the race from outside the app.
 */
async function shutterUntilDownload(page, { attempts = 6, perAttemptMs = 5000 } = {}) {
    for (let i = 0; i < attempts; i++) {
        const pending = page.waitForEvent('download', { timeout: perAttemptMs })
            .catch(() => null)
        await page.click('#shutter-btn')
        const dl = await pending
        if (dl) return dl
    }
    throw new Error(
        `Shutter produced no download in ${attempts} attempts ` +
        `(${perAttemptMs}ms each) — capture is being dropped, not just slow.`
    )
}

test.describe('Glitcher smoke', () => {
    // Each test starts with a clean stack. Guarded by a sessionStorage
    // flag so the clear only happens on the FIRST navigation of the test
    // — otherwise an in-test reload would wipe the data we want to verify
    // got persisted. sessionStorage is per-context, so each test starts
    // with the flag unset.
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            if (!sessionStorage.getItem('__glitcher_test_cleared__')) {
                try { localStorage.clear() } catch {}
                sessionStorage.setItem('__glitcher_test_cleared__', '1')
            }
        })
    })

    test('boots, loads default stack, switches starter, captures a photo', async ({ page }) => {
        // Boot + two compiles + the shutter retry budget doesn't fit the 30s
        // suite default.
        test.setTimeout(60_000)

        await page.goto('/')

        await expect(page.locator('#stage-canvas')).toBeVisible()

        // Default starter (Datamosh) populates the stack on boot.
        // `not.toHaveCount(0)` auto-retries until the rail/list render.
        await expect(page.locator('.starter-chip')).not.toHaveCount(0)
        await expect(page.locator('.stack-slot')).not.toHaveCount(0)
        await page.waitForTimeout(2500)

        // Tap a starter chip → stack rebuilds
        await page.locator('.starter-chip', { hasText: 'CRT' }).click()
        await page.waitForTimeout(1500)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'CRT' })).toBeVisible()

        // Photo capture downloads a file
        const dl = await shutterUntilDownload(page)
        expect(dl.suggestedFilename()).toMatch(/glitchin-out-\d+\.png/)

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

        // Composition or count should change; catalog has 20+ effects so
        // GLITCHIFY picking 2-4 random ones shouldn't reproduce the prior list.
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

    test('RE-ROLL ALL button rolls every slot', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        // Default Datamosh starter populates the stack on boot.
        await page.click('#reroll-all-btn')
        await expect(page.locator('.stack-slot .slot-dice.rolling').first()).toBeVisible()
    })

    test('datamosh randomize rolls only intensity + 2-3 flavor knobs', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(2000)

        const result = await page.evaluate(async () => {
            const { EFFECTS } = await import('/js/effects.js')
            const { EffectStack } = await import('/js/stack.js')
            const counts = []
            const restoredCounts = []
            for (let i = 0; i < 200; i++) {
                counts.push(Object.keys(EFFECTS.corrupt.randomize()).length)
            }
            // makeSlot called with a saved rolled (restore path) must NOT merge
            // in extra random keys from a fresh randomize.
            for (let i = 0; i < 50; i++) {
                const rolled = EFFECTS.corrupt.randomize()
                const slot = EffectStack.makeSlot('corrupt', 50, rolled)
                restoredCounts.push(Object.keys(slot.rolled).length)
            }
            return { counts, restoredCounts }
        })

        // intensity always rolled + 2-3 flavor knobs = 3 or 4 keys total
        expect(Math.min(...result.counts)).toBeGreaterThanOrEqual(3)
        expect(Math.max(...result.counts)).toBeLessThanOrEqual(4)
        // sanity: both 3 and 4 should appear across 200 rolls
        expect(result.counts).toContain(3)
        expect(result.counts).toContain(4)
        // Restore path preserves the sparse shape (no key inflation)
        expect(Math.max(...result.restoredCounts)).toBeLessThanOrEqual(4)
    })

    test('parallax: intensity 0 is a pass-through, direction emits as vec3()', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(2000)

        const result = await page.evaluate(async () => {
            const { EFFECTS, lerpParams, emitEffectCall } = await import('/js/effects.js')
            const p = EFFECTS.parallax
            const rolled = p.randomize()
            const at0 = lerpParams(p, rolled, 0)
            const at1 = lerpParams(p, rolled, 1)
            return {
                at0Direction: at0.direction,
                at0Pivot: at0.pivot,
                at1Direction: at1.direction,
                rolledDirection: rolled.direction,
                dsl0: emitEffectCall(p, at0),
                dsl1: emitEffectCall(p, at1)
            }
        })

        // Straight-down view + pivot 0 => zero shift => exact pass-through.
        expect(result.at0Direction).toEqual([0, 0, 1])
        expect(result.at0Pivot).toBe(0)
        expect(result.dsl0).toBe('parallax(direction: vec3(0.0, 0.0, 1.0), pivot: 0.0)')

        // At full intensity the rolled direction comes through, clamped to ±1.
        result.at1Direction.forEach((c, i) => {
            expect(c).toBeCloseTo(Math.max(-1, Math.min(1, result.rolledDirection[i])), 5)
        })
        // Emitted as a vec3() call, never a bare array literal.
        expect(result.dsl1).toMatch(/^parallax\(direction: vec3\(-?\d+\.\d+, -?\d+\.\d+, -?\d+\.\d+\), pivot: \d+\.\d+\)$/)
    })

    test('parallax compiles and actually displaces the image', async ({ page }) => {
        // App boot plus a second renderer that loads its own manifest and
        // fetches the parallax effect over the network for two compiles.
        test.setTimeout(60_000)

        await page.goto('/')
        await page.waitForTimeout(2500)

        const result = await page.evaluate(async () => {
            const { GlitcherRenderer } = await import('/js/noisemaker/index.js')
            const SIZE = 256

            // A hard black/white block gives the height map real relief, so a
            // tilted view ray has something to march into.
            const src = document.createElement('canvas')
            src.width = SIZE; src.height = SIZE
            const sctx = src.getContext('2d')
            sctx.fillStyle = '#000'; sctx.fillRect(0, 0, SIZE, SIZE)
            sctx.fillStyle = '#fff'; sctx.fillRect(64, 64, 128, 128)

            const canvas = document.createElement('canvas')
            canvas.width = SIZE; canvas.height = SIZE
            canvas.style.position = 'fixed'
            canvas.style.left = '-9999px'
            document.body.appendChild(canvas)

            const errors = []
            const r = new GlitcherRenderer(canvas, {
                width: SIZE, height: SIZE, onError: e => errors.push(String(e))
            })
            await r.init()
            r.setSource(src)

            const head = 'search synth, filter, classicNoisedeck'
            const grab = async (call) => {
                await r.compile(`${head}\n\nmedia().${call}.write(o0)\n\nrender(o0)`)
                await new Promise(res => setTimeout(res, 600))
                const out = document.createElement('canvas')
                out.width = SIZE; out.height = SIZE
                const octx = out.getContext('2d')
                octx.drawImage(canvas, 0, 0)
                return octx.getImageData(0, 0, SIZE, SIZE).data
            }

            const flat = await grab('parallax(direction: vec3(0.0, 0.0, 1.0), pivot: 0.0)')
            const tilted = await grab('parallax(direction: vec3(0.8, 0.3, 0.25), pivot: 0.0)')

            let changed = 0
            let lit = 0
            for (let i = 0; i < flat.length; i += 4) {
                if (flat[i] > 8) lit++
                if (Math.abs(flat[i] - tilted[i]) > 8) changed++
            }

            r.destroy()
            canvas.remove()
            return { changed, lit, pixels: flat.length / 4, errors }
        })

        expect(result.errors).toEqual([])
        // Straight-down parallax must render the source, not a black frame.
        expect(result.lit).toBeGreaterThan(result.pixels * 0.05)
        // Tilting the view ray must move a meaningful chunk of the frame.
        expect(result.changed).toBeGreaterThan(result.pixels * 0.01)
    })

    test('parallax is offered in the picker and lands in the stack', async ({ page }) => {
        const failures = []
        page.on('console', msg => {
            const t = msg.text()
            if (/Compile failed|Renderer error/.test(t)) failures.push(t)
        })

        await page.goto('/')
        await page.waitForTimeout(3000)

        await page.click('#add-effect-btn')
        await expect(page.locator('#effect-picker.open')).toBeVisible()
        await page.locator('.effect-picker-item', { hasText: 'Parallax' }).click()
        await page.waitForTimeout(2500)

        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Parallax' })).toBeVisible()
        expect(failures).toEqual([])
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
        // Source swap + two starter compiles + the shutter retry budget.
        test.setTimeout(60_000)

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
        const dl = await shutterUntilDownload(page)
        expect(dl.suggestedFilename()).toMatch(/glitchin-out-\d+\.png/)
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

        // Final stack should match the LAST starter (Static = snow + scanlineError + grain)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Snow' })).toBeVisible()
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Scanline Error' })).toBeVisible()
        // No leftover slots from earlier starters
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'Corrupt' })).toHaveCount(0)
        await expect(page.locator('.stack-slot .slot-name', { hasText: 'CRT' })).toHaveCount(0)
    })

    test('pointer drag reorders slots', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(3000)

        await page.locator('.starter-chip', { hasText: 'Dead Tape' }).click()
        await page.waitForTimeout(1500)

        const before = await page.locator('.stack-slot .slot-name').allTextContents()
        const handle = page.locator('.stack-slot').nth(0).locator('.slot-handle')
        const target = page.locator('.stack-slot').nth(2)
        const hb = await handle.boundingBox()
        const tb = await target.boundingBox()

        // Mouse drag: down on handle → small move (triggers drag start at 4px) → target → up
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
        await page.mouse.down()
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 8, { steps: 3 })
        await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height * 0.75, { steps: 8 })
        await page.waitForTimeout(120)
        await page.mouse.up()
        await page.waitForTimeout(1500)

        const after = await page.locator('.stack-slot .slot-name').allTextContents()
        expect(after).not.toEqual(before)
        // First slot moved to end
        expect(after[after.length - 1]).toEqual(before[0])
    })

    test('persistence: stack survives a page reload', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(2500)

        await page.locator('.starter-chip', { hasText: 'Slice' }).click()
        await page.waitForTimeout(1500)
        const before = await page.locator('.stack-slot .slot-name').allTextContents()

        await page.reload()
        await page.waitForTimeout(2500)
        const after = await page.locator('.stack-slot .slot-name').allTextContents()
        expect(after).toEqual(before)
    })

    test('share: copies link to clipboard, link restores same stack', async ({ browser }) => {
        // This one boots the app in three separate browser contexts (origin,
        // share-writer, share-reader). Each pays the full shader-bundle fetch
        // + WebGL compile, which doesn't fit the 30s suite default.
        test.setTimeout(90_000)

        const ctx = await browser.newContext({
            permissions: ['camera', 'clipboard-read', 'clipboard-write']
        })
        const page = await ctx.newPage()
        // Init script for this fresh context, with the same first-nav guard
        // so the share-URL visit doesn't get its data wiped.
        await ctx.addInitScript(() => {
            if (!sessionStorage.getItem('__glitcher_test_cleared__')) {
                try { localStorage.clear() } catch {}
                sessionStorage.setItem('__glitcher_test_cleared__', '1')
            }
        })
        await page.goto('/')
        await page.waitForTimeout(2500)

        await page.locator('.starter-chip', { hasText: 'Phantom' }).click()
        await page.waitForTimeout(1500)
        const before = await page.locator('.stack-slot .slot-name').allTextContents()

        await page.click('#share-btn')
        await expect(page.locator('.glitch-toast')).toContainText(/copied/i)
        const url = await page.evaluate(() => navigator.clipboard.readText())
        expect(url).toMatch(/#s=[A-Za-z0-9_-]+$/)

        // Visit the URL in a fresh page (different context = fresh localStorage)
        const freshCtx = await browser.newContext({
            permissions: ['camera', 'clipboard-read', 'clipboard-write']
        })
        const fresh = await freshCtx.newPage()
        await fresh.goto(url)
        await fresh.waitForTimeout(2500)
        const after = await fresh.locator('.stack-slot .slot-name').allTextContents()
        expect(after).toEqual(before)
        // Hash is cleared from the document URL after consumption
        const docUrl = await fresh.evaluate(() => window.location.href)
        expect(docUrl).not.toContain('#')

        await freshCtx.close()
        await ctx.close()
    })
})
