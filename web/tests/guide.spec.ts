import { test, expect, TEST_CONFIG, waitForPageLoad, dismissGuide, checkApiHealth } from './fixtures';

test.describe('API 健康检查', () => {
  test('健康检查端点', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log('健康检查结果:', JSON.stringify(data, null, 2));
    
    expect(data.ok).toBe(true);
    expect(data.mihomoController).toBeDefined();
    expect(data.mihomoConfigPath).toBeDefined();
  });

  test('mihomo 代理 API', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/mihomo/proxies`);
    console.log(`代理 API 状态: ${response.status()}`);
    
    if (response.ok()) {
      const data = await response.json();
      const proxyCount = Object.keys(data.proxies || {}).length;
      console.log(`代理数量: ${proxyCount}`);
      expect(proxyCount).toBeGreaterThan(0);
    }
  });

  test('mihomo 连接 API', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/mihomo/connections`);
    console.log(`连接 API 状态: ${response.status()}`);
    expect(response.ok()).toBeTruthy();
  });

  test('mihomo 版本 API', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.baseUrl}/api/mihomo/version`);
    console.log(`版本 API 状态: ${response.status()}`);
    
    if (response.ok()) {
      const data = await response.json();
      console.log(`mihomo 版本: ${data.version || 'unknown'}`);
    }
  });
});

test.describe('页面引导功能测试', () => {
  test('页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await waitForPageLoad(page);
    
    const bodyContent = await page.locator('body').innerHTML();
    console.log(`页面内容长度: ${bodyContent.length}`);
    
    expect(bodyContent.length).toBeGreaterThan(100);
  });

  test('引导提示显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await waitForPageLoad(page);
    
    const pageGuide = page.locator('.pageGuide');
    const guideCount = await pageGuide.count();
    
    console.log(`发现 ${guideCount} 个引导提示`);
    
    if (guideCount > 0) {
      const guideTitle = page.locator('.pageGuideHeader strong');
      await expect(guideTitle.first()).toBeVisible();
      
      const nextButton = page.locator('.pageGuideNext');
      await expect(nextButton.first()).toBeVisible();
    }
  });

  test('引导提示确认功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForPageLoad(page);
    
    const guideNext = page.locator('.pageGuideNext');
    const initialCount = await guideNext.count();
    
    if (initialCount > 0) {
      await guideNext.first().click();
      await page.waitForTimeout(300);
      
      const afterCount = await guideNext.count();
      expect(afterCount).toBeLessThan(initialCount);
    }
  });
});

test.describe('导航功能测试', () => {
  test('侧边栏显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    
    const sidebar = page.locator('.sidebar, nav, [class*="sidebar"]');
    const sidebarCount = await sidebar.count();
    console.log(`侧边栏元素数量: ${sidebarCount}`);
    
    expect(sidebarCount).toBeGreaterThan(0);
  });

  test('页面切换', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
    
    const navButtons = page.locator('button, [role="button"], a');
    const count = await navButtons.count();
    console.log(`可点击元素数量: ${count}`);
    
    expect(count).toBeGreaterThan(0);
  });
});
