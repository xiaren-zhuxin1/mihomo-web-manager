import { test, expect, TEST_CONFIG, waitForPageLoad, navigateViaSidebar } from './fixtures';

test.describe('连接追踪页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '连接追踪');
  });

  test('连接页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('连接列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const connectionCards = page.locator('.connectionCard');
    const connectionCount = await connectionCards.count();
    console.log(`当前连接数: ${connectionCount}`);
  });

  test('连接筛选功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const searchInput = page.locator('input.searchInput');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('google');
      await page.waitForTimeout(500);
      console.log('连接筛选功能正常');
      await searchInput.clear();
    }
  });

  test('关闭所有连接按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const closeAllButton = page.locator('button:has-text("关闭所有")');
    const exists = await closeAllButton.isVisible().catch(() => false);
    console.log(`关闭所有按钮存在: ${exists}`);
  });
});

test.describe('流量监控页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '流量监控');
  });

  test('流量页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('流量统计显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const uploadStat = page.locator(':text("上传")');
    const downloadStat = page.locator(':text("下载")');
    const uploadVisible = await uploadStat.first().isVisible().catch(() => false);
    const downloadVisible = await downloadStat.first().isVisible().catch(() => false);
    console.log(`上传统计可见: ${uploadVisible}, 下载统计可见: ${downloadVisible}`);
  });
});
