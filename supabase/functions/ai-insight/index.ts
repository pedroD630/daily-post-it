/**
 * Supabase Edge Function: ai-insight
 *
 * Proxies the Gemini API for authenticated users so we never ship the
 * server-side API key to the browser. Supabase's default JWT verification
 * (`verify_jwt: true`) rejects unauthenticated callers BEFORE this function
 * runs, so this file only needs to worry about the happy path.
 *
 * Deployment steps (one-time):
 *   1. supabase secrets set GEMINI_API_KEY=your_key_from_ai_studio
 *   2. supabase functions deploy ai-insight
 *   3. On Vercel (client-side flag): set VITE_AI_PROXY_ENABLED=true
 *      and VITE_SUPABASE_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1
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

  let body: { system?: string; user?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const system = String(body.system ?? "").slice(0, 4000);
  const user = String(body.user ?? "").slice(0, 8000);
  if (!system || !user) {
    return new Response(JSON.stringify({ error: "Missing 'system' or 'user' prompt" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
  const model = ["gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash"].includes(body.model ?? "")
    ? body.model!
    : "gemini-2.0-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const geminiBody = {
    contents: [{ role: "user", parts: [{ text: user }] }],
    systemInstruction: { role: "system", parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 400,
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
          ? "AI temporarily unavailable (rate limit). Try again in a moment."
          : geminiRes.status === 400
          ? "AI rejected the request."
          : "AI backend error.";
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
        JSON.stringify({ error: `AI returned no text (finishReason=${reason})` }),
        { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Network error calling Gemini", details: String(err).slice(0, 200) }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
  }
});
