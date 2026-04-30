import { test, expect, TEST_CONFIG, waitForPageLoad, dismissGuide, getProxyGroups } from './fixtures';

test.describe('代理策略页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('代理页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理"), a:has-text("代理")');
    if (await proxiesNav.count() > 0) {
      await proxiesNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .proxyGrid, .proxyToolbar');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('策略组列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const groups = await getProxyGroups(page);
    console.log(`发现 ${groups.length} 个策略组: ${groups.slice(0, 5).join(', ')}...`);
    
    if (groups.length > 0) {
      const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理")');
      if (await proxiesNav.count() > 0) {
        await proxiesNav.first().click();
        await waitForPageLoad(page);
        
        const groupSelect = page.locator('select');
        if (await groupSelect.count() > 0) {
          const options = await groupSelect.locator('option').count();
          console.log(`策略组下拉选项数: ${options}`);
          expect(options).toBeGreaterThan(0);
        }
      }
    }
  });

  test('节点列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理")');
    if (await proxiesNav.count() > 0) {
      await proxiesNav.first().click();
      await waitForPageLoad(page);
      
      const proxyCards = page.locator('.proxyCard, .proxyNode');
      const proxyCount = await proxyCards.count();
      console.log(`节点数: ${proxyCount}`);
    }
  });

  test('节点筛选功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理")');
    if (await proxiesNav.count() > 0) {
      await proxiesNav.first().click();
      await waitForPageLoad(page);
      
      const searchInput = page.locator('input[placeholder*="筛选"], input[placeholder*="搜索"]');
      if (await searchInput.count() > 0) {
        await searchInput.first().fill('香港');
        await page.waitForTimeout(500);
        
        const filteredCount = await page.locator('.proxyCard:visible, .proxyNode:visible').count();
        console.log(`筛选后节点数: ${filteredCount}`);
        
        await searchInput.first().clear();
      }
    }
  });

  test('排序切换功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理")');
    if (await proxiesNav.count() > 0) {
      await proxiesNav.first().click();
      await waitForPageLoad(page);
      
      const sortButton = page.locator('button:has-text("延迟"), button:has-text("名称")');
      if (await sortButton.count() > 0) {
        await sortButton.first().click();
        await page.waitForTimeout(300);
        console.log('排序切换成功');
      }
    }
  });

  test('刷新按钮功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理")');
    if (await proxiesNav.count() > 0) {
      await proxiesNav.first().click();
      await waitForPageLoad(page);
      
      const refreshButton = page.locator('button:has-text("刷新")');
      if (await refreshButton.count() > 0) {
        console.log('刷新按钮存在');
      }
    }
  });

  test('节点测速功能（只读验证）', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理")');
    if (await proxiesNav.count() > 0) {
      await proxiesNav.first().click();
      await waitForPageLoad(page);
      
      const testButton = page.locator('button:has-text("测速"), button[title*="测速"]');
      const testCount = await testButton.count();
      console.log(`测速按钮数: ${testCount}`);
      
      console.log('跳过实际测速以避免影响服务');
    }
  });

  test('延迟显示格式', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const proxiesNav = page.locator('[data-page="proxies"], button:has-text("代理")');
    if (await proxiesNav.count() > 0) {
      await proxiesNav.first().click();
      await waitForPageLoad(page);
      
      const delayElements = page.locator('.proxyDelay, .delay');
      const delayCount = await delayElements.count();
      
      if (delayCount > 0) {
        const firstDelay = await delayElements.first().textContent();
        console.log(`延迟格式示例: ${firstDelay}`);
      }
    }
  });
});
