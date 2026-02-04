import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";

test.describe("playlist ui", () => {
  test.describe.configure({ mode: "serial" });

  const songFiles = [
    { name: "Alpha.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("alpha") },
    { name: "Echo.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("echo") },
    { name: "Zeta.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("zeta") },
  ];

  const toUrl = (baseURL: string, path: string) =>
    new URL(path, baseURL).toString();

  const disableAnimations = async (page: Page) => {
    await page.addStyleTag({
      content: `*,
*::before,
*::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}`,
    });
  };

  const uploadSongs = async (page: Page) => {
    for (const songFile of songFiles) {
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: "Upload Song" }).click(),
      ]);
      await chooser.setFiles(songFile);
      const songTitle = songFile.name.replace(/\.[^/.]+$/, "");
      await expect(
        page.locator("tbody tr", { hasText: songTitle }),
      ).toBeVisible({ timeout: 15000 });
    }

    await expect(page.getByText("3 songs")).toBeVisible({ timeout: 15000 });
  };

  const createPlaylist = async (page: Page, name: string) => {
    page.once("dialog", (dialog) => dialog.accept(name));
    await page.getByRole("button", { name: "Add New Playlist" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  };

  const seedViaUi = async (page: Page, baseURL: string) => {
    await page.goto(toUrl(baseURL, "/playlists/all"));
    await expect(page.getByRole("heading", { name: "All Songs" })).toBeVisible();

    await uploadSongs(page);

    await createPlaylist(page, "Chill Mix");
    await createPlaylist(page, "Road Trip");

    await page.goto(toUrl(baseURL, "/playlists/all"));
    await expect(page.getByRole("link", { name: "Chill Mix" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Road Trip" })).toBeVisible();
  };

  const getSongTitles = async (page: Page) => {
    const titles = await page
      .locator("tbody tr td:first-child")
      .allTextContents();
    return titles.map((title) => title.trim()).filter(Boolean);
  };

  test.beforeAll(async ({ browser }, testInfo) => {
    const baseURL =
      testInfo.project.use.baseURL ?? "http://127.0.0.1:4173";
    const page = await browser.newPage();
    await disableAnimations(page);
    await seedViaUi(page, baseURL);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
  });

  test("renders sidebar links and playback controls", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "All Songs" })).toBeVisible();
    await expect(page.getByText("3 songs")).toBeVisible();

    await expect(page.getByRole("button", { name: "Upload Song" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload Folder" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add New Playlist" })).toBeVisible();

    await expect(page.getByRole("link", { name: "All Songs" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Most Popular 30 days" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Most Popular 90 days" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Most Popular 365 days" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Chill Mix" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Road Trip" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Shuffle" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Previous song" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Next song" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Repeat song" })).toBeVisible();
    await expect(page.getByLabel("Playback speed")).toBeVisible();
    await expect(page.getByLabel("Volume")).toBeVisible();
    await expect(page.getByLabel("Seek")).toBeVisible();
  });

  test("filters and sorts songs", async ({ page }) => {
    await page.goto("/playlists/all");

    await expect(page.getByRole("heading", { name: "All Songs" })).toBeVisible();
    await expect(page.getByText("3 songs")).toBeVisible();

    const titleSortButton = page.getByRole("button", { name: "Title" });

    await titleSortButton.click();
    await expect.poll(() => getSongTitles(page)).toEqual(["Alpha", "Echo", "Zeta"]);

    await titleSortButton.click();
    await expect.poll(() => getSongTitles(page)).toEqual(["Zeta", "Echo", "Alpha"]);

    const searchInput = page.getByLabel("Search playlist");
    await searchInput.fill("Alpha");

    await expect(page.getByText("1 of 3 songs")).toBeVisible();
    await expect.poll(() => getSongTitles(page)).toEqual(["Alpha"]);

    await searchInput.fill("NoMatch");
    await expect(page.getByText('No songs match "NoMatch".')).toBeVisible();
  });

  test("adds and removes a song from a playlist", async ({ page }) => {
    await page.goto("/playlists/all");

    const alphaRow = page.locator("tbody tr", { hasText: "Alpha" });
    await expect(alphaRow).toBeVisible();

    const alphaActions = alphaRow.getByRole("button", { name: "Song actions" });
    await alphaActions.scrollIntoViewIfNeeded();
    await alphaActions.click();
    await expect(alphaActions).toHaveAttribute("aria-expanded", "true");
    const addToRoadTrip = page.getByRole("menuitem", {
      name: "Add to Road Trip",
    });
    await expect(addToRoadTrip).toBeVisible();
    await addToRoadTrip.evaluate((element) => {
      (element as HTMLElement).click();
    });

    await page.getByRole("link", { name: "Road Trip" }).click();
    await expect(page.getByRole("heading", { name: "Road Trip" })).toBeVisible();
    await expect(page.getByText("1 songs")).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "Alpha" })).toBeVisible();

    const roadTripRow = page.locator("tbody tr", { hasText: "Alpha" });
    const roadTripActions = roadTripRow.getByRole("button", {
      name: "Song actions",
    });
    await roadTripActions.scrollIntoViewIfNeeded();
    await roadTripActions.click();
    await expect(roadTripActions).toHaveAttribute("aria-expanded", "true");
    const removeFromRoadTrip = page.getByRole("menuitem", {
      name: "Remove from Road Trip",
    });
    await expect(removeFromRoadTrip).toBeVisible();
    await removeFromRoadTrip.evaluate((element) => {
      (element as HTMLElement).click();
    });

    await expect(
      page.getByText("This playlist is empty. Add songs to get started."),
    ).toBeVisible();
  });

  test("keeps the current song when switching playlists", async ({ page }) => {
    await page.goto("/playlists/all");

    await expect(page.getByRole("heading", { name: "All Songs" })).toBeVisible();
    await expect(
      page.locator("p", { hasText: "Select a song" }),
    ).toBeVisible();

    const echoRow = page.locator("tbody tr", { hasText: "Echo" });
    await expect(echoRow).toBeVisible();
    await echoRow.click();

    await expect(page.locator("p", { hasText: "Echo" })).toBeVisible();

    await page.getByRole("link", { name: "Road Trip" }).click();
    await expect(page.getByRole("heading", { name: "Road Trip" })).toBeVisible();
    await expect(page.locator("p", { hasText: "Echo" })).toBeVisible();
  });
});
