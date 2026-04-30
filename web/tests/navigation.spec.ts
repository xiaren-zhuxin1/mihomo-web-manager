import { test, expect, TEST_CONFIG, waitForPageLoad, navigateViaSidebar } from './fixtures';

test.describe('健康检查与基础加载', () => {
  test('API 健康检查', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.ok).toBeTruthy();
    expect(data.version).toBeTruthy();
    console.log(`后端版本: ${data.version}, 构建日期: ${data.buildDate}`);
  });

  test('前端页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const title = await page.title();
    expect(title).toBeTruthy();

    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('版本号显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const versionText = page.locator('text=/前端.*v\\d+\\.\\d+\\.\\d+|后端.*v\\d+\\.\\d+\\.\\d+/');
    const count = await versionText.count();
    console.log(`版本号显示元素数: ${count}`);
    if (count > 0) {
      const text = await versionText.first().textContent();
      console.log(`版本信息: ${text}`);
    }
  });
});

test.describe('导航功能', () => {
  test('侧边栏菜单完整', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const navButtons = page.locator('aside.sidebar nav button');
    const count = await navButtons.count();
    expect(count).toBeGreaterThanOrEqual(8);
    console.log(`导航项数: ${count}`);
  });

  test('导航到代理策略页', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '代理策略');
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('导航到节点资源页', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '节点资源');
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('导航到订阅管理页', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '订阅管理');
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('菜单无中英文混用', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const navButtons = page.locator('aside.sidebar nav button');
    const count = await navButtons.count();
    for (let i = 0; i < count; i++) {
      const text = await navButtons.nth(i).textContent();
      expect(text).not.toContain('Provider');
    }
  });
});
