import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

async function ready(page, reload = false) {
    await Promise.all([
        page.waitForEvent('console', {
            predicate: message => message.text().includes('[Glitcher] Ready'),
            timeout: 30_000,
        }),
        reload ? page.reload() : page.goto('/'),
    ])
}

async function storedCount(page) {
    return page.evaluate(async () => {
        const { loadAllCaptures } = await import('/js/db.js')
        return (await loadAllCaptures()).length
    })
}

test('video capture stops, downloads a decodable WebM and stores the clip', async ({ page }) => {
    await ready(page)
    await page.locator('.mode-btn[data-mode="video"]').click()
    await page.locator('#shutter-btn').click()
    await expect(page.locator('#recording-status')).toBeVisible()
    await expect(page.locator('#recording-timer')).not.toHaveText('0:00')

    const pending = page.waitForEvent('download')
    await page.locator('#shutter-btn').click()
    const download = await pending
    expect(download.suggestedFilename()).toBe('glitchin-out-1.webm')
    const bytes = await readFile(await download.path())
    expect(bytes.length).toBeGreaterThan(4)
    expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3])
    await expect(page.locator('#recording-status')).toBeHidden()
    await expect(page.locator('#recording-timer')).toHaveText('0:00')
    await expect(page.locator('#shutter-btn')).not.toHaveClass(/recording/)
    await expect(page.locator('.filmstrip-thumb-btn')).toHaveAttribute('title', 'Download video 1')
    await expect.poll(() => storedCount(page)).toBe(1)

    const decoded = await page.evaluate(async () => {
        const { loadAllCaptures } = await import('/js/db.js')
        const [capture] = await loadAllCaptures()
        const url = URL.createObjectURL(capture.blob)
        const video = document.createElement('video')
        video.muted = true
        try {
            await new Promise((resolve, reject) => {
                video.onloadeddata = resolve
                video.onerror = () => reject(new Error('saved clip cannot be decoded'))
                video.src = url
                video.load()
            })
            return { type: capture.blob.type, size: capture.blob.size, width: video.videoWidth, height: video.videoHeight }
        } finally {
            video.pause()
            video.removeAttribute('src')
            video.load()
            URL.revokeObjectURL(url)
        }
    })
    expect(decoded.type).toMatch(/^video\/webm/)
    expect(decoded.size).toBe(bytes.length)
    expect(decoded.width).toBeGreaterThan(0)
    expect(decoded.height).toBeGreaterThan(0)
})

test('a photo survives reload byte-for-byte and deletion survives another reload', async ({ page }) => {
    await ready(page)
    const pending = page.waitForEvent('download')
    await page.locator('#shutter-btn').click()
    const firstDownload = await pending
    expect(firstDownload.suggestedFilename()).toBe('glitchin-out-1.png')
    const original = await readFile(await firstDownload.path())
    expect([...original.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await expect.poll(() => storedCount(page)).toBe(1)

    await ready(page, true)
    await expect(page.locator('.filmstrip-item')).toHaveCount(1)
    const restoredDownload = page.waitForEvent('download')
    await page.locator('.filmstrip-thumb-btn').click()
    const restored = await restoredDownload
    expect(restored.suggestedFilename()).toBe(firstDownload.suggestedFilename())
    expect(await readFile(await restored.path())).toEqual(original)

    await page.locator('.filmstrip-delete').click()
    await expect(page.locator('.filmstrip-item')).toHaveCount(0)
    await expect.poll(() => storedCount(page)).toBe(0)
    await ready(page, true)
    await expect(page.locator('.filmstrip-item')).toHaveCount(0)
    expect(await storedCount(page)).toBe(0)
})
