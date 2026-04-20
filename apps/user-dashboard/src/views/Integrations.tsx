'use client';

import React from 'react';
import {
  Database,
  MessageSquare,
  Download,
  CheckCircle2,
  Share2,
  Phone,
  Mail,
} from 'lucide-react';

export function Integrations() {
  return (
    <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 sm:py-10 space-y-8 sm:space-y-10 fade-in">
      <div className="max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Подключение сервисов
        </h1>
        <p className="text-[#a1a1aa] mt-2 text-[15px] leading-relaxed">
          Свяжите AI Отдел с кассой, CRM, почтой и мессенджерами — в том числе с{' '}
          <strong className="text-zinc-300 font-medium">MAX</strong> (экосистема VK). Техническую часть
          берём на себя.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-[#10b981]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Учётные системы и CRM</h2>
            <p className="text-sm text-[#71717a]">Покупки, чеки, клиенты</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <IntegrationCard
            name="1С:Предприятие"
            desc="Синхронизация чеков, товаров и клиентов."
            status="connected"
            icon={<div className="font-bold text-lg text-yellow-500">1C</div>}
          />
          <IntegrationCard
            name="YCLIENTS"
            desc="Запись на услуги и визиты."
            status="available"
            icon={<div className="font-bold text-lg text-[#ec4899]">Y</div>}
          />
          <IntegrationCard
            name="RetailCRM"
            desc="Заказы из интернет-магазина."
            status="available"
            icon={<div className="font-bold text-lg text-green-400">R</div>}
          />
          <IntegrationCard
            name="iiko / r_keeper"
            desc="Рестораны и доставка."
            status="available"
            icon={<div className="font-bold text-lg text-orange-400">i</div>}
          />
        </div>
      </section>

      <section className="pt-6 border-t border-[#1f1f22]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Мессенджеры и SMS</h2>
            <p className="text-sm text-[#71717a]">Каналы исходящих касаний</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <IntegrationCard
            name="WhatsApp"
            desc="Официальный WhatsApp Business API."
            status="connected"
            icon={<MessageSquare className="w-7 h-7 text-green-500" />}
          />
          <IntegrationCard
            name="Telegram"
            desc="Бот и рассылки в Telegram."
            status="available"
            icon={<MessageSquare className="w-7 h-7 text-blue-400" />}
          />
          <IntegrationCard
            name="SMS"
            desc="Текстовые SMS через провайдера."
            status="available"
            icon={<Phone className="w-7 h-7 text-purple-400" />}
          />
        </div>
      </section>

      <section className="pt-6 border-t border-[#1f1f22]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-[#a78bfa]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Почта и MAX</h2>
            <p className="text-sm text-[#71717a]">
              Транзакционные письма и чаты в экосистеме VK — привязка кабинета и токенов
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <IntegrationCard
            name="Корпоративная почта"
            desc="SMTP / API: триггерные письма, счета, напоминания о брошенной корзине. Привязка домена и SPF/DKIM."
            status="available"
            icon={<Mail className="w-7 h-7 text-sky-400" />}
          />
          <IntegrationCard
            name="MAX (VK)"
            desc="Канал MAX для диалогов и уведомлений в экосистеме VK. OAuth-привязка бизнес-кабинета, единая очередь с остальными каналами."
            status="available"
            icon={
              <div className="w-12 h-12 rounded-xl bg-[#0077FF]/15 border border-[#0077FF]/30 flex items-center justify-center font-bold text-[#0077FF] text-sm">
                M
              </div>
            }
          />
        </div>
      </section>
    </div>
  );
}

function IntegrationCard({
  name,
  desc,
  status,
  icon,
}: {
  name: string;
  desc: string;
  status: 'connected' | 'available';
  icon: React.ReactNode;
}) {
  const isConnected = status === 'connected';

  return (
    <div className="crm-card p-5 group hover:border-[#3f3f46] transition-colors h-full flex flex-col">
      <div className="flex justify-between items-start mb-4 gap-2">
        <div className="w-12 h-12 rounded-xl bg-[#121214] border border-[#1f1f22] flex items-center justify-center shrink-0">
          {icon}
        </div>
        {isConnected ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-md shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Подключено
          </div>
        ) : (
          <div className="text-xs font-semibold text-[#71717a] bg-[#1f1f22] px-2.5 py-1 rounded-md shrink-0">
            Доступно
          </div>
        )}
      </div>

      <h3 className="text-[15px] font-semibold text-white mb-1.5">{name}</h3>
      <p className="text-[13px] text-[#a1a1aa] leading-relaxed mb-6 flex-1">{desc}</p>

      {isConnected ? (
        <button
          type="button"
          className="w-full py-2.5 rounded-lg text-sm font-medium border border-[#27272a] text-[#d4d4d8] hover:bg-[#1f1f22] transition-colors mt-auto"
        >
          Настроить
        </button>
      ) : (
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors mt-auto"
        >
          <Download className="w-4 h-4" />
          Подключить
        </button>
      )}
    </div>
  );
}
