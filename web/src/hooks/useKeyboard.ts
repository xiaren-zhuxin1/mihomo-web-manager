import { useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { PAGE_SHORTCUTS } from '../constants/navigation';
import type { Page } from '../types';

export function useKeyboard() {
  const { page, setPage, toggleTheme, theme, showToast } = useApp();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleTheme();
      showToast('info', `已切换到${theme === 'light' ? '暗色' : '亮色'}模式`);
      return;
    }

    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      showToast('success', '状态已刷新');
      return;
    }

    if (e.key === '?' || e.key === 'h') {
      e.preventDefault();
      showToast('info', '快捷键: 1-9 切换页面, Ctrl+D 切换主题, Ctrl+R 刷新');
      return;
    }

    const targetPage = PAGE_SHORTCUTS[e.key];
    if (targetPage && targetPage !== page) {
      setPage(targetPage);
    }
  }, [page, setPage, toggleTheme, theme, showToast]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function usePageShortcuts() {
  return PAGE_SHORTCUTS;
}
