import { test, expect, TEST_CONFIG, waitForPageLoad, dismissGuide } from './fixtures';

test.describe('订阅管理页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('订阅页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const subsNav = page.locator('[data-page="subscriptions"], button:has-text("订阅")');
    if (await subsNav.count() > 0) {
      await subsNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .subList, .subToolbar');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('订阅列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const subsNav = page.locator('[data-page="subscriptions"], button:has-text("订阅")');
    if (await subsNav.count() > 0) {
      await subsNav.first().click();
      await waitForPageLoad(page);
      
      const subCards = page.locator('.subCard, .subscriptionCard');
      const subCount = await subCards.count();
      console.log(`订阅数: ${subCount}`);
    }
  });

  test('添加订阅按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const subsNav = page.locator('[data-page="subscriptions"], button:has-text("订阅")');
    if (await subsNav.count() > 0) {
      await subsNav.first().click();
      await waitForPageLoad(page);
      
      const addButton = page.locator('button:has-text("添加"), button:has-text("新增")');
      const addCount = await addButton.count();
      console.log(`添加订阅按钮存在: ${addCount > 0}`);
    }
  });

  test('订阅流量显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const subsNav = page.locator('[data-page="subscriptions"], button:has-text("订阅")');
    if (await subsNav.count() > 0) {
      await subsNav.first().click();
      await waitForPageLoad(page);
      
      const trafficBar = page.locator('.trafficBar, .subTraffic');
      if (await trafficBar.count() > 0) {
        console.log('流量进度条存在');
      }
      
      const expireInfo = page.locator('.subExpire, :text("过期")');
      if (await expireInfo.count() > 0) {
        const expireText = await expireInfo.first().textContent();
        console.log(`过期信息: ${expireText}`);
      }
    }
  });

  test('刷新订阅按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const subsNav = page.locator('[data-page="subscriptions"], button:has-text("订阅")');
    if (await subsNav.count() > 0) {
      await subsNav.first().click();
      await waitForPageLoad(page);
      
      const refreshButton = page.locator('button:has-text("刷新"), button:has-text("更新")');
      const refreshCount = await refreshButton.count();
      console.log(`刷新按钮数: ${refreshCount}`);
      
      console.log('跳过实际刷新以避免影响订阅');
    }
  });
});

test.describe('规则页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('规则页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const rulesNav = page.locator('[data-page="rules"], button:has-text("规则")');
    if (await rulesNav.count() > 0) {
      await rulesNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .ruleList, .table');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('Rule Providers 显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const rulesNav = page.locator('[data-page="rules"], button:has-text("规则")');
    if (await rulesNav.count() > 0) {
      await rulesNav.first().click();
      await waitForPageLoad(page);
      
      const providers = page.locator('.tableRow, .providerRow');
      const providerCount = await providers.count();
      console.log(`Rule Providers 数: ${providerCount}`);
    }
  });

  test('规则列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const rulesNav = page.locator('[data-page="rules"], button:has-text("规则")');
    if (await rulesNav.count() > 0) {
      await rulesNav.first().click();
      await waitForPageLoad(page);
      
      const ruleCards = page.locator('.ruleCard');
      const ruleCount = await ruleCards.count();
      console.log(`规则数: ${ruleCount}`);
    }
  });

  test('规则筛选功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const rulesNav = page.locator('[data-page="rules"], button:has-text("规则")');
    if (await rulesNav.count() > 0) {
      await rulesNav.first().click();
      await waitForPageLoad(page);
      
      const searchInput = page.locator('input[placeholder*="筛选"], input[placeholder*="搜索"]');
      if (await searchInput.count() > 0) {
        await searchInput.first().fill('DOMAIN');
        await page.waitForTimeout(500);
        
        const filteredRules = await page.locator('.ruleCard:visible').count();
        console.log(`筛选后规则数: ${filteredRules}`);
        
        await searchInput.first().clear();
      }
    }
  });

  test('目标筛选标签', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const rulesNav = page.locator('[data-page="rules"], button:has-text("规则")');
    if (await rulesNav.count() > 0) {
      await rulesNav.first().click();
      await waitForPageLoad(page);
      
      const targetChips = page.locator('.targetChip, .targetRow');
      const chipCount = await targetChips.count();
      console.log(`目标筛选标签数: ${chipCount}`);
    }
  });
});

test.describe('Providers 页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('Providers 页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const providersNav = page.locator('[data-page="providers"], button:has-text("Provider")');
    if (await providersNav.count() > 0) {
      await providersNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .providerGrid, .split');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('Provider 列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const providersNav = page.locator('[data-page="providers"], button:has-text("Provider")');
    if (await providersNav.count() > 0) {
      await providersNav.first().click();
      await waitForPageLoad(page);
      
      const providerCards = page.locator('.providerCard');
      const providerCount = await providerCards.count();
      console.log(`Provider 数: ${providerCount}`);
    }
  });

  test('Provider 节点显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const providersNav = page.locator('[data-page="providers"], button:has-text("Provider")');
    if (await providersNav.count() > 0) {
      await providersNav.first().click();
      await waitForPageLoad(page);
      
      const providerCard = page.locator('.providerCard').first();
      if (await providerCard.count() > 0) {
        await providerCard.click();
        await page.waitForTimeout(500);
        
        const nodeCards = page.locator('.providerNodeCard');
        const nodeCount = await nodeCards.count();
        console.log(`选中 Provider 的节点数: ${nodeCount}`);
      }
    }
  });
});
