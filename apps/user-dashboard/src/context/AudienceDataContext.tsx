import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CustomerProfile } from '@/types';
import { mockUniversalAudience } from '@/data';
import { apiFetchJson } from '@/lib/api-client';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { enrichCustomer } from '@/lib/scoring';
import { parseExcelCustomers, buildExcelTemplate } from '@/lib/excelImport';
import { useSubscription } from '@/context/SubscriptionContext';
import { pushToast } from '@/lib/toast';

const STORAGE_KEY = 'aura-audience-db-v2';

function loadInitial(): CustomerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CustomerProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c) => enrichCustomer(c));
      }
    }
  } catch {
    /* ignore */
  }
  return mockUniversalAudience.map((c) => enrichCustomer(c));
}

type AudienceDataContextValue = {
  clients: CustomerProfile[];
  setClients: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
  replaceAll: (next: CustomerProfile[]) => void;
  mergeImported: (imported: CustomerProfile[]) => void;
  resetToDemo: () => void;
  downloadTemplate: () => void;
  importError: string | null;
  importExcelFile: (file: File) => Promise<void>;
  lastImportInfo: string | null;
};

const AudienceDataContext = createContext<AudienceDataContextValue | null>(null);

export function AudienceDataProvider({ children }: { children: React.ReactNode }) {
  const apiBase = getApiBaseUrl();
  const { has } = useSubscription();
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const skipNextRemotePersist = useRef(true);

  useEffect(() => {
    const sync = () => setTenantId(getTenantIdClient());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const [clients, setClients] = useState<CustomerProfile[]>(() => {
    if (typeof window !== 'undefined' && getApiBaseUrl()) return [];
    return loadInitial();
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportInfo, setLastImportInfo] = useState<string | null>(null);
  const [hydratedFromApi, setHydratedFromApi] = useState(() => !getApiBaseUrl());

  useEffect(() => {
    if (!apiBase) {
      setHydratedFromApi(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetchJson<CustomerProfile[]>(
        `${apiBase}/v1/tenant/${tenantId}/customers`,
        { headers: tenantFetchHeaders(), retries: 2, silent: true }
      );
      if (cancelled) return;
      if (res.ok && Array.isArray(res.data)) {
        skipNextRemotePersist.current = true;
        setClients(
          res.data.length > 0
            ? res.data.map((c) => enrichCustomer(c))
            : mockUniversalAudience.map((c) => enrichCustomer(c))
        );
      } else {
        skipNextRemotePersist.current = true;
        setClients(loadInitial());
      }
      if (!cancelled) setHydratedFromApi(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, tenantId]);

  useEffect(() => {
    if (!hydratedFromApi) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch {
      /* quota */
    }
  }, [clients, hydratedFromApi]);

  useEffect(() => {
    if (!apiBase || !hydratedFromApi) return;
    if (skipNextRemotePersist.current) {
      skipNextRemotePersist.current = false;
      return;
    }
    const t = setTimeout(() => {
      void apiFetchJson(`${apiBase}/v1/tenant/${tenantId}/customers`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify(clients),
        retries: 1,
      });
    }, 700);
    return () => clearTimeout(t);
  }, [clients, apiBase, tenantId, hydratedFromApi]);

  const replaceAll = useCallback((next: CustomerProfile[]) => {
    setClients(next.map((c) => enrichCustomer(c)));
    setImportError(null);
  }, []);

  const mergeImported = useCallback((imported: CustomerProfile[]) => {
    setClients((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      imported.forEach((row) => {
        if (!ids.has(row.id)) {
          merged.push(enrichCustomer(row));
          ids.add(row.id);
        }
      });
      return merged;
    });
  }, []);

  const resetToDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const next = mockUniversalAudience.map((c) => enrichCustomer(c));
    skipNextRemotePersist.current = true;
    setClients(next);
    setLastImportInfo(null);
    setImportError(null);
    const base = getApiBaseUrl();
    if (base) {
      void apiFetchJson(`${base}/v1/tenant/${tenantId}/customers`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify(next),
        retries: 1,
      });
    }
  }, [tenantId]);

  const downloadTemplate = useCallback(() => {
    buildExcelTemplate();
  }, []);

  const importExcelFile = useCallback(async (file: File) => {
    setImportError(null);
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setImportError('Нужен файл Excel (.xlsx или .xls)');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const imported = parseExcelCustomers(buf);
      if (imported.length === 0) {
        setImportError('В файле нет строк с данными. Проверьте первый лист.');
        return;
      }

      if (apiBase) {
        if (!has('excelImport')) {
          const msg =
            'Импорт Excel недоступен на текущем тарифе. Откройте «Мой тариф» и выберите Starter или выше.';
          setImportError(msg);
          pushToast(msg, 'error');
          return;
        }
        const res = await apiFetchJson<CustomerProfile[]>(
          `${apiBase}/v1/tenant/${tenantId}/customers/merge`,
          {
            method: 'POST',
            headers: jsonTenantHeaders(),
            body: JSON.stringify({ customers: imported }),
            retries: 1,
          }
        );
        if (!res.ok) {
          setImportError(res.error);
          return;
        }
        skipNextRemotePersist.current = true;
        setClients(res.data.map((c) => enrichCustomer(c)));
        setLastImportInfo(`Добавлено из «${file.name}» (сервер объединил базу)`);
        pushToast(`Импорт: +${imported.length} контактов`, 'success');
        return;
      }

      mergeImported(imported);
      setLastImportInfo(`Добавлено ${imported.length} контактов из «${file.name}»`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    }
  }, [apiBase, tenantId, has, mergeImported]);

  const value = useMemo(
    () => ({
      clients,
      setClients,
      replaceAll,
      mergeImported,
      resetToDemo,
      downloadTemplate,
      importError,
      importExcelFile,
      lastImportInfo,
    }),
    [
      clients,
      replaceAll,
      mergeImported,
      resetToDemo,
      downloadTemplate,
      importError,
      importExcelFile,
      lastImportInfo,
    ]
  );

  return (
    <AudienceDataContext.Provider value={value}>{children}</AudienceDataContext.Provider>
  );
}

export function useAudienceData(): AudienceDataContextValue {
  const ctx = useContext(AudienceDataContext);
  if (!ctx) {
    throw new Error('useAudienceData must be used within AudienceDataProvider');
  }
  return ctx;
}
