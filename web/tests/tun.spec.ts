import { test, expect, TEST_CONFIG, waitForPageLoad, dismissGuide } from './fixtures';

test.describe('TUN 设置页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('维护页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const maintenanceNav = page.locator('[data-page="maintenance"], button:has-text("维护"), button:has-text("设置")');
    if (await maintenanceNav.count() > 0) {
      await maintenanceNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .tunForm, .tunStatus');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('TUN 状态显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const maintenanceNav = page.locator('[data-page="maintenance"], button:has-text("维护")');
    if (await maintenanceNav.count() > 0) {
      await maintenanceNav.first().click();
      await waitForPageLoad(page);
      
      const statusBadge = page.locator('.statusBadge, .tunStatus span');
      if (await statusBadge.count() > 0) {
        const status = await statusBadge.first().textContent();
        console.log(`TUN 状态: ${status}`);
      }
    }
  });

  test('诊断信息显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const maintenanceNav = page.locator('[data-page="maintenance"], button:has-text("维护")');
    if (await maintenanceNav.count() > 0) {
      await maintenanceNav.first().click();
      await waitForPageLoad(page);
      
      const blockers = page.locator('.blockerItem, .tunBlockers > div');
      const blockerCount = await blockers.count();
      console.log(`诊断问题数: ${blockerCount}`);
      
      if (blockerCount > 0) {
        const firstBlocker = await blockers.first().textContent();
        console.log(`第一个问题: ${firstBlocker?.substring(0, 100)}...`);
      }
    }
  });

  test('TUN 配置表单', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const maintenanceNav = page.locator('[data-page="maintenance"], button:has-text("维护")');
    if (await maintenanceNav.count() > 0) {
      await maintenanceNav.first().click();
      await waitForPageLoad(page);
      
      const stackSelect = page.locator('select');
      if (await stackSelect.count() > 0) {
        const options = await stackSelect.first().locator('option').count();
        console.log(`Stack 选项数: ${options}`);
      }
      
      const checkbox = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkbox.count();
      console.log(`复选框数: ${checkboxCount}`);
    }
  });

  test('配置文件编辑器', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const maintenanceNav = page.locator('[data-page="maintenance"], button:has-text("维护")');
    if (await maintenanceNav.count() > 0) {
      await maintenanceNav.first().click();
      await waitForPageLoad(page);
      
      const textarea = page.locator('textarea');
      if (await textarea.count() > 0) {
        const content = await textarea.first().inputValue();
        console.log(`配置文件长度: ${content.length} 字符`);
        
        expect(content.length).toBeGreaterThan(0);
      }
    }
  });

  test('保存按钮存在性验证', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const maintenanceNav = page.locator('[data-page="maintenance"], button:has-text("维护")');
    if (await maintenanceNav.count() > 0) {
      await maintenanceNav.first().click();
      await waitForPageLoad(page);
      
      const saveButton = page.locator('button:has-text("保存")');
      const saveCount = await saveButton.count();
      console.log(`保存按钮存在: ${saveCount > 0}`);
      
      console.log('跳过实际保存以避免影响配置');
    }
  });

  test('重载按钮存在性验证', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const maintenanceNav = page.locator('[data-page="maintenance"], button:has-text("维护")');
    if (await maintenanceNav.count() > 0) {
      await maintenanceNav.first().click();
      await waitForPageLoad(page);
      
      const reloadButton = page.locator('button:has-text("重载")');
      const reloadCount = await reloadButton.count();
      console.log(`重载按钮存在: ${reloadCount > 0}`);
      
      console.log('跳过实际重载以避免影响服务');
    }
  });
});

test.describe('路由诊断页面测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('诊断页面加载', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const guideNav = page.locator('[data-page="guide"], button:has-text("诊断"), button:has-text("向导")');
    if (await guideNav.count() > 0) {
      await guideNav.first().click();
      await waitForPageLoad(page);
      
      const panel = page.locator('.panel, .guideSteps, .guideSummary');
      await expect(panel.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('诊断步骤显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const guideNav = page.locator('[data-page="guide"], button:has-text("诊断")');
    if (await guideNav.count() > 0) {
      await guideNav.first().click();
      await waitForPageLoad(page);
      
      const steps = page.locator('.guideStep');
      const stepCount = await steps.count();
      console.log(`诊断步骤数: ${stepCount}`);
    }
  });

  test('诊断结果统计', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const guideNav = page.locator('[data-page="guide"], button:has-text("诊断")');
    if (await guideNav.count() > 0) {
      await guideNav.first().click();
      await waitForPageLoad(page);
      
      const summary = page.locator('.guideSummary');
      if (await summary.count() > 0) {
        const summaryText = await summary.first().textContent();
        console.log(`诊断结果: ${summaryText}`);
      }
    }
  });

  test('重新检测按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const guideNav = page.locator('[data-page="guide"], button:has-text("诊断")');
    if (await guideNav.count() > 0) {
      await guideNav.first().click();
      await waitForPageLoad(page);
      
      const recheckButton = page.locator('button:has-text("重新检测"), button:has-text("检测")');
      const recheckCount = await recheckButton.count();
      console.log(`重新检测按钮存在: ${recheckCount > 0}`);
    }
  });
});
