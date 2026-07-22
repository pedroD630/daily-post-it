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

export type AIProviderKind = "chrome-builtin" | "supabase-proxy" | "gemini-byok";

export interface AIProvider {
  kind: AIProviderKind;
  /** Human-readable label shown in the UI badge. */
  label: string;
  /** Runs the model. Should throw on hard failure (network, quota, bad key). */
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}

/**
 * Diagnostic snapshot of which providers are configured / available. Used
 * by the UI when NO provider works, so the user (or the owner deploying
 * the app) can see exactly what's missing instead of guessing.
 */
export interface ProviderStatus {
  chromeBuiltin: { available: boolean; reason: string };
  proxy: { enabled: boolean; loggedIn: boolean; reason: string };
  byok: { hasKey: boolean };
}

export async function probeProviders(geminiApiKey?: string): Promise<ProviderStatus> {
  // Chrome Built-in
  let chromeBuiltin = { available: false, reason: "Chrome/Edge 138+ desktop only" };
  try {
    const LM: any = (globalThis as any).LanguageModel;
    if (LM?.availability) {
      const s: string = await LM.availability();
      if (s === "available") chromeBuiltin = { available: true, reason: "ready" };
      else if (s === "downloadable" || s === "downloading") chromeBuiltin = { available: true, reason: `model ${s}` };
      else chromeBuiltin = { available: false, reason: `LanguageModel.availability=${s}` };
    } else if ((globalThis as any).ai?.languageModel?.capabilities) {
      const caps = await (globalThis as any).ai.languageModel.capabilities();
      chromeBuiltin = caps.available === "readily"
        ? { available: true, reason: "ready (legacy API)" }
        : { available: false, reason: `capabilities.available=${caps.available}` };
    }
  } catch (err) {
    chromeBuiltin = { available: false, reason: `probe error: ${String(err).slice(0, 80)}` };
  }

  // Proxy
  const env = (import.meta as any).env;
  const proxyFlag = env?.VITE_AI_PROXY_ENABLED === "true";
  let proxy = { enabled: proxyFlag, loggedIn: false, reason: "" };
  if (!proxyFlag) {
    proxy.reason = "VITE_AI_PROXY_ENABLED not set to 'true' in Vercel env";
  } else {
    try {
      const { getAuth } = await import("firebase/auth");
      const user = getAuth().currentUser;
      proxy.loggedIn = !!user;
      proxy.reason = user ? "ready" : "not signed in to Google";
    } catch (err) {
      proxy.reason = `probe error: ${String(err).slice(0, 80)}`;
    }
  }

  // BYOK
  const byok = { hasKey: !!(geminiApiKey && geminiApiKey.trim()) };

  return { chromeBuiltin, proxy, byok };
}

/**
 * Try providers in preference order and return the first that works:
 *   1. Chrome Built-in AI (on-device Gemini Nano) — private, offline, zero
 *      round-trip. Desktop Chrome/Edge only.
 *   2. Supabase proxy (server-side Gemini API with owner's key). Requires
 *      the ai-insight Edge Function deployed + VITE_AI_PROXY_ENABLED=true.
 *      This is the "just works" path for mobile users in production.
 *   3. BYOK Gemini — for users who prefer their own key over the shared
 *      proxy, or for owners who don't want to run the Edge Function.
 *   4. null — caller falls back to the rule-based suggestions.
 */
export async function detectBestProvider(geminiApiKey?: string): Promise<AIProvider | null> {
  const chrome = await tryChromeBuiltin();
  if (chrome) return chrome;
  const proxy = await tryProxyProvider();
  if (proxy) return proxy;
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

/**
 * Zero-config AI for mobile / non-Chrome users. Uses the ai-insight
 * Supabase Edge Function which owns the Gemini key server-side.
 *
 * Prereqs (owner side, one-time):
 *   VITE_AI_PROXY_ENABLED=true    (turns this provider on in the client)
 *   supabase secrets set GEMINI_API_KEY=...
 *   supabase functions deploy ai-insight
 *
 * Auth: uses the user's Firebase ID token (via Supabase Third-Party Auth).
 * Supabase's default verify_jwt on the function rejects anonymous callers.
 */
async function tryProxyProvider(): Promise<AIProvider | null> {
  const env = (import.meta as any).env;
  if (env?.VITE_AI_PROXY_ENABLED !== "true") return null;
  try {
    const { supabase } = await import("../db/supabase");
    if (!supabase) return null;
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    if (!user) return null;

    return {
      kind: "supabase-proxy",
      label: "Cloud AI (Gemini)",
      generate: async (system: string, userPrompt: string) => {
        const { data, error } = await supabase.functions.invoke("ai-insight", {
          body: { system, user: userPrompt },
        });
        if (error) {
          // supabase-js wraps HTTP errors as FunctionsHttpError. Try to surface
          // whatever the function returned as JSON.
          const status = (error as any).context?.status ?? "?";
          const raw = (error as any).context?.body
            ? await (error as any).context.body.text?.().catch(() => "")
            : "";
          let human = "AI backend error";
          try {
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed?.error) human = parsed.error;
          } catch { /* raw not JSON */ }
          throw new Error(`${human} (HTTP ${status})`);
        }
        const text = (data as any)?.text;
        if (!text) throw new Error("Empty response from AI");
        return String(text).trim();
      },
    };
  } catch (err) {
    console.warn("Supabase proxy AI probe failed:", err);
    return null;
  }
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
