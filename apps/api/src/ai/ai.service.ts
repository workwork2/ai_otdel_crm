import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiProviderId = 'anthropic' | 'openai' | 'gemini' | 'stub';

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  private anthropicModel(): string {
    return this.config.get<string>('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022');
  }

  async completeText(input: {
    system: string;
    user: string;
    maxTokens?: number;
  }): Promise<{ text: string; provider: AiProviderId; error?: string }> {
    const maxTokens = input.maxTokens ?? 2048;
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        const res = await client.messages.create({
          model: this.anthropicModel(),
          max_tokens: maxTokens,
          system: input.system,
          messages: [{ role: 'user', content: input.user }],
        });
        const text = (res.content ?? [])
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('')
          .trim();
        if (text) return { text, provider: 'anthropic' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[ai] anthropic failed:', msg);
      }
    }

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.get('OPENAI_MODEL', 'gpt-4o-mini'),
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: input.system },
              { role: 'user', content: input.user },
            ],
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (text) return { text, provider: 'openai' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[ai] openai failed:', msg);
      }
    }

    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const model = this.config.get('GEMINI_MODEL', 'gemini-2.0-flash');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${input.system}\n\n---\n${input.user}` }],
              },
            ],
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text =
          data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
        if (text) return { text, provider: 'gemini' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[ai] gemini failed:', msg);
      }
    }

    return {
      text:
        `${input.user.trim()}\n\n—\n[Нет ключа ИИ: задайте ANTHROPIC_API_KEY (основной), опционально OPENAI_API_KEY или GEMINI_API_KEY.]`,
      provider: 'stub',
      error: 'no_provider',
    };
  }
}
