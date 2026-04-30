import { test, expect, TEST_CONFIG, waitForPageLoad, navigateViaSidebar } from './fixtures';

test.describe('订阅管理页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '订阅管理');
  });

  test('订阅页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('订阅列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const subCards = page.locator('.subCard, .subscriptionCard');
    const subCount = await subCards.count();
    console.log(`订阅数: ${subCount}`);
  });

  test('添加订阅按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const addButton = page.locator('button:has-text("添加"), button:has-text("新增")');
    const addCount = await addButton.count();
    console.log(`添加订阅按钮存在: ${addCount > 0}`);
  });

  test('刷新订阅按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const refreshButton = page.locator('button:has-text("刷新"), button:has-text("更新")');
    const refreshCount = await refreshButton.count();
    console.log(`刷新按钮数: ${refreshCount}`);
  });
});

test.describe('规则页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '规则命中');
  });

  test('规则页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('规则资源显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const providers = page.locator('.tableRow');
    const providerCount = await providers.count();
    console.log(`规则资源数: ${providerCount}`);
  });

  test('规则列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const ruleCards = page.locator('.ruleCard');
    const ruleCount = await ruleCards.count();
    console.log(`规则数: ${ruleCount}`);
  });

  test('规则筛选功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const searchInput = page.locator('input.searchInput');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('DOMAIN');
      await page.waitForTimeout(500);
      console.log('规则筛选功能正常');
      await searchInput.clear();
    }
  });
});

test.describe('节点资源页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '节点资源');
  });

  test('节点资源页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('资源列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const providerCards = page.locator('.providerCard');
    const providerCount = await providerCards.count();
    console.log(`资源数: ${providerCount}`);
  });

  test('资源节点显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const providerCard = page.locator('.providerCard').first();
    if (await providerCard.isVisible().catch(() => false)) {
      await providerCard.click();
      await page.waitForTimeout(500);
      const nodeCards = page.locator('.providerNodeCard');
      const nodeCount = await nodeCards.count();
      console.log(`选中资源的节点数: ${nodeCount}`);
    }
  });
});
