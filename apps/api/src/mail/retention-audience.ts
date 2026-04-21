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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Текст письма в духе сценария «Реактивация / удержание» из автоматизаций. */
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
  const brand = String((w.brain as { brandVoicePrompt?: string }).brandVoicePrompt ?? '').trim();
  const subject = title;
  const text = [
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
  const html = `<p>Здравствуйте!</p><p>${escapeHtml(desc)}</p>${
    brand ? `<p><small>${escapeHtml(brand)}</small></p>` : ''
  }<p>С уважением, команда</p>`;
  return { subject, text, html };
}
