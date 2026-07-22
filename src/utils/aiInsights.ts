/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI provider abstraction for the Insights AI Coach chat.
 *
 * Provider priority:
 *   1. Supabase proxy — server-side Gemini call using the app owner's paid
 *      key (Deno.env in the Edge Function). This is the primary, "just
 *      works" path: the user does nothing, no key to paste, works on any
 *      device/browser. Requires VITE_AI_PROXY_ENABLED=true + the
 *      ai-insight function deployed with GEMINI_API_KEY configured.
 *   2. Gemini API BYOK — optional advanced fallback for local development
 *      or users who want to use their own key instead of the shared one.
 *
 * Chrome Built-in AI (Gemini Nano on-device) was evaluated and dropped:
 * availability was inconsistent across devices in practice, so it added
 * complexity without a reliable payoff. The paid proxy is simpler and
 * guarantees a consistent experience for every user.
 */

export type AIProviderKind = "supabase-proxy" | "gemini-byok";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface AIProvider {
  kind: AIProviderKind;
  /** Human-readable label shown in the UI badge. */
  label: string;
  /**
   * Runs one turn of the conversation: given the system prompt (rebuilt
   * fresh each call from current stats) and the full message history
   * (already includes the newest user message), returns the model's reply.
   * Should throw a user-readable Error on hard failure.
   */
  chat(systemPrompt: string, history: ChatMessage[]): Promise<string>;
}

/**
 * Diagnostic snapshot of which providers are configured / available. Used
 * by the UI when NO provider works, so the user (or the owner deploying
 * the app) can see exactly what's missing instead of guessing.
 */
export interface ProviderStatus {
  proxy: { enabled: boolean; loggedIn: boolean; reason: string };
  byok: { hasKey: boolean };
}

export async function probeProviders(geminiApiKey?: string): Promise<ProviderStatus> {
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

  const byok = { hasKey: !!(geminiApiKey && geminiApiKey.trim()) };
  return { proxy, byok };
}

/**
 * Try providers in preference order and return the first that works:
 * Supabase proxy (paid key, zero user config) first, BYOK as an optional
 * override for anyone who configured their own key in Settings.
 */
export async function detectBestProvider(geminiApiKey?: string): Promise<AIProvider | null> {
  const proxy = await tryProxyProvider();
  if (proxy) return proxy;
  if (geminiApiKey && geminiApiKey.trim()) return makeGeminiProvider(geminiApiKey.trim());
  return null;
}

/** ----------------------------------------------------------------------- */

/**
 * Zero-config AI. Uses the ai-insight Supabase Edge Function, which owns
 * the paid Gemini key server-side. Works identically on mobile, desktop,
 * any browser — the user never sees or manages a key.
 *
 * Prereqs (owner side, one-time):
 *   VITE_AI_PROXY_ENABLED=true    (turns this provider on in the client)
 *   supabase secrets set GEMINI_API_KEY=...  (billing enabled — see DEPLOY.md)
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
      label: "Coach IA",
      chat: async (system: string, history: ChatMessage[]) => {
        const { data, error } = await supabase.functions.invoke("ai-insight", {
          body: { system, messages: history },
        });
        if (error) {
          const status = (error as any).context?.status ?? "?";
          const raw = (error as any).context?.body
            ? await (error as any).context.body.text?.().catch(() => "")
            : "";
          let human = "Erro no backend de IA";
          try {
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed?.error) human = parsed.error;
          } catch { /* raw not JSON */ }
          throw new Error(`${human} (HTTP ${status})`);
        }
        const text = (data as any)?.text;
        if (!text) throw new Error("Resposta vazia da IA");
        return String(text).trim();
      },
    };
  } catch (err) {
    console.warn("Supabase proxy AI probe failed:", err);
    return null;
  }
}

/** ----------------------------------------------------------------------- */

// Cheapest current stable models, tried in order. gemini-2.5-flash-lite is
// the lowest-cost flash-family model with generateContent support at time
// of writing. Falls through the chain on 404 (model retired/renamed) so a
// future Google deprecation doesn't silently break the BYOK path again.
const GEMINI_MODEL_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-flash-lite-latest",
];

function makeGeminiProvider(apiKey: string): AIProvider {
  return {
    kind: "gemini-byok",
    label: "Gemini (sua chave)",
    chat: async (system: string, history: ChatMessage[]) => {
      const body = {
        contents: history.slice(-24).map((m) => ({
          role: m.role === "model" ? "model" : "user",
          parts: [{ text: m.text.slice(0, 4000) }],
        })),
        systemInstruction: { role: "system", parts: [{ text: system }] },
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 500,
        },
      };

      let lastStatus = 0;
      let lastErrText = "";

      for (const model of GEMINI_MODEL_CHAIN) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n");
          if (!text) {
            const reason = data.candidates?.[0]?.finishReason;
            if (reason && reason !== "STOP") throw new Error(`Gemini bloqueou a resposta (${reason}).`);
            throw new Error("Gemini retornou resposta vazia.");
          }
          return String(text).trim();
        }

        lastStatus = res.status;
        lastErrText = await res.text().catch(() => "");
        if (res.status !== 404) break; // only chain-retry on model-not-found
      }

      if (lastStatus === 400) throw new Error("Chave da API inválida ou requisição malformada.");
      if (lastStatus === 401 || lastStatus === 403) throw new Error("Chave da API não autorizada. Verifique em Google AI Studio.");
      if (lastStatus === 429) throw new Error("Limite de requisições atingido no free tier. Tente em alguns segundos.");
      if (lastStatus === 404) throw new Error("Nenhum modelo Gemini disponível para esta chave no momento.");
      throw new Error(`Gemini API ${lastStatus}: ${lastErrText.slice(0, 200)}`);
    },
  };
}

/** Utility for the Settings UI: quick sanity check on a pasted key. */
export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  if (!apiKey.trim()) return false;
  try {
    const p = makeGeminiProvider(apiKey.trim());
    const out = await p.chat("Say only 'ok'.", [{ role: "user", text: "ping" }]);
    return out.length > 0;
  } catch (err) {
    console.warn("Gemini key validation failed:", err);
    return false;
  }
}
