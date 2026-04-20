'use client';

import React from 'react';
import { CreditCard, Zap, CheckCircle2, Shield, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Billing() {
  return (
    <div className="flex-1 overflow-y-auto px-10 py-10 space-y-8 custom-scrollbar fade-in">
      
      <div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">Мой тариф</h1>
        <p className="text-[#a1a1aa] mt-2">Управление вашим тарифом и историей платежей.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Active Plan */}
        <div className="xl:col-span-2 space-y-6">
          <div className="crm-panel p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Zap className="w-40 h-40 text-purple-500" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-xs font-bold uppercase tracking-wider">Бизнес Плюс</span>
                <span className="text-sm text-[#71717a]">Активен до 12 декабря</span>
              </div>
              
              <div className="text-5xl font-bold text-white mb-2">
                ₽ 14,900 <span className="text-xl text-[#71717a] font-normal">/ мес</span>
              </div>
              
              <div className="mt-8 space-y-4 max-w-md">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#d4d4d8]">Отправлено сообщений (лимит)</span>
                  <span className="font-mono text-purple-400">4,200 / 10,000</span>
                </div>
                <div className="w-full bg-[#1f1f22] rounded-full h-2 overflow-hidden">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: '42%' }}></div>
                </div>
                
                <div className="flex justify-between items-center text-sm pt-4">
                  <span className="text-[#d4d4d8]">Размер базы клиентов</span>
                  <span className="font-mono text-blue-400">8,200 / 15,000</span>
                </div>
                <div className="w-full bg-[#1f1f22] rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '55%' }}></div>
                </div>
              </div>
              
              <div className="mt-10 flex gap-4">
                <button className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-[#d4d4d8] transition-colors">
                  Повысить тариф
                </button>
                <button className="px-6 py-2.5 bg-transparent border border-[#1f1f22] text-[#d4d4d8] font-medium rounded-lg text-sm hover:bg-[#121214] transition-colors">
                  Скачать чеки
                </button>
              </div>
            </div>
          </div>
          
          <div className="pt-8">
             <h3 className="text-md font-medium text-white mb-4">История платежей</h3>
             <table className="w-full text-left text-sm text-[#d4d4d8]">
              <thead className="border-b border-[#1f1f22] text-[11px] text-[#a1a1aa] uppercase tracking-wider">
                <tr>
                  <th className="py-3 font-normal">Дата</th>
                  <th className="py-3 font-normal">Документ</th>
                  <th className="py-3 font-normal">Сумма</th>
                  <th className="py-3 font-normal">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f22] text-xs">
                <tr>
                  <td className="py-4">12 Октября</td>
                  <td className="py-4 text-blue-400 underline cursor-pointer">Счет-фактура #4102</td>
                  <td className="py-4">₽ 14,900</td>
                  <td className="py-4"><span className="text-[#10b981] flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Оплачено</span></td>
                </tr>
                <tr>
                  <td className="py-4">12 Сентября</td>
                  <td className="py-4 text-blue-400 underline cursor-pointer">Счет-фактура #3991</td>
                  <td className="py-4">₽ 14,900</td>
                  <td className="py-4"><span className="text-[#10b981] flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Оплачено</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Change Plan */}
        <div>
          <div className="crm-card border-[#3b82f6]/30 bg-[#121214] p-6 relative">
            <h3 className="text-lg font-semibold text-white mb-2">Безлимитный вариант</h3>
            <p className="text-xs text-[#a1a1aa] mb-6">Мы можем установить ИИ-маркетолога на ваши собственные сервера (On-Premise) для максимальной безопасности вашей базы.</p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3 text-sm text-[#d4d4d8]">
                <Shield className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <span>Физически изолированный сервер</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#d4d4d8]">
                <Zap className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <span>Мгновенная работа без ограничений</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#d4d4d8]">
                <CheckCircle2 className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <span>Безлимитные сообщения</span>
              </li>
            </ul>

            <button className="w-full flex items-center justify-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-3 rounded-lg transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              Узнать подробности <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
