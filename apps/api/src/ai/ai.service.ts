import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiProviderId = 'gemini' | 'anthropic' | 'stub';

/**
 * ИИ: Google Gemini и/или Anthropic. Порядок задаётся AI_PRIMARY_PROVIDER (gemini | anthropic), по умолчанию gemini.
 * Ключи нормализуются (trim, кавычки).
 */
@Injectable()
export class AiService {
  private readonly log = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  private normalizeApiKey(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    let k = raw.trim();
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
      k = k.slice(1, -1).trim();
    }
    return k || undefined;
  }

  private primaryProvider(): 'gemini' | 'anthropic' {
    const p = this.config.get<string>('AI_PRIMARY_PROVIDER')?.trim().toLowerCase();
    if (p === 'anthropic') return 'anthropic';
    return 'gemini';
  }

  private geminiApiKey(): string | undefined {
    return this.normalizeApiKey(this.config.get<string>('GEMINI_API_KEY'));
  }

  private geminiModel(): string {
    return this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
  }

  private anthropicApiKey(): string | undefined {
    return this.normalizeApiKey(this.config.get<string>('ANTHROPIC_API_KEY'));
  }

  private anthropicModel(): string {
    const m = this.config.get<string>('ANTHROPIC_MODEL')?.trim();
    if (m) return m;
    return 'claude-sonnet-4-20250514';
  }

  private async tryGemini(input: {
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<{ text: string } | null> {
    const geminiKey = this.geminiApiKey();
    if (!geminiKey) return null;
    const model = this.geminiModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const bodyWithSystem = {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: input.user }] }],
      generationConfig: { maxOutputTokens: input.maxTokens },
    };
    let r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyWithSystem),
    });
    if (!r.ok && r.status === 400) {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${input.system}\n\n---\n${input.user}` }],
            },
          ],
          generationConfig: { maxOutputTokens: input.maxTokens },
        }),
      });
    }
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Gemini ${r.status}: ${errText.slice(0, 400)}`);
    }
    const data = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (data.error?.message) throw new Error(data.error.message);
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
    if (!text) return null;
    return { text };
  }

  private async tryAnthropic(input: {
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<{ text: string } | null> {
    const apiKey = this.anthropicApiKey();
    if (!apiKey) return null;
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: this.anthropicModel(),
      max_tokens: input.maxTokens,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
    });
    const text = (res.content ?? [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    if (!text) return null;
    return { text };
  }

  async completeText(input: {
    system: string;
    user: string;
    maxTokens?: number;
  }): Promise<{ text: string; provider: AiProviderId; error?: string }> {
    const maxTokens = input.maxTokens ?? 2048;
    const primary = this.primaryProvider();
    const order: Array<'gemini' | 'anthropic'> =
      primary === 'gemini' ? ['gemini', 'anthropic'] : ['anthropic', 'gemini'];

    const errors: string[] = [];
    for (const prov of order) {
      try {
        if (prov === 'gemini') {
          const out = await this.tryGemini({ ...input, maxTokens });
          if (out) return { text: out.text, provider: 'gemini' };
        } else {
          const out = await this.tryAnthropic({ ...input, maxTokens });
          if (out) return { text: out.text, provider: 'anthropic' };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${prov}: ${msg}`);
        this.log.warn(`[ai] ${prov} failed: ${msg}`);
      }
    }

    const hint =
      'Задайте GEMINI_API_KEY (Google AI Studio) и/или ANTHROPIC_API_KEY в apps/api/.env. ' +
      `Порядок: AI_PRIMARY_PROVIDER=${primary}. Перезапустите API.`;
    this.log.warn(`[ai] all providers failed: ${errors.join(' | ')}`);
    /** Пустой text — клиент не подставляет «псевдо-ИИ» в поля; подсказка только в error. */
    return {
      text: '',
      provider: 'stub',
      error: errors.length ? `${errors.join(' | ')}. ${hint}` : hint,
    };
  }
}
