import { test, expect, TEST_CONFIG, waitForPageLoad, navigateViaSidebar } from './fixtures';

test.describe('API 健康检查', () => {
  test('健康检查端点', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.version).toBeTruthy();
    console.log(`后端版本: ${data.version}, 构建日期: ${data.buildDate}`);
  });

  test('mihomo 代理 API', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/mihomo/proxies`);
    if (response.ok()) {
      const data = await response.json();
      const proxyCount = Object.keys(data.proxies || {}).length;
      console.log(`代理数量: ${proxyCount}`);
      expect(proxyCount).toBeGreaterThan(0);
    }
  });

  test('mihomo 连接 API', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/mihomo/connections`);
    expect(response.ok()).toBeTruthy();
  });

  test('mihomo 版本 API', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/mihomo/version`);
    if (response.ok()) {
      const data = await response.json();
      console.log(`mihomo 版本: ${data.version || 'unknown'}`);
    }
  });
});

test.describe('路由向导页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '路由向导');
  });

  test('向导页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('向导步骤显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const guideSteps = page.locator('.guideSteps, .routeFlow, .guideGrid');
    const count = await guideSteps.count();
    console.log(`向导步骤区域数: ${count}`);
  });

  test('向导无中英文混用', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('Provider 是');
    expect(bodyText).not.toContain('Provider 负责');
  });
});
