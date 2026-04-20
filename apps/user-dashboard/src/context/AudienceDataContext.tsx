import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { CustomerProfile } from '@/types';
import { mockUniversalAudience } from '@/data';
import { enrichCustomer } from '@/lib/scoring';
import { parseExcelCustomers, buildExcelTemplate } from '@/lib/excelImport';

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
  const [clients, setClients] = useState<CustomerProfile[]>(() => loadInitial());
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportInfo, setLastImportInfo] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch {
      /* quota */
    }
  }, [clients]);

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
    setClients(mockUniversalAudience.map((c) => enrichCustomer(c)));
    setLastImportInfo(null);
    setImportError(null);
  }, []);

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
      mergeImported(imported);
      setLastImportInfo(`Добавлено ${imported.length} контактов из «${file.name}»`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    }
  }, [mergeImported]);

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
