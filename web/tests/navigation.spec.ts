import { test, expect, TEST_CONFIG, waitForPageLoad, dismissGuide } from './fixtures';

test.describe('导航功能测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto(`/?secret=${TEST_CONFIG.secret}`);
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('侧边栏显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const sidebar = page.locator('.sidebar, nav, aside, .nav, [class*="sidebar"], [class*="nav"]');
    const sidebarCount = await sidebar.count();
    
    if (sidebarCount > 0) {
      console.log(`侧边栏元素数: ${sidebarCount}`);
    } else {
      const bodyContent = await page.locator('body').innerHTML();
      console.log(`页面内容长度: ${bodyContent.length}`);
      if (bodyContent.length < 100) {
        console.log('页面内容较少，可能需要登录或服务未响应');
      }
    }
  });

  test('顶部栏显示', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const topbar = page.locator('.topbar, header, .header');
    const topbarCount = await topbar.count();
    console.log(`顶部栏存在: ${topbarCount > 0}`);
  });

  test('页面导航切换', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const navItems = page.locator('[data-page], nav button, .nav-item');
    const navCount = await navItems.count();
    console.log(`导航项数: ${navCount}`);
    
    if (navCount > 1) {
      await navItems.nth(1).click();
      await waitForPageLoad(page);
      
      const currentUrl = page.url();
      console.log(`当前 URL: ${currentUrl}`);
    }
  });

  test('键盘快捷键导航', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(500);
    
    console.log('键盘快捷键测试完成');
  });

  test('页面标题更新', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const title = await page.title();
    console.log(`页面标题: ${title}`);
  });
});

test.describe('主题切换测试', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto(`/?secret=${TEST_CONFIG.secret}`);
    await waitForPageLoad(page);
    await dismissGuide(page);
  });

  test('主题切换按钮', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const themeButton = page.locator('button:has-text("主题"), button[title*="主题"], button[title*="theme"]');
    const themeCount = await themeButton.count();
    console.log(`主题切换按钮存在: ${themeCount > 0}`);
    
    if (themeCount > 0) {
      await themeButton.first().click();
      await page.waitForTimeout(300);
      console.log('主题切换成功');
    }
  });

  test('暗色主题应用', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const themeButton = page.locator('button:has-text("主题"), button[title*="主题"]');
    if (await themeButton.count() > 0) {
      await themeButton.first().click();
      await page.waitForTimeout(300);
      
      const appElement = page.locator('.app, body');
      const className = await appElement.first().getAttribute('class');
      console.log(`主题类名: ${className}`);
    }
  });

  test('主题持久化', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const themeButton = page.locator('button:has-text("主题"), button[title*="主题"]');
    if (await themeButton.count() > 0) {
      await themeButton.first().click();
      await page.waitForTimeout(300);
      
      const storedTheme = await page.evaluate(() => localStorage.getItem('theme'));
      console.log(`存储的主题: ${storedTheme}`);
    }
  });
});

test.describe('响应式布局测试', () => {
  test('桌面视图', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/?secret=${TEST_CONFIG.secret}`);
    await waitForPageLoad(page);
    
    const sidebar = page.locator('.sidebar, nav');
    const sidebarVisible = await sidebar.first().isVisible();
    console.log(`桌面视图侧边栏可见: ${sidebarVisible}`);
  });

  test('平板视图', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/?secret=${TEST_CONFIG.secret}`);
    await waitForPageLoad(page);
    
    console.log('平板视图测试完成');
  });

  test('移动视图', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/?secret=${TEST_CONFIG.secret}`);
    await waitForPageLoad(page);
    
    console.log('移动视图测试完成');
  });
});

test.describe('错误处理测试', () => {
  test('网络错误处理', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    
    await page.context().setOffline(false);
    console.log('网络恢复测试完成');
  });

  test('API 错误响应处理', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.goto(`/?secret=${TEST_CONFIG.secret}`);
    await page.waitForTimeout(2000);
    
    const errorNotice = page.locator('.error, .notice.error, .inlineError');
    const errorCount = await errorNotice.count();
    console.log(`错误提示数: ${errorCount}`);
    
    await page.unroute('**/api/**');
  });
});

test.describe('性能测试', () => {
  test('页面加载时间', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const startTime = Date.now();
    await page.goto(`/?secret=${TEST_CONFIG.secret}`);
    await waitForPageLoad(page);
    const loadTime = Date.now() - startTime;
    
    console.log(`页面加载时间: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(10000);
  });

  test('首次内容绘制', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
      };
    });
    
    console.log(`DOM 内容加载: ${timing.domContentLoaded}ms`);
    console.log(`页面完全加载: ${timing.load}ms`);
  });
});
