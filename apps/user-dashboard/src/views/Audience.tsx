'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  ShieldCheck,
  MessageCircle,
  ShoppingBag,
  Info,
  ArrowUpRight,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudienceData } from '@/context/AudienceDataContext';
import { CustomerProfile, CommunicationEvent, ChurnSegment } from '@/types';
import { CHURN_LABEL, LIFECYCLE_LABEL } from '@/lib/scoring';

export function Audience() {
  const { clients, importExcelFile, downloadTemplate, resetToDemo, importError, lastImportInfo } =
    useAudienceData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedUser, setSelectedUser] = useState<CustomerProfile | null>(clients[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterLTV, setFilterLTV] = useState('all');
  const [filterConsent, setFilterConsent] = useState('all');
  const [filterChurn, setFilterChurn] = useState<'all' | ChurnSegment>('all');

  React.useEffect(() => {
    if (clients.length && !selectedUser) setSelectedUser(clients[0]);
    if (selectedUser && !clients.find((u) => u.id === selectedUser.id)) {
      setSelectedUser(clients[0] ?? null);
    }
  }, [clients, selectedUser]);

  const filteredAudience = clients.filter((user) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!user.name.toLowerCase().includes(q) && 
          !user.phone.includes(q) && 
          !user.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterType !== 'all' && user.type !== filterType) return false;
    if (filterLTV !== 'all') {
      // Handle the "Высокий риск" option which might be labeled differently in data vs select
      if (filterLTV === 'Высокий риск' && user.ltvStatus !== 'Высокий риск') return false;
      if (filterLTV !== 'Высокий риск' && user.ltvStatus !== filterLTV) return false;
    }
    if (filterConsent !== 'all') {
      if (filterConsent === 'marketing' && !user.consent.marketing) return false;
      if (filterConsent === 'whatsapp' && !user.consent.whatsapp) return false;
      if (filterConsent === 'telegram' && !user.consent.telegram) return false;
    }
    if (filterChurn !== 'all') {
      if (user.scoring?.churnSegment !== filterChurn) return false;
    }
    return true;
  });

  // Optional: Auto-select the first user in the filtered list if the currently selected user is filtered out
  React.useEffect(() => {
    if (selectedUser && !filteredAudience.find(u => u.id === selectedUser.id)) {
      setSelectedUser(filteredAudience.length > 0 ? filteredAudience[0] : null);
    } else if (!selectedUser && filteredAudience.length > 0) {
      setSelectedUser(filteredAudience[0]);
    }
  }, [searchQuery, filterType, filterLTV, filterConsent, filterChurn, filteredAudience, selectedUser]);

  return (
    <div className="flex h-full font-sans">
      
      {/* Left List */}
      <div className="w-[340px] flex flex-col border-r border-[#1f1f22] bg-[#0a0a0c] shrink-0">
        <div className="p-4 border-b border-[#1f1f22] space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">Клиенты и база</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">Всего: {clients.length} · в фильтре: {filteredAudience.length}</p>
            </div>
          </div>

          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importExcelFile(f);
            e.target.value = '';
          }} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/25 text-[11px] font-semibold hover:bg-[#3b82f6]/25"
            >
              <Upload className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-[#1f1f22] text-[11px] text-[#d4d4d8] hover:bg-[#121214]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Шаблон
            </button>
            <button
              type="button"
              onClick={resetToDemo}
              className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-[#1f1f22] text-[#71717a] hover:text-white hover:bg-[#121214]"
              title="Сбросить демо-данные"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {importError && <p className="text-[11px] text-red-400">{importError}</p>}
          {lastImportInfo && !importError && (
            <p className="text-[11px] text-[#10b981]">{lastImportInfo}</p>
          )}
          <Link
            href="/guide"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[#3f3f46] text-[11px] text-[#71717a] hover:text-[#a78bfa] hover:border-[#8b5cf6]/40 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Центр знаний: рейтинг, Excel, EES
          </Link>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Поиск по номеру, email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121214] border border-[#1f1f22] text-sm text-zinc-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#3b82f6]/50 transition-colors"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select 
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="w-full bg-[#121214] border border-[#1f1f22] text-xs text-zinc-300 rounded-md pl-2 pr-6 py-1.5 focus:outline-none focus:border-[#3b82f6]/50 appearance-none cursor-pointer"
                >
                  <option value="all">Тип: Все</option>
                  <option value="b2b">B2B</option>
                  <option value="b2c">B2C</option>
                </select>
                <Filter className="w-3 h-3 absolute right-2 top-2 text-zinc-500 pointer-events-none" />
              </div>

              <div className="relative flex-1">
                <select 
                  value={filterLTV}
                  onChange={e => setFilterLTV(e.target.value)}
                  className="w-full bg-[#121214] border border-[#1f1f22] text-xs text-zinc-300 rounded-md pl-2 pr-6 py-1.5 focus:outline-none focus:border-[#3b82f6]/50 appearance-none cursor-pointer"
                >
                  <option value="all">LTV: Все</option>
                  <option value="VIP">VIP</option>
                  <option value="Основа">Основа</option>
                  <option value="Высокий риск">Риск</option>
                </select>
                <Filter className="w-3 h-3 absolute right-2 top-2 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            <div className="relative">
              <select 
                value={filterConsent}
                onChange={e => setFilterConsent(e.target.value)}
                className="w-full bg-[#121214] border border-[#1f1f22] text-xs text-zinc-300 rounded-md pl-2 pr-6 py-1.5 focus:outline-none focus:border-[#3b82f6]/50 appearance-none cursor-pointer"
              >
                <option value="all">Согласия: Любые каналы</option>
                <option value="marketing">Только Promo (Разрешено)</option>
                <option value="whatsapp">Только WhatsApp (Активен)</option>
                <option value="telegram">Только Telegram (Активен)</option>
              </select>
              <Filter className="w-3 h-3 absolute right-2 top-2 text-zinc-500 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filterChurn}
                onChange={(e) => setFilterChurn(e.target.value as 'all' | ChurnSegment)}
                className="w-full bg-[#121214] border border-[#1f1f22] text-xs text-zinc-300 rounded-md pl-2 pr-6 py-1.5 focus:outline-none focus:border-[#3b82f6]/50 appearance-none cursor-pointer"
              >
                <option value="all">Отток: все сегменты</option>
                {(Object.keys(CHURN_LABEL) as ChurnSegment[]).map((k) => (
                  <option key={k} value={k}>
                    {CHURN_LABEL[k]}
                  </option>
                ))}
              </select>
              <Filter className="w-3 h-3 absolute right-2 top-2 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredAudience.length === 0 ? (
            <div className="text-center py-8 text-sm text-zinc-500">
              Клиенты не найдены
            </div>
          ) : (
            filteredAudience.map((user) => (
              <button 
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={cn(
                  "w-full p-4 flex items-start gap-3 border-b border-[#1f1f22]/50 transition-colors text-left",
                  selectedUser?.id === user.id ? "bg-[#1f1f22] border-l-2 border-l-[#3b82f6]" : "hover:bg-[#121214] border-l-2 border-l-transparent"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-[#27272a] border border-[#3f3f46] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">{user.avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[14px] text-white truncate">{user.name}</span>
                    {user.type === 'b2b' && <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">B2B</span>}
                    {user.type === 'b2c' && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">B2C</span>}
                  </div>
                  <div className="text-[12px] text-[#a1a1aa] truncate">{user.loyalty.tier} • {user.loyalty.pointsBalance} б.</div>
                  {user.scoring && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1f1f22] text-[#a1a1aa] border border-[#27272a]">
                        {CHURN_LABEL[user.scoring.churnSegment]}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#60a5fa] border border-[#3b82f6]/20">
                        приоритет {user.scoring.priorityScore}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Details Panel */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0c] custom-scrollbar">
        {selectedUser ? (
          <div className="max-w-4xl mx-auto p-8 space-y-8 fade-in">
            
            {/* Header / Basic Info */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#3b82f6]/20 to-[#8b5cf6]/20 border border-[#3b82f6]/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                  <span className="text-2xl font-bold text-white">{selectedUser.avatar}</span>
                </div>
                <div>
                  <h1 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
                    {selectedUser.name}
                    {selectedUser.type === 'b2b' && <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded uppercase font-bold tracking-wider">B2B Корпорация</span>}
                    {selectedUser.type === 'b2c' && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded uppercase font-bold tracking-wider">B2C</span>}
                  </h1>
                  <div className="flex items-center gap-4 mt-2 text-sm text-[#a1a1aa]">
                    <span>{selectedUser.phone}</span>
                    <span>•</span>
                    <span>{selectedUser.email}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <span className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] uppercase font-bold tracking-wider border",
                  selectedUser.ltvStatus === 'VIP' ? "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30" : 
                  selectedUser.ltvStatus === 'Высокий риск' ? "bg-red-500/10 text-red-500 border-red-500/30" : 
                  "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30"
                )}>
                  LTV: {selectedUser.ltvStatus}
                </span>
                
                <div className="flex items-center gap-2 mt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    Согласия: 
                    <span className={selectedUser.consent.whatsapp ? "text-emerald-400" : "text-zinc-600"}>WA</span> /
                    <span className={selectedUser.consent.telegram ? "text-blue-400" : "text-zinc-600"}>TG</span> / 
                    <span className={selectedUser.consent.marketing ? "text-purple-400" : "text-zinc-600"}>Promo</span>
                  </span>
                </div>
              </div>
            </div>

            {/* EES / Scoring */}
            {selectedUser.scoring && (
              <div className="crm-card p-6 border-[#8b5cf6]/20">
                <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider text-[#8b5cf6]">
                  Скоринг EES (отток и приоритет ИИ)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-1">Жизненный цикл</div>
                    <div className="text-white font-medium">{LIFECYCLE_LABEL[selectedUser.scoring.lifecycle]}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-1">Сегмент оттока</div>
                    <div className="text-white font-medium">{CHURN_LABEL[selectedUser.scoring.churnSegment]}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex justify-between text-[11px] text-[#71717a] mb-1">
                      <span>Приоритет в очереди ИИ</span>
                      <span className="text-white font-mono">{selectedUser.scoring.priorityScore}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#1f1f22] overflow-hidden">
                      <div
                        className="h-full bg-[#3b82f6] rounded-full transition-all"
                        style={{ width: `${selectedUser.scoring.priorityScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex justify-between text-[11px] text-[#71717a] mb-1">
                      <span>Индекс риска оттока</span>
                      <span className="text-white font-mono">{selectedUser.scoring.riskIndex}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#1f1f22] overflow-hidden">
                      <div
                        className="h-full bg-[#f59e0b] rounded-full transition-all"
                        style={{ width: `${selectedUser.scoring.riskIndex}%` }}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-4 text-xs text-[#a1a1aa]">
                    <span>Дней с покупки: <span className="text-white font-mono">{selectedUser.scoring.daysSincePurchase === 999 ? '—' : selectedUser.scoring.daysSincePurchase}</span></span>
                    <span>Выручка 30д (атриб. ИИ): <span className="text-[#10b981] font-mono">₽ {(selectedUser.attributedRevenue30d ?? 0).toLocaleString('ru-RU')}</span></span>
                    <span>Спасено на скидках: <span className="text-cyan-400 font-mono">₽ {(selectedUser.savedDiscountRub ?? 0).toLocaleString('ru-RU')}</span></span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Loyalty Analytics */}
            <div className="crm-card p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <ShieldCheck className="w-32 h-32" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-6 uppercase tracking-wider text-[#3b82f6]">Аналитика покупателя (ИИ)</h3>
              
              <div className="grid grid-cols-3 gap-6 relative z-10">
                <div>
                  <div className="text-[11px] text-[#a1a1aa] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    Статус <Info className="w-3 h-3" />
                  </div>
                  <div className="text-2xl font-bold text-white">{selectedUser.loyalty.tier}</div>
                  <div className="text-xs text-[#10b981] mt-1 font-medium">{selectedUser.loyalty.pointsBalance} баллов</div>
                </div>

                <div>
                  <div className="text-[11px] text-[#a1a1aa] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    Возможная выручка <Info className="w-3 h-3" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#8b5cf6]">₽ {(selectedUser.loyalty.aiPredictedCLV / 1000).toFixed(1)}k</div>
                  <div className="text-xs text-[#a1a1aa] mt-1 line-clamp-1 truncate" title={selectedUser.loyalty.nextAction}>
                    План ИИ: {selectedUser.loyalty.nextAction}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-[#a1a1aa] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    Риск ухода <Info className="w-3 h-3" />
                  </div>
                  <div className={cn(
                    "text-2xl font-bold",
                    selectedUser.loyalty.churnRisk === 'Высокий' ? "text-red-400" : 
                    selectedUser.loyalty.churnRisk === 'Средний' ? "text-[#f59e0b]" : "text-[#10b981]"
                  )}>
                    {selectedUser.loyalty.churnRisk}
                  </div>
                  <div className="text-xs text-[#a1a1aa] mt-1">Вероятность оттока</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Purchases / Assets */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-white" />
                  Активы / История покупок
                </h3>
                
                {selectedUser.purchases.map(item => (
                  <div key={item.id} className="bg-[#121214] border border-[#1f1f22] p-4 rounded-xl relative overflow-hidden group">
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#3b82f6] to-[#8b5cf6] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-white text-[15px]">{item.title}</div>
                      <div className="font-mono text-sm text-[#10b981]">₽ {item.price.toLocaleString()}</div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-[11px] text-[#71717a] font-mono tracking-widest uppercase">{item.category}</div>
                      <div className="text-xs font-medium text-[#d4d4d8] bg-[#1f1f22] px-2 py-1 rounded">
                        От {item.date}
                      </div>
                    </div>
                  </div>
                ))}

                <button className="w-full py-3 border border-dashed border-[#27272a] text-[#71717a] text-sm font-medium rounded-xl hover:text-white hover:border-[#3f3f46] transition-colors">
                  Смотреть всё в ERP <ArrowUpRight className="w-4 h-4 inline-block ml-1" />
                </button>
              </div>

              {/* Communication Timeline */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-white" />
                    Full-Loop История
                  </div>
                  <button className="text-xs font-medium text-[#3b82f6] hover:text-[#60a5fa] transition-colors">Перехватить чат</button>
                </h3>
                
                <div className="bg-[#121214] border border-[#1f1f22] p-5 rounded-xl space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {selectedUser.history.map(event => (
                    <EventItem key={event.id} event={event} />
                  ))}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[#71717a]">
            Выберите профиль клиента слева
          </div>
        )}
      </div>
    </div>
  );
}

function EventItem({ event }: { event: CommunicationEvent; key?: string | number }) {
  const isAI = event.sender === 'ai';
  const isClient = event.sender === 'client';
  const isSystem = event.sender === 'system';

  return (
    <div className={cn("relative pl-6 border-l-2", 
      isAI ? "border-[#8b5cf6]" : isSystem ? "border-[#3f3f46]" : "border-[#10b981]"
    )}>
      <div className={cn("absolute -left-1.5 top-0 w-3 h-3 rounded-full border-2 border-[#121214]",
          isAI ? "bg-[#8b5cf6]" : isSystem ? "bg-[#3f3f46]" : "bg-[#10b981]"
      )}></div>
      
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-mono text-[#71717a]">{event.date}</span>
        <span className={cn("text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border",
          isAI ? "bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20" : 
          isSystem ? "bg-[#27272a] text-[#a1a1aa] border-[#3f3f46]" : 
          "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20"
        )}>
          {isAI ? 'ИИ Ядро' : isSystem ? 'ERP / Триггер' : 'Клиент'}
        </span>
        {event.type === 'whatsapp' && <span className="text-[10px] text-emerald-500">WhatsApp</span>}
        {event.type === 'telegram' && <span className="text-[10px] text-blue-400">Telegram</span>}
      </div>

      <div className={cn("text-[13px] leading-relaxed p-3 rounded-lg mt-2",
        isAI ? "bg-[#8b5cf6]/10 text-[#e4d4ff] border border-[#8b5cf6]/20" : 
        isSystem ? "bg-[#1f1f22] text-[#d4d4d8] text-xs font-mono" : 
        "bg-[#10b981]/10 text-[#d1fae5] border border-[#10b981]/20"
      )}>
        {event.content}
      </div>

      {event.revenueImpact && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-[#10b981] to-[#34d399] px-2 py-1 rounded shadow-[0_0_10px_rgba(16,185,129,0.2)]">
          <ArrowUpRight className="w-3 h-3" />
          P&L Эффект (Выручка): +₽ {event.revenueImpact.toLocaleString()}
        </div>
      )}
    </div>
  );
}
