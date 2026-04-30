import { test as base, Page, expect } from '@playwright/test';

type TestFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/');
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

export async function navigateToPage(page: Page, pageName: string) {
  const navItem = page.locator(`[data-page="${pageName}"], button:has-text("${getPageTitle(pageName)}"), a:has-text("${getPageTitle(pageName)}")`);
  await navItem.first().click();
  await waitForPageLoad(page);
}

function getPageTitle(pageName: string): string {
  const titles: Record<string, string> = {
    'overview': '总览',
    'proxies': '代理',
    'connections': '连接',
    'subscriptions': '订阅',
    'maintenance': '维护',
    'traffic': '流量',
    'logs': '日志',
    'topology': '拓扑',
    'rules': '规则',
    'providers': 'Provider',
    'config': '配置',
    'guide': '诊断',
  };
  return titles[pageName] || pageName;
}

export async function dismissGuide(page: Page) {
  const guideDismiss = page.locator('.pageGuideNext, button:has-text("知道了")');
  while (await guideDismiss.count() > 0) {
    await guideDismiss.first().click();
    await page.waitForTimeout(200);
  }
}

export async function safeClick(page: Page, selector: string) {
  try {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible', timeout: 5000 });
    await element.click();
    return true;
  } catch {
    return false;
  }
}

export async function safeFill(page: Page, selector: string, value: string) {
  try {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible', timeout: 5000 });
    await element.fill(value);
    return true;
  } catch {
    return false;
  }
}

export async function checkApiHealth(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/health`);
    return response.ok();
  } catch {
    return false;
  }
}

export async function getProxyGroups(page: Page): Promise<string[]> {
  try {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/mihomo/proxies`);
    if (response.ok()) {
      const data = await response.json();
      return Object.keys(data.proxies || {});
    }
  } catch {
    // Ignore
  }
  return [];
}

export async function apiGet(page: Page, endpoint: string): Promise<any> {
  try {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}${endpoint}`);
    if (response.ok()) {
      return await response.json();
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function apiPost(page: Page, endpoint: string, data?: any): Promise<boolean> {
  try {
    const response = await page.request.post(`${TEST_CONFIG.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: data ? JSON.stringify(data) : undefined,
    });
    return response.ok();
  } catch {
    return false;
  }
}
