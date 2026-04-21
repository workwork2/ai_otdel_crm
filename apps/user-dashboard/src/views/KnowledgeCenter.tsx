'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileSpreadsheet,
  MessageSquare,
  Shield,
  Sparkles,
  Plug,
  BarChart2,
  Lock,
  Headphones,
  Waypoints,
  CreditCard,
} from 'lucide-react';

export function KnowledgeCenter() {
  return (
    <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 sm:px-8 lg:px-10 py-8 sm:py-10 space-y-8 sm:space-y-10 fade-in pb-20">
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#71717a] font-semibold mb-2">
          <BookOpen className="w-4 h-4 text-[#8b5cf6]" />
          Центр знаний
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Как устроена платформа AI Отдела
        </h1>
        <p className="text-[#a1a1aa] mt-3 text-[15px] leading-relaxed max-w-prose">
          Единое место для правил скоринга, импорта базы, метрик EES, диалогов и интеграций. Здесь собрана
          логика, которая одинаково применима к магазину, сервисной компании или B2B.
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          <Link
            href="/clients"
            className="text-sm text-[#3b82f6] hover:text-[#60a5fa] font-medium"
          >
            ← Клиенты и импорт
          </Link>
          <Link href="/analytics" className="text-sm text-[#3b82f6] hover:text-[#60a5fa] font-medium">
            Отчёты EES →
          </Link>
          <Link href="/integrations" className="text-sm text-[#3b82f6] hover:text-[#60a5fa] font-medium">
            Интеграции →
          </Link>
        </div>
      </div>

      <section className="crm-card p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
            <Waypoints className="w-5 h-5 text-[#fbbf24]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Касания и термины</h2>
            <p className="text-xs text-[#71717a] mt-0.5">
              Шпаргалка для саппорта и админов CRM: как говорить с клиентом про метрики и воронку.
            </p>
          </div>
        </div>

        <dl className="space-y-4 text-sm text-[#d4d4d8] leading-relaxed">
          <div>
            <dt className="text-white font-medium">Касание</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              Один зафиксированный контакт с клиентом в выбранном канале: сообщение, письмо, звонок-робот,
              пуш и т.п. В одном <strong className="text-zinc-300 font-medium">диалоге</strong> может быть
              много касаний подряд — это разные события в журнале.
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Исходящее и входящее касание</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              <strong className="text-zinc-300 font-medium">Исходящее</strong> — платформа или менеджер
              написали первыми по сценарию или вручную. <strong className="text-zinc-300 font-medium">
                Входящее
              </strong>{' '}
              — клиент обратился сам (ответ на рассылку тоже часто считается входящим ответом на касание).
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Канал</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              Техническая среда доставки: WhatsApp, Telegram, email, SMS, MAX и др. Один и тот же сценарий
              может дублироваться в нескольких каналах — в отчётах их обычно смотрят раздельно или сводно.
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Сигнал (из CRM / кассы)</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              Событие о клиенте: покупка, давность визита, сумма чека, тег, смена этапа воронки. Сигналы
              попадают в раздел воронки «сигналы из CRM/кассы» и запускают{' '}
              <strong className="text-zinc-300 font-medium">сценарии</strong>.
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Сценарий и автоматизация</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              Правило вида «если сигнал → цепочка касаний с паузами». Автоматизация — то же по смыслу,
              иногда с ручным перехватом менеджером в «Диалогах ИИ».
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Оффер</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              Конкретное предложение внутри касания: текст, скидка, бонус, напоминание о записи. Один
              сценарий может сгенерировать несколько офферов на разных шагах.
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Прочтение и доставка</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              Касание <strong className="text-zinc-300 font-medium">доставлено</strong>, если дошло до
              канала; <strong className="text-zinc-300 font-medium">прочитано</strong> — клиент открыл
              сообщение (если канал отдаёт такой статус). В воронке это отдельные ступени.
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Диалог и целевое действие</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              <strong className="text-zinc-300 font-medium">Диалог</strong> — нить сообщений с клиентом.
              <strong className="text-zinc-300 font-medium"> Целевое действие</strong> — то, что считается
              успехом сценария: оплата, запись, повторная покупка. Его связывают с касаниями по окну
              атрибуции.
            </dd>
          </div>
          <div>
            <dt className="text-white font-medium">Атрибуция к ИИ и «органика»</dt>
            <dd className="mt-1 text-[#a1a1aa]">
              Если целевое действие произошло после касания ИИ в заданном окне и по правилам продукта,
              выручка попадает в <strong className="text-zinc-300 font-medium">сгенерированную выручку</strong>{' '}
              в отчётах EES. Остальные продажи в сравнении на графиках часто показываются как{' '}
              <strong className="text-zinc-300 font-medium">органика</strong> (без явной роли ИИ в цепочке).
            </dd>
          </div>
        </dl>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#eab308]/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#eab308]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Виды подписки и тарифы</h2>
            <p className="text-xs text-[#71717a] mt-0.5">
              Единая линейка для сайта и биллинга; детали также отдаются API{' '}
              <span className="font-mono text-[10px]">GET /v1/docs/subscriptions</span>.
            </p>
          </div>
        </div>
        <div className="space-y-4 text-sm text-[#d4d4d8] leading-relaxed">
          <div className="rounded-lg border border-[#27272a] bg-[#121214]/80 p-4">
            <h3 className="text-white font-medium">Trial</h3>
            <p className="text-[#a1a1aa] mt-1">
              Бесплатный пробный период (~14 дней): ограниченные сообщения и размер базы, базовые сценарии и
              импорт. Подходит для оценки качества диалогов без обязательств.
            </p>
          </div>
          <div className="rounded-lg border border-[#27272a] bg-[#121214]/80 p-4">
            <h3 className="text-white font-medium">Starter</h3>
            <p className="text-[#a1a1aa] mt-1">
              Старт для малого бизнеса: предсказуемый месячный платёж, ключевые каналы (WhatsApp, Telegram,
              SMS, email), интеграции уровня RetailCRM / Excel, очередь касаний EES.
            </p>
          </div>
          <div className="rounded-lg border border-[#27272a] bg-[#121214]/80 p-4">
            <h3 className="text-white font-medium">Pro</h3>
            <p className="text-[#a1a1aa] mt-1">
              Рост и несколько воронок: выше лимиты сообщений и контактов, канал MAX (VK), расширенный
              контроль качества диалогов и приоритет в поддержке.
            </p>
          </div>
          <div className="rounded-lg border border-[#27272a] bg-[#121214]/80 p-4">
            <h3 className="text-white font-medium">Business Plus («Бизнес Плюс»)</h3>
            <p className="text-[#a1a1aa] mt-1">
              Пакет как на экране «Мой тариф» в демо: удобные лимиты для одного юрлица, персональный инженер
              внедрения, быстрый апгрейд до Pro.
            </p>
          </div>
          <div className="rounded-lg border border-[#27272a] bg-[#121214]/80 p-4">
            <h3 className="text-white font-medium">Enterprise</h3>
            <p className="text-[#a1a1aa] mt-1">
              Индивидуальный договор: SSO, выделенные очереди, кастомные лимиты, опционально on-premise или
              выделенный контур данных. Цена и SLA по согласованию.
            </p>
          </div>
        </div>
        <Link
          href="/billing"
          className="inline-flex text-sm font-semibold text-[#3b82f6] hover:text-[#60a5fa]"
        >
          Перейти к «Мой тариф» →
        </Link>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
            <Plug className="w-5 h-5 text-[#818cf8]" />
          </div>
          <h2 className="text-lg font-medium text-white">Что такое AI Отдел</h2>
        </div>
        <p className="text-sm text-[#d4d4d8] leading-relaxed">
          Это панель, где ИИ ведёт касания по сценариям, а вы контролируете качество, лимиты скидок и базу
          клиентов. Данные могут приходить из CRM, кассы или Excel; отчёты показывают влияние на выручку и
          удержание. Термины вроде касания и атрибуции разобраны в блоке выше.
        </p>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-[#10b981]" />
          </div>
          <h2 className="text-lg font-medium text-white">Импорт Excel: любая таблица</h2>
        </div>
        <ul className="text-sm text-[#d4d4d8] space-y-3 list-disc pl-5 leading-relaxed">
          <li>
            Первая строка может быть <strong className="text-white font-medium">шапкой</strong> с любыми
            названиями колонок. Система ищет по смыслу: имя, телефон, email, сумма, дней без покупки, риск,
            уровень, тип (b2b/b2c) — русские и английские варианты.
          </li>
          <li>
            Без узнаваемой шапки строки читаются как <span className="font-mono text-xs">col_1, col_2…</span>
            ; телефон, почта и имя извлекаются эвристически.
          </li>
          <li>
            <strong className="text-white">LTV-статус и риск оттока не копируются из файла дословно.</strong>{' '}
            Колонки риска и комментарии — подсказки; итог пересчитывается правилами и{' '}
            <span className="font-mono text-[11px]">enrichCustomer</span>.
          </li>
        </ul>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#8b5cf6]" />
          </div>
          <h2 className="text-lg font-medium text-white">Скоринг и статус после импорта</h2>
        </div>
        <div className="text-sm text-[#d4d4d8] space-y-3 leading-relaxed">
          <p>
            Из строки собираются сигналы (дни без активности, сумма/CLV, уровень, текст риска), затем{' '}
            <strong className="text-white">deriveScoring</strong> строит:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[#a1a1aa]">
            <li>
              <span className="text-white">Риск оттока</span> — низкий / средний / высокий.
            </li>
            <li>
              <span className="text-white">LTV-статус</span> — основа, лояльный, VIP, высокий риск.
            </li>
            <li>
              <span className="text-white">Индекс риска и приоритет ИИ (0–100)</span>, сегмент оттока и
              жизненный цикл.
            </li>
          </ul>
        </div>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <h2 className="text-lg font-medium text-white">EES в отчётах</h2>
        </div>
        <p className="text-sm text-[#d4d4d8] leading-relaxed">
          <strong className="text-white">Сгенерированная выручка</strong> — покупки после{' '}
          <strong className="text-white">касаний ИИ</strong> за выбранный период (см. атрибуцию в блоке про
          касания). <strong className="text-white">Спасённые деньги</strong> — оценка маржи без лишних
          скидок. <strong className="text-white">Удержание</strong> — возврат из зоны риска. Период можно
          сузить фильтром на странице «Отчёты».
        </p>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <h2 className="text-lg font-medium text-white">Очередь и приоритет ИИ</h2>
        </div>
        <p className="text-sm text-[#d4d4d8] leading-relaxed">
          Приоритет растёт для ценных и «тревожных» клиентов; индекс риска показывает, кому чаще нужны
          сценарии удержания и контроль диалогов.
        </p>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#f59e0b]" />
          </div>
          <h2 className="text-lg font-medium text-white">Перехват чата</h2>
        </div>
        <ul className="text-sm text-[#d4d4d8] space-y-2 list-disc pl-5 leading-relaxed">
          <li>
            <strong className="text-white">«Перехватить диалог»</strong> — режим менеджера, ответы внизу
            экрана; в проде уйдут в API канала.
          </li>
          <li>
            При подключённом Nest API диалоги и настройки синхронизируются с сервером; иначе треды в
            localStorage до очистки.
          </li>
        </ul>
        <Link
          href="/qa"
          className="inline-flex items-center gap-2 mt-2 text-sm font-semibold text-[#3b82f6] hover:text-[#60a5fa]"
        >
          Открыть диалоги ИИ →
        </Link>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-700/40 flex items-center justify-center">
            <Lock className="w-5 h-5 text-zinc-400" />
          </div>
          <h2 className="text-lg font-medium text-white">Безопасность и данные</h2>
        </div>
        <p className="text-sm text-[#d4d4d8] leading-relaxed">
          Задайте <span className="font-mono text-[11px]">NEXT_PUBLIC_API_URL</span> — клиенты, QA, мозг ИИ и
          чат поддержки пишутся в Nest backend с файлом состояния. Без API данные остаются в браузере (демо).
        </p>
      </section>

      <section className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-[#0ea5e9]" />
          </div>
          <h2 className="text-lg font-medium text-white">Поддержка</h2>
        </div>
        <p className="text-sm text-[#d4d4d8] leading-relaxed">
          При внедрении в компанию мы помогаем сопоставить колонки Excel с полями CRM, настроить лимиты
          скидок и сценарии под ваш отраслевой регламент.
        </p>
      </section>
    </div>
  );
}
