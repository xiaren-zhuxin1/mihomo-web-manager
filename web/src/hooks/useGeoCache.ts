import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface GeoInfo {
  country: string;
  city: string;
  region: string;
  ip: string;
  source: string;
}

interface GeoStatus {
  status: 'cached' | 'testing' | 'failed' | 'not_tested';
  info?: GeoInfo;
}

export function useGeoCache() {
  const [geoCache, setGeoCache] = useState<Record<string, GeoInfo>>({});
  const [testingNodes, setTestingNodes] = useState<Set<string>>(new Set());
  const [failedNodes, setFailedNodes] = useState<Set<string>>(new Set());

  const loadAllCache = useCallback(async () => {
    try {
      const data = await api<Record<string, GeoInfo>>('/api/proxy/geo/cache');
      setGeoCache(data || {});
    } catch {}
  }, []);

  useEffect(() => {
    loadAllCache();
  }, [loadAllCache]);

  const loadGeoForNode = useCallback(async (proxyName: string) => {
    if (geoCache[proxyName] || testingNodes.has(proxyName)) return;
    
    setTestingNodes((current) => new Set(current).add(proxyName));
    setFailedNodes((current) => {
      const next = new Set(current);
      next.delete(proxyName);
      return next;
    });

    try {
      const geoData = await api<GeoInfo>(`/api/proxy/${encodeURIComponent(proxyName)}/geo`);
      if (geoData.country) {
        setGeoCache((current) => ({
          ...current,
          [proxyName]: geoData
        }));
      } else {
        setFailedNodes((current) => new Set(current).add(proxyName));
      }
    } catch {
      setFailedNodes((current) => new Set(current).add(proxyName));
    } finally {
      setTestingNodes((current) => {
        const next = new Set(current);
        next.delete(proxyName);
        return next;
      });
    }
  }, [geoCache, testingNodes]);

  const loadGeoForNodes = useCallback(async (nodeNames: string[], concurrency = 3) => {
    const toLoad = nodeNames.filter((name) => !geoCache[name] && !testingNodes.has(name));
    if (toLoad.length === 0) return;

    const batches: string[][] = [];
    for (let i = 0; i < toLoad.length; i += concurrency) {
      batches.push(toLoad.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      await Promise.all(batch.map((name) => loadGeoForNode(name)));
    }
  }, [geoCache, testingNodes, loadGeoForNode]);

  const getGeoStatus = useCallback((proxyName: string): GeoStatus => {
    if (geoCache[proxyName]) {
      return { status: 'cached', info: geoCache[proxyName] };
    }
    if (testingNodes.has(proxyName)) {
      return { status: 'testing' };
    }
    if (failedNodes.has(proxyName)) {
      return { status: 'failed' };
    }
    return { status: 'not_tested' };
  }, [geoCache, testingNodes, failedNodes]);

  const getGeoLabel = useCallback((proxyName: string): string | null => {
    const geo = geoCache[proxyName];
    if (!geo || !geo.country) return null;
    return `${geo.country}${geo.city ? ` ${geo.city}` : ''}`;
  }, [geoCache]);

  return { 
    geoCache, 
    loadGeoForNode, 
    loadGeoForNodes, 
    getGeoLabel, 
    getGeoStatus,
    loadAllCache 
  };
}
