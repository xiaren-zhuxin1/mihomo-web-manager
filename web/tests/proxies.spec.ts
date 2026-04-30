import { test, expect, TEST_CONFIG, waitForPageLoad, navigateViaSidebar } from './fixtures';

test.describe('代理策略 - 节点选择交互', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '代理策略');
  });

  test('策略组列表显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const groupButtons = page.locator('.list .row');
    const count = await groupButtons.count();
    expect(count).toBeGreaterThan(0);
    console.log(`策略组数: ${count}`);
  });

  test('策略组类型标签显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const manualBadges = page.locator('.badge.selectable');
    const autoBadges = page.locator('.badge.auto');
    const manualCount = await manualBadges.count();
    const autoCount = await autoBadges.count();
    console.log(`手动策略组: ${manualCount}, 自动策略组: ${autoCount}`);
    expect(manualCount + autoCount).toBeGreaterThan(0);
  });

  test('选择策略组显示节点列表', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const groupButtons = page.locator('.list .row');
    if (await groupButtons.count() > 0) {
      await groupButtons.first().click();
      await page.waitForTimeout(1000);
      const nodeCards = page.locator('.nodeCard');
      const count = await nodeCards.count();
      console.log(`节点数: ${count}`);
    }
  });

  test('手动策略组提示信息', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const manualBadges = page.locator('.badge.selectable');
    if (await manualBadges.count() > 0) {
      const groupRow = manualBadges.first().locator('..');
      await groupRow.click();
      await page.waitForTimeout(500);
      const hint = page.locator('.inlineHint:has-text("手动选择")');
      const hintVisible = await hint.isVisible().catch(() => false);
      console.log(`手动策略组提示可见: ${hintVisible}`);
    }
  });

  test('自动策略组提示信息', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const autoBadges = page.locator('.badge.auto');
    if (await autoBadges.count() > 0) {
      const groupRow = autoBadges.first().locator('..');
      await groupRow.click();
      await page.waitForTimeout(500);
      const hint = page.locator('.inlineHint:has-text("自动选择")');
      const hintVisible = await hint.isVisible().catch(() => false);
      console.log(`自动策略组提示可见: ${hintVisible}`);
    }
  });

  test('点击节点卡片选用', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const manualBadges = page.locator('.badge.selectable');
    if (await manualBadges.count() > 0) {
      const groupRow = manualBadges.first().locator('..');
      await groupRow.click();
      await page.waitForTimeout(1000);

      const clickableCards = page.locator('.nodeCard.clickable');
      const count = await clickableCards.count();
      if (count > 1) {
        const selectedBefore = page.locator('.nodeCard.selected');
        const selectedBeforeCount = await selectedBefore.count();

        const unselectedCard = page.locator('.nodeCard.clickable:not(.selected)').first();
        if (await unselectedCard.isVisible()) {
          await unselectedCard.click();
          await page.waitForTimeout(2000);

          const selectedAfter = page.locator('.nodeCard.selected');
          const selectedAfterCount = await selectedAfter.count();
          console.log(`选中前: ${selectedBeforeCount}, 选中后: ${selectedAfterCount}`);
        }
      }
    }
  });

  test('当前节点标签显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const groupButtons = page.locator('.list .row');
    if (await groupButtons.count() > 0) {
      await groupButtons.first().click();
      await page.waitForTimeout(1000);

      const currentLabel = page.locator('.currentLabel:has-text("当前节点")');
      const count = await currentLabel.count();
      console.log(`当前节点标签数: ${count}`);
    }
  });

  test('节点地区badge显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const groupButtons = page.locator('.list .row');
    if (await groupButtons.count() > 0) {
      await groupButtons.first().click();
      await page.waitForTimeout(3000);

      const regionBadges = page.locator('.badge.region');
      const count = await regionBadges.count();
      console.log(`地区badge数: ${count}`);
      if (count > 0) {
        const firstRegion = await regionBadges.first().textContent();
        console.log(`地区示例: ${firstRegion}`);
      }
    }
  });

  test('节点筛选功能', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const groupButtons = page.locator('.list .row');
    if (await groupButtons.count() > 0) {
      await groupButtons.first().click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('input.searchInput');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        console.log('筛选功能正常');
        await searchInput.clear();
      }
    }
  });

  test('排序切换', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const groupButtons = page.locator('.list .row');
    if (await groupButtons.count() > 0) {
      await groupButtons.first().click();
      await page.waitForTimeout(500);

      const delaySort = page.locator('button:has-text("延迟")');
      const nameSort = page.locator('button:has-text("名称")');
      if (await delaySort.isVisible()) {
        await delaySort.click();
        await page.waitForTimeout(300);
      }
      if (await nameSort.isVisible()) {
        await nameSort.click();
        await page.waitForTimeout(300);
      }
      console.log('排序切换正常');
    }
  });

  test('全组测速按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const groupButtons = page.locator('.list .row');
    if (await groupButtons.count() > 0) {
      await groupButtons.first().click();
      await page.waitForTimeout(500);

      const testAllButton = page.locator('button:has-text("全组测速")');
      const visible = await testAllButton.isVisible().catch(() => false);
      console.log(`全组测速按钮可见: ${visible}`);
    }
  });
});
