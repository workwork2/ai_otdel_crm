import type { DiscountRule, PromotionItem } from '@/types';

/** Поля из «Настройки ИИ», влияющие на рассылку */
export type OutreachBrainInput = {
  tone?: number;
  useEmoji?: boolean;
  maxDiscountPercent?: number;
  spamCadence?: 'week' | '14d' | 'month';
  brandVoicePrompt?: string;
  promotions?: PromotionItem[];
  discounts?: DiscountRule[];
};

export type AutoRowLite = {
  name: string;
  desc: string;
  tag?: string;
};

export const SPAM_CADENCE_LABEL: Record<string, string> = {
  week: 'не чаще одного массового касания в неделю',
  '14d': 'примерно раз в две недели',
  month: 'примерно раз в месяц',
};

function isPromoOn(p: PromotionItem): boolean {
  return p.active !== false;
}

function isDiscountOn(d: DiscountRule): boolean {
  return d.active !== false;
}

/** Текст письма — та же логика, что на сервере в buildRetentionEmailContent (без HTML). */
export function buildOutreachLetterDraft(
  brain: OutreachBrainInput,
  automations: AutoRowLite[]
): { subject: string; body: string } {
  const auto =
    automations.find((a) => a.tag === 'Retention' || /реактивац/i.test(a.name)) ??
    automations.find((a) => /ушедш/i.test(a.name));
  const title = auto?.name ?? 'Мы помним вас';
  const desc =
    auto?.desc ??
    'Персональное предложение, чтобы снова воспользоваться сервисом. Ответьте на это письмо, если нужна помощь.';
  const brand = String(brain.brandVoicePrompt ?? '').trim();

  let body = [
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

  const promos = (brain.promotions ?? []).filter(isPromoOn);
  const discs = (brain.discounts ?? []).filter(isDiscountOn);
  const maxPct =
    typeof brain.maxDiscountPercent === 'number' ? brain.maxDiscountPercent : null;

  if (promos.length > 0) {
    body +=
      '\n\nАктуальные предложения:\n' +
      promos
        .map((p) => {
          const t = String(p.title ?? 'Акция').trim();
          const b = String(p.body ?? '').trim();
          const u = p.validUntil ? ` (до ${String(p.validUntil).trim()})` : '';
          return `• ${t}${b ? `: ${b}` : ''}${u}`;
        })
        .join('\n');
  }

  if (discs.length > 0) {
    body +=
      '\n\nПромокоды и бонусы:\n' +
      discs
        .map((d) => {
          const code = String(d.code ?? '').trim();
          const pct = typeof d.percent === 'number' ? d.percent : 0;
          const description = String(d.description ?? '').trim();
          return `• ${code || 'код'} — ${pct}%${description ? ` — ${description}` : ''}`;
        })
        .join('\n');
  } else if (maxPct != null && maxPct > 0) {
    body += `\n\nПо правилам бренда персональная скидка может достигать ${maxPct}% — уточните у менеджера ответом на письмо.`;
  }

  return { subject: title, body };
}

export type WorkflowStep = {
  id: string;
  title: string;
  lines: string[];
  ok: boolean;
};

export function buildWorkflowSteps(input: {
  clientsCount: number;
  /** Лимит контактов в одном запуске */
  launchLimit: number;
  /** Сколько контактов отобрали под ИИ (удержание → дозаполнение) */
  aiRecipientCount: number;
  brain: OutreachBrainInput;
  mailReady: boolean;
  /** Есть сгенерированный план со слотами */
  hasCampaignDraft: boolean;
  campaignStatus: 'draft' | 'running' | 'paused' | 'completed' | null;
  /** Число успешно отправленных слотов */
  slotsSent: number;
  slotsTotal: number;
  slotsPending: number;
  /**
   * Локальное превью: шаги 1–3 считаются выполненными, чтобы после перезагрузки сразу можно было
   * нажать «Сгенерировать план» без ожидания метаданных и без обязательных акций в черновике.
   */
  previewShortcuts?: boolean;
}): WorkflowStep[] {
  const cadenceKey = input.brain.spamCadence ?? 'week';
  const cadence = SPAM_CADENCE_LABEL[cadenceKey] ?? SPAM_CADENCE_LABEL.week;
  const tone = typeof input.brain.tone === 'number' ? input.brain.tone : 50;
  const emoji = input.brain.useEmoji !== false ? 'да' : 'нет';
  const maxD = typeof input.brain.maxDiscountPercent === 'number' ? input.brain.maxDiscountPercent : 15;
  const promosN = (input.brain.promotions ?? []).filter(isPromoOn).length;
  const discN = (input.brain.discounts ?? []).filter(isDiscountOn).length;
  const offersFilled = promosN + discN > 0;
  const shortcut = input.previewShortcuts === true;

  return [
    {
      id: 'settings-ai',
      title: 'Шаг 1. Настройки ИИ: бонусы, акции, ритм',
      lines: [
        'Откройте раздел «Настройки ИИ» и задайте вручную: акции, промокоды и лимит скидки, голос бренда, тон и частоту касаний.',
        `Политика частоты в настройках: ${cadence}. Тон: ${tone}/100; эмодзи: ${emoji}; макс. скидка по правилам: ${maxD}%.`,
        offersFilled
          ? `В настройках учтено: активных акций ${promosN}, промокодов ${discN}. Они попадут в итоговое письмо при отправке (к персональному тексту от ИИ).`
          : shortcut
            ? 'Превью: для интерфейса подставлены демо-акция и промокод; в проде заполните блок в «Настройки ИИ».'
            : 'Рекомендуем добавить хотя бы одну активную акцию или промокод — иначе ИИ опирается только на сценарий и голос бренда.',
      ],
      ok: offersFilled || shortcut,
    },
    {
      id: 'integrations',
      title: 'Шаг 2. Интеграции: канал Email и SMTP',
      lines: input.mailReady
        ? ['Канал «Email» подключён, SMTP настроен — можно планировать отправку.']
        : shortcut
          ? [
              'Превью: канал считается готовым только для макета; реальная отправка — после SMTP в «Интеграции».',
            ]
          : [
              'Подключите интеграцию «Email» и укажите SMTP (раздел «Интеграции»).',
              'Там же выполняются проверка и тест без массовой рассылки.',
            ],
      ok: input.mailReady || shortcut,
    },
    {
      id: 'audience',
      title: 'Шаг 3. Аудитория (ИИ и скоринг)',
      lines: [
        `В CRM ${input.clientsCount} контактов. Сегменты вручную не настраиваются: сначала отбираются контакты удержания (риск, «сонные», at-risk), затем дозаполнение до лимита из базы с маркетинговым согласием.`,
        `Лимит запуска (по тарифу, до генерации): до ${input.launchLimit}. Сейчас в выборке ${input.aiRecipientCount} адресов — после «Сгенерировать план» покажем фактический размер матрицы.`,
      ],
      ok: shortcut || (input.clientsCount > 0 && input.aiRecipientCount > 0),
    },
    {
      id: 'generate',
      title: 'Шаг 4. Сгенерировать план рассылки',
      lines: [
        'В блоке «План и рассылка» нажмите «Сгенерировать план»: ИИ составит стратегию и письмо под каждого из автоматической выборки.',
        'Входной текст для персонализации подтягивается сам из «Настройки ИИ», сценариев и CRM — отдельно вводить письмо не нужно.',
      ],
      ok: input.hasCampaignDraft,
    },
    {
      id: 'review-matrix',
      title: 'Шаг 5. Матрица рассылки: сроки, лимиты, расписание',
      lines: input.hasCampaignDraft
        ? [
            'Проверьте «Параметры плана рассылки»: окно времени, оценка писем в сутки, лимит сообщений тарифа.',
            'Правки по контакту — клик по строке в таблице; затем «Сохранить план на сервере» до запуска.',
          ]
        : [
            'После шага 4 появится сводка: куда и в каком окне уходят письма, с учётом лимитов.',
          ],
      ok: input.hasCampaignDraft && input.mailReady,
    },
    {
      id: 'launch-track',
      title: 'Шаг 6. Запустить рассылку и отслеживать по контактам',
      lines: [
        'Нажмите «Запустить по расписанию». В таблице у каждого контакта будет галочка после успешной отправки; тему и текст, подготовленные для этого человека, откройте кликом по строке.',
        'Итоговые письма персональные: ИИ собирает их из настроек ИИ и полей CRM, а не из общего блока на странице.',
        'Ответы клиентов ведите в «Диалоги ИИ».',
      ],
      ok:
        input.campaignStatus === 'completed' ||
        (input.slotsTotal > 0 && input.slotsPending === 0 && input.campaignStatus !== 'draft'),
    },
  ];
}

export type OutreachScheduleSummary = {
  recipientCount: number;
  windowStart: Date;
  windowEnd: Date;
  spanDays: number;
  approxPerDay: number;
  cadenceLabel: string;
  messagesRemaining: number | null;
};

/** Сводка окна отправок и нагрузки для UI «матрицы рассылки». */
export function buildOutreachScheduleSummary(
  slots: Array<{ scheduledAt: string }>,
  brain: OutreachBrainInput,
  messagesQuota: { used: number; limit: number } | null
): OutreachScheduleSummary | null {
  if (!slots.length) return null;
  const times = slots
    .map((s) => new Date(s.scheduledAt).getTime())
    .filter((t) => !Number.isNaN(t));
  if (!times.length) return null;
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const windowStart = new Date(minT);
  const windowEnd = new Date(maxT);
  const spanMs = Math.max(60_000, maxT - minT);
  const spanDays = spanMs / (24 * 60 * 60 * 1000);
  const approxPerDay = slots.length / spanDays;
  const cadenceKey = brain.spamCadence ?? 'week';
  const cadenceLabel = SPAM_CADENCE_LABEL[cadenceKey] ?? SPAM_CADENCE_LABEL.week;
  const messagesRemaining =
    messagesQuota != null ? Math.max(0, messagesQuota.limit - messagesQuota.used) : null;
  return {
    recipientCount: slots.length,
    windowStart,
    windowEnd,
    spanDays,
    approxPerDay,
    cadenceLabel,
    messagesRemaining,
  };
}
