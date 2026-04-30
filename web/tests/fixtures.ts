import { test as base, Page, expect } from '@playwright/test';

type TestFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await use(page);
  },
});

export { expect };

export const TEST_CONFIG = {
  baseUrl: 'http://192.168.231.66:8081',
  timeout: {
    short: 5000,
    medium: 15000,
    long: 30000,
  },
};

export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

export async function navigateViaSidebar(page: Page, label: string) {
  const navButton = page.locator(`aside.sidebar nav button:has-text("${label}")`);
  await navButton.first().click();
  await waitForPageLoad(page);
}

export async function apiGet(endpoint: string) {
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}${endpoint}`);
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return null;
}
