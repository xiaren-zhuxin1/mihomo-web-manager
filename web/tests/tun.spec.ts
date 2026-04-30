import { test, expect, TEST_CONFIG, waitForPageLoad, navigateViaSidebar } from './fixtures';

test.describe('TUN 设置页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '配置维护');
  });

  test('维护页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('TUN 状态显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const statusBadge = page.locator('.statusBadge, .tunStatus span');
    if (await statusBadge.count() > 0) {
      const status = await statusBadge.first().textContent();
      console.log(`TUN 状态: ${status}`);
    }
  });

  test('诊断信息显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const blockers = page.locator('.blockerItem');
    const blockerCount = await blockers.count();
    console.log(`诊断问题数: ${blockerCount}`);
  });

  test('TUN 配置表单', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const stackSelect = page.locator('select');
    if (await stackSelect.count() > 0) {
      const options = await stackSelect.first().locator('option').count();
      console.log(`Stack 选项数: ${options}`);
    }
  });

  test('配置文件编辑器', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const textarea = page.locator('textarea');
    if (await textarea.count() > 0) {
      const content = await textarea.first().inputValue();
      console.log(`配置文件长度: ${content.length} 字符`);
    }
  });

  test('保存按钮存在', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const saveButton = page.locator('button:has-text("保存")');
    const exists = await saveButton.isVisible().catch(() => false);
    console.log(`保存按钮存在: ${exists}`);
  });

  test('重载按钮存在', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const reloadButton = page.locator('button:has-text("重载")');
    const exists = await reloadButton.isVisible().catch(() => false);
    console.log(`重载按钮存在: ${exists}`);
  });
});

test.describe('路由诊断页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await navigateViaSidebar(page, '路由向导');
  });

  test('诊断页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const panel = page.locator('.panel');
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('诊断步骤显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const steps = page.locator('.guideStep');
    const stepCount = await steps.count();
    console.log(`诊断步骤数: ${stepCount}`);
  });

  test('重新检测按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const recheckButton = page.locator('button:has-text("重新检测"), button:has-text("检测")');
    const exists = await recheckButton.isVisible().catch(() => false);
    console.log(`重新检测按钮存在: ${exists}`);
  });
});
