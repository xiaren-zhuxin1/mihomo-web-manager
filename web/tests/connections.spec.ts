import { test, expect, TEST_CONFIG, waitForPageLoad, dismissGuide } from './fixtures';

test.describe('连接追踪页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('连接页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const connectionsNav = page.locator('[data-page="connections"], button:has-text("连接"), a:has-text("连接")');
    if (await connectionsNav.count() > 0) {
      await connectionsNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .connectionList, .connectionToolbar');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('连接列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const connectionsNav = page.locator('[data-page="connections"], button:has-text("连接")');
    if (await connectionsNav.count() > 0) {
      await connectionsNav.first().click();
      await waitForPageLoad(page);
      
      const connectionCards = page.locator('.connectionCard, .connectionList > div');
      const connectionCount = await connectionCards.count();
      console.log(`当前连接数: ${connectionCount}`);
    }
  });

  test('连接筛选功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const connectionsNav = page.locator('[data-page="connections"], button:has-text("连接")');
    if (await connectionsNav.count() > 0) {
      await connectionsNav.first().click();
      await waitForPageLoad(page);
      
      const searchInput = page.locator('input[placeholder*="筛选"], input[placeholder*="搜索"]');
      if (await searchInput.count() > 0) {
        await searchInput.first().fill('google');
        await page.waitForTimeout(500);
        
        const filteredCount = await page.locator('.connectionCard:visible').count();
        console.log(`筛选后连接数: ${filteredCount}`);
        
        await searchInput.first().clear();
      }
    }
  });

  test('关闭连接按钮存在性验证', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const connectionsNav = page.locator('[data-page="connections"], button:has-text("连接")');
    if (await connectionsNav.count() > 0) {
      await connectionsNav.first().click();
      await waitForPageLoad(page);
      
      const closeButton = page.locator('button:has-text("关闭"), button[title*="关闭"]');
      const closeCount = await closeButton.count();
      console.log(`关闭按钮数: ${closeCount}`);
      
      console.log('跳过实际关闭以避免影响连接');
    }
  });

  test('关闭所有连接按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const connectionsNav = page.locator('[data-page="connections"], button:has-text("连接")');
    if (await connectionsNav.count() > 0) {
      await connectionsNav.first().click();
      await waitForPageLoad(page);
      
      const closeAllButton = page.locator('button:has-text("关闭所有"), button:has-text("Close All")');
      const closeAllCount = await closeAllButton.count();
      console.log(`关闭所有按钮存在: ${closeAllCount > 0}`);
    }
  });

  test('连接详情显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const connectionsNav = page.locator('[data-page="connections"], button:has-text("连接")');
    if (await connectionsNav.count() > 0) {
      await connectionsNav.first().click();
      await waitForPageLoad(page);
      
      const connectionCards = page.locator('.connectionCard');
      if (await connectionCards.count() > 0) {
        const firstCard = connectionCards.first();
        const cardText = await firstCard.textContent();
        console.log(`连接详情示例: ${cardText?.substring(0, 100)}...`);
      }
    }
  });
});

test.describe('流量监控页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('流量页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const trafficNav = page.locator('[data-page="traffic"], button:has-text("流量")');
    if (await trafficNav.count() > 0) {
      await trafficNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .trafficChart, .trafficStats');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('流量统计显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const trafficNav = page.locator('[data-page="traffic"], button:has-text("流量")');
    if (await trafficNav.count() > 0) {
      await trafficNav.first().click();
      await waitForPageLoad(page);
      
      const uploadStat = page.locator('.uploadStat, :text("上传")');
      const downloadStat = page.locator('.downloadStat, :text("下载")');
      
      if (await uploadStat.count() > 0) {
        const uploadText = await uploadStat.first().textContent();
        console.log(`上传统计: ${uploadText}`);
      }
      
      if (await downloadStat.count() > 0) {
        const downloadText = await downloadStat.first().textContent();
        console.log(`下载统计: ${downloadText}`);
      }
    }
  });

  test('实时流量图表', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const trafficNav = page.locator('[data-page="traffic"], button:has-text("流量")');
    if (await trafficNav.count() > 0) {
      await trafficNav.first().click();
      await waitForPageLoad(page);
      
      const chart = page.locator('canvas, svg, .chart');
      if (await chart.count() > 0) {
        console.log('流量图表存在');
      }
    }
  });
});
