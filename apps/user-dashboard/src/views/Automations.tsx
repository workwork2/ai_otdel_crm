'use client';

import React, { useState } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Sparkles,
  MessageCircle,
  Layers,
  Calendar,
  RefreshCcw,
  ShoppingCart,
  Package,
  Star,
  Bell,
  UserPlus,
  Clock,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Rule = {
  icon: React.ReactNode;
  name: string;
  desc: string;
  status: 'active' | 'paused';
  tag?: string;
};

const RULES: Rule[] = [
  {
    icon: <RefreshCcw className="w-6 h-6 text-[#3b82f6]" />,
    name: 'Реактивация: вернуть ушедших',
    desc: 'ИИ замечает, если клиент пропал дольше обычного, и пишет ненавязчивое сообщение с поводом вернуться.',
    status: 'active',
    tag: 'Retention',
  },
  {
    icon: <MessageCircle className="w-6 h-6 text-[#10b981]" />,
    name: 'NPS и отзывы',
    desc: 'Через несколько часов после покупки ИИ спрашивает об удовлетворённости и собирает оценки.',
    status: 'active',
    tag: 'Voice of customer',
  },
  {
    icon: <Layers className="w-6 h-6 text-[#f59e0b]" />,
    name: 'Сгорание бонусов / кэшбека',
    desc: 'Напоминание, если баллы скоро сгорят, с подборкой товаров из каталога.',
    status: 'active',
    tag: 'Loyalty',
  },
  {
    icon: <Calendar className="w-6 h-6 text-[#8b5cf6]" />,
    name: 'День рождения',
    desc: 'Поздравление в день рождения с персональным подарком или промокодом.',
    status: 'paused',
    tag: 'CRM-триггер',
  },
  {
    icon: <ShoppingCart className="w-6 h-6 text-[#ec4899]" />,
    name: 'Брошенная корзина',
    desc: 'Через 2–4 часа после добавления товаров — мягкое напоминание с ссылкой на корзину.',
    status: 'active',
    tag: 'E-com',
  },
  {
    icon: <Package className="w-6 h-6 text-[#06b6d4]" />,
    name: 'Пост-продажа и допродажа',
    desc: 'После выдачи заказа — кросс-селл аксессуаров и расходников к купленному.',
    status: 'active',
    tag: 'Up-sell',
  },
  {
    icon: <Star className="w-6 h-6 text-[#eab308]" />,
    name: 'Программа лояльности',
    desc: 'Автоматическое повышение уровня, напоминание о привилегиях и дедлайнах статуса.',
    status: 'active',
    tag: 'Tier',
  },
  {
    icon: <Bell className="w-6 h-6 text-[#f97316]" />,
    name: 'Возврат к сезонному спросу',
    desc: 'Триггер по категории и календарю: «сезон начался» — персональный оффер.',
    status: 'paused',
    tag: 'Кампания',
  },
  {
    icon: <UserPlus className="w-6 h-6 text-[#22c55e]" />,
    name: 'Онбординг нового клиента',
    desc: 'Цепочка из 3 сообщений: как пользоваться бонусами, доставкой и поддержкой.',
    status: 'active',
    tag: 'Welcome',
  },
  {
    icon: <Clock className="w-6 h-6 text-[#a855f7]" />,
    name: 'Напоминание о записи / визите',
    desc: 'За 24 ч и за 2 ч до слота — подтверждение и возможность переноса в один тап.',
    status: 'active',
    tag: 'Сервис',
  },
  {
    icon: <Target className="w-6 h-6 text-[#14b8a6]" />,
    name: 'Win-back после отписки',
    desc: 'Если клиент отключил рассылку — одно нейтральное письмо с опросом причины и бонусом за возврат.',
    status: 'paused',
    tag: 'Churn',
  },
];

export function Automations() {
  const activeCount = RULES.filter((r) => r.status === 'active').length;

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-10 py-10 space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-[#3b82f6]" />
            Автоматизация и сценарии
          </h1>
          <p className="text-[#a1a1aa] mt-2 text-[15px] max-w-2xl">
            Включайте сценарии в один клик: ИИ подбирает аудиторию, время и формулировки. Ниже — готовые
            узлы для e-commerce, сервиса и B2B.
          </p>
        </div>
        <div className="text-xs font-mono text-[#71717a] border border-[#1f1f22] rounded-lg px-3 py-2 bg-[#121214]">
          Активных сценариев:{' '}
          <span className="text-[#10b981] font-semibold">{activeCount}</span> / {RULES.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-2">
        {RULES.map((rule) => {
          const { icon, name, desc, status, tag } = rule;
          return (
            <div key={name} className="contents">
              <RuleCard icon={icon} name={name} desc={desc} status={status} tag={tag} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RuleCard({
  name,
  desc,
  status,
  icon,
  tag,
}: {
  name: string;
  desc: string;
  status: 'active' | 'paused';
  icon: React.ReactNode;
  tag?: string;
}) {
  const [isActive, setIsActive] = useState(status === 'active');

  return (
    <div
      className={cn(
        'crm-card p-6 border-l-4 transition-all duration-300 flex flex-col min-h-[200px]',
        isActive
          ? 'border-l-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.05)]'
          : 'border-l-[#1f1f22]'
      )}
    >
      <div className="flex justify-between items-start mb-4 gap-2">
        <div className="w-12 h-12 rounded-xl bg-[#121214] border border-[#1f1f22] flex items-center justify-center shrink-0">
          {icon}
        </div>

        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className="text-[#71717a] hover:text-white transition-colors shrink-0"
          aria-pressed={isActive}
        >
          {isActive ? (
            <ToggleRight className="w-8 h-8 text-[#3b82f6]" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-[#71717a]" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-[16px] font-semibold text-white leading-snug">{name}</h3>
        {tag && (
          <span className="text-[10px] uppercase tracking-wider text-[#71717a] border border-[#27272a] px-1.5 py-0.5 rounded">
            {tag}
          </span>
        )}
      </div>
      <p className="text-sm text-[#a1a1aa] leading-relaxed mb-5 flex-1">{desc}</p>

      <div className="flex items-center gap-2 mt-auto">
        {isActive ? (
          <span className="px-2 py-1 rounded bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-bold uppercase tracking-wider">
            Включено
          </span>
        ) : (
          <span className="px-2 py-1 rounded bg-[#1f1f22] text-[#a1a1aa] text-xs font-bold uppercase tracking-wider">
            Выключено
          </span>
        )}
      </div>
    </div>
  );
}
