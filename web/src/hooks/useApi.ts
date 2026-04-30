import { useCallback } from 'react';
import { useApp } from '../contexts/AppContext';

export function readError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('fetch')) {
      return '无法连接到管理服务，请确认服务已启动';
    }
    return err.message;
  }
  return String(err);
}

export function useApi() {
  const { showToast, setError } = useApp();

  const request = useCallback(async <T,>(
    url: string,
    options?: RequestInit
  ): Promise<T> => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(parseErrorText(text) || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      const message = readError(err);
      setError(message);
      throw err;
    }
  }, [setError]);

  const get = useCallback(<T,>(url: string): Promise<T> => {
    return request<T>(url);
  }, [request]);

  const post = useCallback(<T,>(url: string, data?: unknown): Promise<T> => {
    return request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }, [request]);

  const del = useCallback(<T,>(url: string): Promise<T> => {
    return request<T>(url, { method: 'DELETE' });
  }, [request]);

  const patch = useCallback(<T,>(url: string, data?: unknown): Promise<T> => {
    return request<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }, [request]);

  return { request, get, post, del, patch, readError };
}

function parseErrorText(text: string): string {
  if (!text.trim()) return '';
  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error || data.message || text;
  } catch {
    return text;
  }
}
