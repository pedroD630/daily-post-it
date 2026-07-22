/**
 * Supabase Edge Function: ai-insight
 *
 * Proxies the Gemini API for authenticated users so we never ship the
 * server-side API key to the browser. Supabase's default JWT verification
 * (`verify_jwt: true`) rejects unauthenticated callers BEFORE this function
 * runs, so this file only needs to worry about the happy path.
 *
 * Supports multi-turn chat: the client sends the full message history
 * (role: "user" | "model") plus a system prompt built from the user's
 * derived stats (streak, goals, activity summary). This is the single
 * conversation used by the Insights → AI Coach chat panel.
 *
 * Deployment steps (one-time):
 *   1. supabase secrets set GEMINI_API_KEY=your_key_from_ai_studio
 *      (requires billing enabled on the Google Cloud project — the
 *      Gemini free tier alone returns 429 once its daily quota is hit)
 *   2. supabase functions deploy ai-insight
 *   3. On Vercel: set VITE_AI_PROXY_ENABLED=true
 *   4. Redeploy the frontend.
 *
 * License: SPDX-License-Identifier: Apache-2.0
 */

// deno-lint-ignore-file no-explicit-any

// Explicit CORS reply so mobile browsers (and any custom origin) can hit
// the function. The origin allow-list is provided via env var so the same
// deployment works for local dev and production without code changes.
const CORS_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map(s => s.trim());

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = CORS_ORIGINS.includes("*") || (origin && CORS_ORIGINS.includes(origin))
    ? (origin || "*")
    : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server not configured: GEMINI_API_KEY missing" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
  }

  let body: { system?: string; messages?: ChatTurn[]; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const system = String(body.system ?? "").slice(0, 6000);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!system || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Missing 'system' or 'messages'" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  // Cap conversation length + per-message size to keep cost predictable.
  // 24 turns (~12 back-and-forths) is plenty for a coaching chat and
  // keeps the context window small, which keeps latency and cost down.
  const trimmedMessages = messages.slice(-24).map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: String(m.text ?? "").slice(0, 4000) }],
  }));

  const model = ["gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash"].includes(body.model ?? "")
    ? body.model!
    : "gemini-2.0-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const geminiBody = {
    contents: trimmedMessages,
    systemInstruction: { role: "system", parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 500,
    },
    // Safety: block only high-confidence unsafe content to avoid false positives.
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",       threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH",      threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT",threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      const message =
        geminiRes.status === 429
          ? "IA temporariamente indisponível (limite de requisições). Tente novamente em instantes."
          : geminiRes.status === 400
          ? "A IA rejeitou a requisição."
          : "Erro no backend de IA.";
      return new Response(
        JSON.stringify({ error: message, upstream: errText.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      );
    }

    const data = await geminiRes.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p?.text).filter(Boolean).join("\n").trim();

    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason ?? "UNKNOWN";
      return new Response(
        JSON.stringify({ error: `IA não retornou texto (finishReason=${reason})` }),
        { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro de rede ao chamar o Gemini", details: String(err).slice(0, 200) }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
  }
});
