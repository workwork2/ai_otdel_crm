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
import { apiFetchJson } from '@/lib/api-client';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { enrichCustomer } from '@/lib/scoring';
import { parseExcelCustomersWithMeta, buildExcelTemplate } from '@/lib/excelImport';
import { useSubscription } from '@/context/SubscriptionContext';
import { pushToast } from '@/lib/toast';

type AudienceDataContextValue = {
  clients: CustomerProfile[];
  setClients: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
  replaceAll: (next: CustomerProfile[]) => void;
  mergeImported: (imported: CustomerProfile[]) => void;
  clearAudience: () => void;
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
    window.addEventListener('linearize-tenant-auth', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('linearize-tenant-auth', sync);
    };
  }, []);

  const [clients, setClients] = useState<CustomerProfile[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportInfo, setLastImportInfo] = useState<string | null>(null);
  const [hydratedFromApi, setHydratedFromApi] = useState(false);

  useEffect(() => {
    if (!apiBase || !tenantId.trim()) {
      setHydratedFromApi(true);
      setClients([]);
      return;
    }
    let cancelled = false;
    setHydratedFromApi(false);
    (async () => {
      const res = await apiFetchJson<CustomerProfile[]>(
        `${apiBase}/v1/tenant/${tenantId}/customers`,
        { headers: tenantFetchHeaders(), retries: 2, silent: true }
      );
      if (cancelled) return;
      if (res.ok && Array.isArray(res.data)) {
        skipNextRemotePersist.current = true;
        setClients(res.data.map((c) => enrichCustomer(c)));
      } else {
        skipNextRemotePersist.current = true;
        setClients([]);
      }
      if (!cancelled) setHydratedFromApi(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, tenantId]);

  useEffect(() => {
    if (!apiBase || !hydratedFromApi) return;
    if (!tenantId.trim()) return;
    if (skipNextRemotePersist.current) {
      skipNextRemotePersist.current = false;
      return;
    }
    const id = tenantId.trim();
    const t = setTimeout(() => {
      void apiFetchJson(`${apiBase}/v1/tenant/${id}/customers`, {
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

  const clearAudience = useCallback(() => {
    skipNextRemotePersist.current = true;
    setClients([]);
    setLastImportInfo(null);
    setImportError(null);
    const base = getApiBaseUrl();
    const id = getTenantIdClient().trim();
    if (base && id) {
      void apiFetchJson(`${base}/v1/tenant/${id}/customers`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify([]),
        retries: 1,
      });
    }
  }, []);

  const downloadTemplate = useCallback(() => {
    buildExcelTemplate();
  }, []);

  const importExcelFile = useCallback(async (file: File) => {
    setImportError(null);
    const tid = getTenantIdClient().trim();
    if (apiBase && !tid) {
      setImportError('Сначала войдите в кабинет — не указана организация.');
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setImportError('Нужен файл Excel (.xlsx или .xls)');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const { customers: imported, meta } = parseExcelCustomersWithMeta(buf);
      if (imported.length === 0) {
        setImportError(
          meta
            ? `На листе «${meta.sheetUsed}» нет строк с данными. Проверьте шапку и заполненность.`
            : 'В файле нет листов с данными.'
        );
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
          `${apiBase}/v1/tenant/${tid}/customers/merge`,
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
        const sheetHint = meta ? ` · лист «${meta.sheetUsed}»` : '';
        setLastImportInfo(
          `Файл «${file.name}»${sheetHint}: ${imported.length} строк → сервер объединил с базой`
        );
        pushToast(`Импорт: ${imported.length} контактов${sheetHint}`, 'success');
        return;
      }

      mergeImported(imported);
      const sheetHint = meta ? ` (лист «${meta.sheetUsed}»)` : '';
      setLastImportInfo(`Добавлено ${imported.length} контактов из «${file.name}»${sheetHint}`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    }
  }, [apiBase, has, mergeImported]);

  const value = useMemo(
    () => ({
      clients,
      setClients,
      replaceAll,
      mergeImported,
      clearAudience,
      downloadTemplate,
      importError,
      importExcelFile,
      lastImportInfo,
    }),
    [
      clients,
      replaceAll,
      mergeImported,
      clearAudience,
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
