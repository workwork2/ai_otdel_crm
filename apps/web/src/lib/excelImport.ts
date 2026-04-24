import * as XLSX from 'xlsx';
import type { CustomerProfile } from '@/types';
import { enrichCustomer } from './scoring';
import { loyaltyFromImportSignals, type ImportSignals } from './importSignals';

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

type ColRole =
  | 'name'
  | 'phone'
  | 'email'
  | 'type'
  | 'tier'
  | 'money'
  | 'days'
  | 'risk'
  | 'skip';

const ROLE_WEIGHTS: { role: ColRole; re: RegExp; w: number }[] = [
  { role: 'name', re: /^(?!.*@)(имя|name|клиент|фио|customer|company|орган|назван|контакт|fullname)/i, w: 10 },
  { role: 'name', re: /имя|name|клиент|фио|customer|company|орган|назван|контакт/i, w: 6 },
  { role: 'phone', re: /тел|phone|mobile|моб|cell|сотов/i, w: 10 },
  { role: 'email', re: /email|почта|e-mail|mail|электрон/i, w: 10 },
  { role: 'type', re: /тип|type|сегмент|segment|вид|b2b|b2c/i, w: 8 },
  { role: 'tier', re: /уровень|tier|лояльн|категор|segment|класс|статус\s*кли/i, w: 8 },
  { role: 'money', re: /сумма|выручка|clv|ltv|прогноз|чек|оборот|revenue|purchase|потра/i, w: 8 },
  { role: 'days', re: /дн(ей|я)?\s*без|давн|inactive|день|days|завис|просроч/i, w: 8 },
  { role: 'risk', re: /риск|churn|отток|угроз|скоринг|risk/i, w: 8 },
];

function classifyHeader(header: string): { role: ColRole; score: number } {
  const h = header.trim();
  if (!h) return { role: 'skip', score: 0 };
  let best: { role: ColRole; score: number } = { role: 'skip', score: 0 };
  for (const { role, re, w } of ROLE_WEIGHTS) {
    if (re.test(h)) {
      const score = w + (h.length < 24 ? 1 : 0);
      if (score > best.score) best = { role, score };
    }
  }
  return best;
}

/** Первая строка похожа на шапку: есть ключевые слова или нет «чистых» телефонов в большинстве ячеек */
function isProbablyHeaderRow(cells: string[]): boolean {
  const joined = cells.join(' ').toLowerCase();
  const keywordHits = ROLE_WEIGHTS.filter((x) => x.re.test(joined)).length;
  if (keywordHits >= 1) return true;
  const phoneLike = cells.filter((c) => c.replace(/\D/g, '').length >= 10).length;
  return phoneLike < cells.length / 2;
}

/** Превращает лист в массив объектов { [header]: value } даже без нормальной шапки */
function sheetToObjects(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false });
  if (!matrix.length) return [];

  const first = matrix[0].map((c) => String(c ?? '').trim());
  const width = Math.max(...matrix.map((r) => r.length));

  let headers: string[];
  let dataRows: unknown[][];

  if (isProbablyHeaderRow(first)) {
    headers = first.map((h, i) => h || `Колонка_${i + 1}`);
    dataRows = matrix.slice(1);
  } else {
    headers = Array.from({ length: width }, (_, i) => `col_${i + 1}`);
    dataRows = matrix;
  }

  return dataRows
    .filter((row) => row.some((c) => String(c ?? '').trim() !== ''))
    .map((row) => {
      const o: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        o[h] = row[i] ?? '';
      });
      return o;
    });
}

/** Назначает каждому заголовку роль (без дубликатов ролей — оставляем лучший по score) */
function buildRoleMap(headers: string[]): Map<ColRole, string> {
  const scored = headers.map((h) => {
    const c = classifyHeader(h);
    return { header: h, role: c.role, score: c.score };
  });
  const roleToHeader = new Map<ColRole, string>();
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  for (const { header, role, score } of byScore) {
    if (role === 'skip' || score === 0) continue;
    if (!roleToHeader.has(role)) roleToHeader.set(role, header);
  }
  return roleToHeader;
}

function pick(row: Record<string, unknown>, header: string | undefined): unknown {
  if (!header) return undefined;
  if (header in row) return row[header];
  return undefined;
}

function initials(name: string): string {
  const p = name.split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '??';
}

function extractLooseStrings(row: Record<string, unknown>): string[] {
  return Object.values(row)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
}

/** Достаёт телефон, email, имя из любых ячеек, если колонки не смапились */
function looseIdentity(row: Record<string, unknown>): {
  name: string;
  phone: string;
  email: string;
  extraText: string;
} {
  const parts = extractLooseStrings(row);
  let phone = '';
  let email = '';
  const rest: string[] = [];
  for (const p of parts) {
    const em = p.match(EMAIL_RE);
    if (em) {
      email = em[0];
      continue;
    }
    const compact = p.replace(/\D/g, '');
    if (compact.length >= 10 && compact.length <= 12) {
      phone = p;
      continue;
    }
    rest.push(p);
  }
  const nameCandidate = rest.sort((a, b) => b.length - a.length)[0] ?? '';
  const extraText = rest.join(' ');
  return {
    name: nameCandidate,
    phone: phone || '+7 000 000-00-00',
    email: email || 'import@example.local',
    extraText,
  };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 12);
}

function parseNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

/** Собирает ImportSignals из смапленных колонок и свободного текста */
function buildSignals(
  row: Record<string, unknown>,
  roleMap: Map<ColRole, string>,
  loose: { extraText: string }
): ImportSignals {
  const fromMoneyCol = parseNumber(pick(row, roleMap.get('money')));
  const looseNums = extractLooseStrings(row)
    .map((s) => parseNumber(s))
    .filter((n): n is number => n !== undefined && n > 500);
  const maxLoose = looseNums.length > 0 ? Math.max(...looseNums) : undefined;
  const money = fromMoneyCol ?? maxLoose;

  const daysRaw = parseNumber(pick(row, roleMap.get('days')));
  let daysIdle = daysRaw;
  if (daysIdle === undefined) {
    const small = extractLooseStrings(row)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n) && n >= 7 && n <= 500);
    if (small.length) daysIdle = small.sort((a, b) => b - a)[0];
  }

  const tierText = String(pick(row, roleMap.get('tier')) ?? '').trim();
  const riskText = [String(pick(row, roleMap.get('risk')) ?? '').trim(), loose.extraText]
    .filter(Boolean)
    .join(' · ');

  const typeCell = norm(pick(row, roleMap.get('type')));
  const isB2B =
    typeCell.includes('b2b') || typeCell.includes('юр') || typeCell.includes('ooo') || typeCell.includes('компан');

  return {
    daysIdle: daysIdle ?? 50,
    spendRub: money ?? 42000,
    tierText: tierText || undefined,
    riskText: riskText || undefined,
    isB2B,
  };
}

export type ExcelParseMeta = {
  sheetUsed: string;
  rowCount: number;
};

/**
 * Парсит Excel: выбирает лист с максимумом непустых строк, подстраивается под шапку.
 * Статус LTV и риск оттока — от алгоритма (importSignals + enrich).
 */
export function parseExcelCustomers(buffer: ArrayBuffer): CustomerProfile[] {
  const { customers } = parseExcelCustomersWithMeta(buffer);
  return customers;
}

/** То же + метаданные (имя листа, число строк) для обратной связи в UI. */
export function parseExcelCustomersWithMeta(buffer: ArrayBuffer): {
  customers: CustomerProfile[];
  meta: ExcelParseMeta | null;
} {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) return { customers: [], meta: null };

  let bestName = wb.SheetNames[0];
  let bestRows: Record<string, unknown>[] = [];
  for (const sn of wb.SheetNames) {
    const sheet = wb.Sheets[sn];
    const rows = sheetToObjects(sheet);
    if (rows.length > bestRows.length) {
      bestRows = rows;
      bestName = sn;
    }
  }

  const rows = bestRows;
  if (!rows.length) return { customers: [], meta: { sheetUsed: bestName, rowCount: 0 } };

  const headers = Object.keys(rows[0]);
  const roleMap = buildRoleMap(headers);

  const out: CustomerProfile[] = [];

  rows.forEach((row, i) => {
    const loose = looseIdentity(row);

    const nameFromCol = String(pick(row, roleMap.get('name')) ?? '').trim();
    const name = nameFromCol || loose.name || `Строка ${i + 1}`;

    const phoneFromCol = String(pick(row, roleMap.get('phone')) ?? '').trim();
    const emailFromCol = String(pick(row, roleMap.get('email')) ?? '').trim();

    const phone = phoneFromCol || loose.phone;
    const email = emailFromCol || loose.email;

    const signals = buildSignals(row, roleMap, loose);
    const { loyalty, ltvStatus, explain } = loyaltyFromImportSignals(signals);

    const type: CustomerProfile['type'] = signals.isB2B ? 'b2b' : 'b2c';

    const idCore = simpleHash(`${phone}|${email}|${name}|${i}`);
    const raw: CustomerProfile = {
      id: `IMP-${idCore}-${i}`,
      name,
      avatar: initials(name),
      phone,
      email,
      type,
      ltvStatus,
      consent: { marketing: true, whatsapp: true, telegram: false },
      loyalty,
      purchases: [],
      history: [
        {
          id: `imp-${i}`,
          date: new Date().toISOString().slice(0, 16).replace('T', ' '),
          type: 'system',
          sender: 'system',
          content: `[Импорт Excel] ${explain}`,
          status: 'processed',
        },
      ],
    };

    out.push(enrichCustomer({ ...raw, scoring: undefined }));
  });

  return {
    customers: out,
    meta: { sheetUsed: bestName, rowCount: out.length },
  };
}

export function buildExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Имя', 'Телефон', 'Email', 'Тип', 'Уровень', 'Сумма покупок', 'Дней без покупки', 'Комментарий / риск'],
    ['Иван Петров', '+79001234567', 'ivan@mail.ru', 'b2c', 'Серебро', 120000, 40, ''],
    ['ООО Ромашка', '+74951234567', 'zakaz@romashka.ru', 'b2b', 'VIP', 890000, 95, 'высокий отток'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Клиенты');
  XLSX.writeFile(wb, 'aura-clients-template.xlsx');
}
