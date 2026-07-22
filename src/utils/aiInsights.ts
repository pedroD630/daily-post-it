/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI provider abstraction for the Insights view.
 *
 * Zero recurring cost is the whole point:
 *   1. Chrome Built-in AI (Gemini Nano on-device) — private, offline, free.
 *      Requires Chrome 138+ or Edge with the feature enabled. First call
 *      may trigger a one-time ~2GB model download.
 *   2. Gemini API BYOK — user pastes their own free-tier API key in Settings.
 *      Google AI Studio free tier is generous (15 RPM / 1M ctx tokens).
 *   3. null — no provider available. Caller falls back to the rule-based
 *      suggestions that already exist in the app.
 *
 * The `LanguageModel` / `window.ai` typings are missing from lib.dom, so we
 * bypass TS with `as any` casts. The runtime checks are defensive: any
 * unexpected shape is treated as "not available".
 */

export type AIProviderKind = "chrome-builtin" | "gemini-byok";

export interface AIProvider {
  kind: AIProviderKind;
  /** Human-readable label shown in the UI badge. */
  label: string;
  /** Runs the model. Should throw on hard failure (network, quota, bad key). */
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}

/** Try providers in preference order; return the first that works. */
export async function detectBestProvider(geminiApiKey?: string): Promise<AIProvider | null> {
  const chrome = await tryChromeBuiltin();
  if (chrome) return chrome;
  if (geminiApiKey && geminiApiKey.trim()) return makeGeminiProvider(geminiApiKey.trim());
  return null;
}

/** ----------------------------------------------------------------------- */

async function tryChromeBuiltin(): Promise<AIProvider | null> {
  if (typeof self === "undefined") return null;

  try {
    // Chrome 138+ / Edge stable: exposes `LanguageModel` global.
    const LM: any = (globalThis as any).LanguageModel;
    if (LM && typeof LM.availability === "function") {
      const status: string = await LM.availability();
      // 'available' works instantly. 'downloadable' means first call triggers
      // model download — acceptable because the user has to click to run.
      // 'downloading' likewise — session.create() will await the download.
      if (status === "available" || status === "downloadable" || status === "downloading") {
        return {
          kind: "chrome-builtin",
          label: "Chrome Built-in (Gemini Nano)",
          generate: async (system, user) => {
            const session: any = await LM.create({
              initialPrompts: [{ role: "system", content: system }],
            });
            try {
              const out = await session.prompt(user);
              return String(out || "").trim();
            } finally {
              try { session.destroy?.(); } catch { /* ignore */ }
            }
          },
        };
      }
    }

    // Chrome 128-137 origin trial: window.ai.languageModel.
    const legacy: any = (globalThis as any).ai?.languageModel;
    if (legacy?.capabilities) {
      const caps = await legacy.capabilities();
      if (caps.available === "readily" || caps.available === "after-download") {
        return {
          kind: "chrome-builtin",
          label: "Chrome Built-in (Gemini Nano)",
          generate: async (system, user) => {
            const session: any = await legacy.create({ systemPrompt: system });
            try {
              const out = await session.prompt(user);
              return String(out || "").trim();
            } finally {
              try { session.destroy?.(); } catch { /* ignore */ }
            }
          },
        };
      }
    }
  } catch (err) {
    console.warn("Chrome Built-in AI probe failed:", err);
  }
  return null;
}

/** ----------------------------------------------------------------------- */

function makeGeminiProvider(apiKey: string): AIProvider {
  return {
    kind: "gemini-byok",
    label: "Gemini API (your key)",
    generate: async (system, user) => {
      // gemini-2.0-flash is fast + generous free tier + very cheap paid tier.
      const model = "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body = {
        contents: [{ role: "user", parts: [{ text: user }] }],
        systemInstruction: { role: "system", parts: [{ text: system }] },
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 400,
        },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        // Give the caller something readable in the UI.
        if (res.status === 400) throw new Error("Chave da API inválida ou requisição malformada.");
        if (res.status === 401 || res.status === 403) throw new Error("Chave da API não autorizada. Verifique em Google AI Studio.");
        if (res.status === 429) throw new Error("Limite de requisições atingido no free tier. Tente em alguns segundos.");
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n");
      if (!text) {
        // Sometimes Gemini blocks a response and returns finishReason=SAFETY.
        const reason = data.candidates?.[0]?.finishReason;
        if (reason && reason !== "STOP") throw new Error(`Gemini bloqueou a resposta (${reason}).`);
        throw new Error("Gemini retornou resposta vazia.");
      }
      return String(text).trim();
    },
  };
}

/** Utility for the Settings UI: quick sanity check on a pasted key. */
export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  if (!apiKey.trim()) return false;
  try {
    const p = makeGeminiProvider(apiKey.trim());
    const out = await p.generate("Say only 'ok'.", "ping");
    return out.length > 0;
  } catch (err) {
    console.warn("Gemini key validation failed:", err);
    return false;
  }
}
