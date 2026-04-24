import type { JsonRecord, TenantWorkspace } from '../store/store.types';

export type RetentionTarget = 'retention' | 'marketing';

export function isValidCampaignEmail(email: string): boolean {
  const t = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  if (t.includes('*')) return false;
  return true;
}

/** Когорта удержания: зона риска / наблюдение / спящие. `marketing` — все с согласием на рассылку. */
export function filterCustomersForEmailCampaign(
  customers: JsonRecord[],
  target: RetentionTarget
): Array<{ id: string; email: string; name: string }> {
  const out: Array<{ id: string; email: string; name: string }> = [];
  for (const c of customers) {
    const consent = c.consent as { marketing?: boolean } | undefined;
    if (!consent?.marketing) continue;
    const email = String((c as { email?: string }).email ?? '').trim();
    if (!isValidCampaignEmail(email)) continue;
    const id = String((c as { id?: string }).id ?? '');
    const name = String((c as { name?: string }).name ?? 'Клиент');

    if (target === 'marketing') {
      out.push({ id, email, name });
      continue;
    }

    const scoring = c.scoring as { churnSegment?: string; lifecycle?: string } | undefined;
    if (!scoring) continue;
    const { churnSegment: seg, lifecycle: life } = scoring;
    if (
      seg === 'risk_zone' ||
      seg === 'watch' ||
      life === 'dormant' ||
      life === 'at_risk'
    ) {
      out.push({ id, email, name });
    }
  }
  return out;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML для письма из произвольного текста (абзацы через двойной перенос строки). */
export function plainTextToRetentionHtml(text: string): string {
  const t = text.trim();
  if (!t) return '<p></p>';
  return t
    .split(/\n\n+/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

type BrainOffers = {
  brandVoicePrompt?: string;
  promotions?: Array<{ title?: string; body?: string; active?: boolean; validUntil?: string }>;
  discounts?: Array<{ code?: string; percent?: number; description?: string; active?: boolean }>;
  maxDiscountPercent?: number;
};

export function appendBrainOffersToMail(
  brain: BrainOffers,
  baseText: string,
  baseHtml: string
): { text: string; html: string } {
  const promos = (brain.promotions ?? []).filter((p) => p && p.active !== false);
  const discs = (brain.discounts ?? []).filter((d) => d && d.active !== false);
  const maxPct = typeof brain.maxDiscountPercent === 'number' ? brain.maxDiscountPercent : null;

  let extraText = '';
  let extraHtml = '';

  if (promos.length > 0) {
    extraText +=
      '\n\nАктуальные предложения:\n' +
      promos
        .map((p) => {
          const t = String(p.title ?? 'Акция').trim();
          const b = String(p.body ?? '').trim();
          const u = p.validUntil ? ` (до ${String(p.validUntil).trim()})` : '';
          return `• ${t}${b ? `: ${b}` : ''}${u}`;
        })
        .join('\n');
    extraHtml +=
      '<p><strong>Актуальные предложения</strong></p><ul>' +
      promos
        .map((p) => {
          const t = escapeHtml(String(p.title ?? 'Акция').trim());
          const b = escapeHtml(String(p.body ?? '').trim());
          const u = p.validUntil ? ` <small>${escapeHtml(String(p.validUntil).trim())}</small>` : '';
          return `<li>${t}${b ? `: ${b}` : ''}${u}</li>`;
        })
        .join('') +
      '</ul>';
  }

  if (discs.length > 0) {
    extraText +=
      '\n\nПромокоды и бонусы:\n' +
      discs
        .map((d) => {
          const code = String(d.code ?? '').trim();
          const pct = typeof d.percent === 'number' ? d.percent : 0;
          const desc = String(d.description ?? '').trim();
          return `• ${code || 'код'} — ${pct}%${desc ? ` — ${desc}` : ''}`;
        })
        .join('\n');
    extraHtml +=
      '<p><strong>Промокоды и бонусы</strong></p><ul>' +
      discs
        .map((d) => {
          const code = escapeHtml(String(d.code ?? '').trim() || 'код');
          const pct = typeof d.percent === 'number' ? d.percent : 0;
          const desc = escapeHtml(String(d.description ?? '').trim());
          return `<li>${code} — ${pct}%${desc ? ` — ${desc}` : ''}</li>`;
        })
        .join('') +
      '</ul>';
  } else if (maxPct != null && maxPct > 0) {
    extraText += `\n\nПо правилам бренда персональная скидка может достигать ${maxPct}% — уточните у менеджера ответом на письмо.`;
    extraHtml += `<p><small>По правилам бренда персональная скидка может достигать ${escapeHtml(String(maxPct))}% — уточните у менеджера ответом на письмо.</small></p>`;
  }

  return {
    text: baseText + extraText,
    html: baseHtml + extraHtml,
  };
}

/** Текст письма: сценарий «Реактивация», голос бренда, акции и промокоды из `brain` (как в «Настройки ИИ»). */
export function buildRetentionEmailContent(w: TenantWorkspace): {
  subject: string;
  text: string;
  html: string;
} {
  const auto =
    w.automations.find((a) => a.tag === 'Retention' || /реактивац/i.test(a.name)) ??
    w.automations.find((a) => /ушедш/i.test(a.name));
  const title = auto?.name ?? 'Мы помним вас';
  const desc =
    auto?.desc ??
    'Персональное предложение, чтобы снова воспользоваться сервисом. Ответьте на это письмо, если нужна помощь.';
  const brain = w.brain as BrainOffers;
  const brand = String(brain.brandVoicePrompt ?? '').trim();
  const subject = title;
  const textCore = [
    'Здравствуйте!',
    '',
    desc,
    '',
    brand ? `— ${brand}` : '',
    '',
    'С уважением, команда',
  ]
    .filter(Boolean)
    .join('\n');
  const htmlCore = `<p>Здравствуйте!</p><p>${escapeHtml(desc)}</p>${
    brand ? `<p><small>${escapeHtml(brand)}</small></p>` : ''
  }<p>С уважением, команда</p>`;

  const { text, html } = appendBrainOffersToMail(brain, textCore, htmlCore);
  return { subject, text, html };
}
