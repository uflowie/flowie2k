import { Buffer } from "node:buffer"
import { expect, test, type Page } from "@playwright/test"

// Valid silent PCM audio keeps these playback checks independent of the library.
const audio = Buffer.alloc(44 + 8000 * 2 * 30)
audio.write("RIFF", 0)
audio.writeUInt32LE(audio.length - 8, 4)
audio.write("WAVEfmt ", 8)
audio.writeUInt32LE(16, 16)
audio.writeUInt16LE(1, 20)
audio.writeUInt16LE(1, 22)
audio.writeUInt32LE(8000, 24)
audio.writeUInt32LE(16000, 28)
audio.writeUInt16LE(2, 32)
audio.writeUInt16LE(16, 34)
audio.write("data", 36)
audio.writeUInt32LE(audio.length - 44, 40)

const songs = [1, 2].map((id) => ({
  id, filename: `Cache ${id}.wav`, title: `Cache ${id}`, artist: "Cache test",
  album: null, genre: null, duration: 30, file_size: audio.length,
  mime_type: "audio/wav", storage_key: `tracks/cache-${id}.wav`,
  uploaded_at: "2026-09-29T00:00:00Z", thumbnail_path: null,
  seconds_listened: 0, last_played: null, window_seconds: 0,
}))

async function mockLibrary(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/stream")) {
      await route.fulfill({ status: 200, contentType: "audio/wav", body: audio })
    } else if (path === "/api/songs") {
      await route.fulfill({ json: { songs } })
    } else if (path === "/api/playlists") {
      await route.fulfill({ json: { playlists: [] } })
    } else {
      await route.fulfill({ json: {} })
    }
  })
  await page.goto("/playlists/all")
}

const select = (page: Page, id: number) =>
  page.locator("tbody tr", { hasText: `Cache ${id}` }).click()

const cachedSize = (page: Page, id: number) => page.evaluate(async (key) => {
  return await new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("flowie2k-audio", 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction("tracks", "readonly")
      const request = transaction.objectStore("tracks").get(key)
      transaction.oncomplete = () => {
        resolve(request.result instanceof Blob ? request.result.size : 0)
        db.close()
      }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  })
}, `tracks/cache-${id}.wav`)

const expectPlaying = async (page: Page) => {
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) =>
    !element.paused && element.currentTime > 0.1 && !element.error,
  )).toBe(true)
}

test("persists complete audio and plays/seeks from IndexedDB after reload without audio requests", async ({ page }) => {
  await mockLibrary(page)
  await select(page, 1)
  await expectPlaying(page)
  await expect.poll(() => cachedSize(page, 1)).toBe(audio.length)

  await select(page, 1)
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/)
  await expectPlaying(page)

  await page.reload()
  let requests = 0
  await page.route("**/api/songs/*/stream", async (route) => {
    requests++
    await route.abort()
  })
  await select(page, 1)
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/)
  await expectPlaying(page)
  await page.locator("audio").evaluate((element: HTMLAudioElement) => { element.currentTime = 15 })
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(15)
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => element.paused)).toBe(true)
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await expectPlaying(page)
  expect(requests).toBe(0)
})

test("unavailable IndexedDB still allows streaming", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => { throw new DOMException("Denied", "SecurityError") }
  })
  await mockLibrary(page)
  await select(page, 1)
  await expectPlaying(page)
  await expect(page.locator("audio")).toHaveAttribute("src", /\/api\/songs\/1\/stream$/)
})

test("quota failures do not interrupt streaming or switching tracks", async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException("Full", "QuotaExceededError") }
  })
  await mockLibrary(page)
  await select(page, 1)
  await expectPlaying(page)
  await select(page, 2)
  await expectPlaying(page)
  await expect(page.locator("audio")).toHaveAttribute("src", /\/api\/songs\/2\/stream$/)
  expect(await cachedSize(page, 1)).toBe(0)
  expect(await cachedSize(page, 2)).toBe(0)
})

test("skipping cancels an unfinished cache download without replacing the next song", async ({ page }) => {
  await mockLibrary(page)
  let downloading = false
  await page.route("**/api/songs/1/stream", async (route) => {
    if (route.request().resourceType() === "fetch") {
      downloading = true
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    await route.fulfill({ status: 200, contentType: "audio/wav", body: audio }).catch(() => {})
  })
  await select(page, 1)
  await expect.poll(() => downloading).toBe(true)
  await select(page, 2)
  await expectPlaying(page)
  await expect.poll(() => cachedSize(page, 2)).toBe(audio.length)
  await expect(page.locator("audio")).toHaveAttribute("src", /\/api\/songs\/2\/stream$/)
  expect(await cachedSize(page, 1)).toBe(0)
})

test("partial downloads are never treated as cached tracks", async ({ page }) => {
  await mockLibrary(page)
  let downloads = 0
  await page.route("**/api/songs/1/stream", async (route) => {
    if (route.request().resourceType() === "fetch") {
      downloads++
      await route.fulfill({ status: 206, contentType: "audio/wav", body: audio.subarray(0, 128) })
    } else {
      await route.fulfill({ status: 200, contentType: "audio/wav", body: audio })
    }
  })
  await select(page, 1)
  await expectPlaying(page)
  await expect.poll(() => downloads).toBe(1)
  expect(await cachedSize(page, 1)).toBe(0)
  await select(page, 1)
  await expectPlaying(page)
  await expect.poll(() => downloads).toBe(2)
  await expect(page.locator("audio")).toHaveAttribute("src", /\/api\/songs\/1\/stream$/)
})
