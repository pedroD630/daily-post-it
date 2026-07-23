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
 * AUTH: this function MUST be deployed WITHOUT the gateway JWT check:
 *   supabase functions deploy ai-insight --no-verify-jwt
 * because Supabase's gateway `verify_jwt` only accepts the project's own
 * symmetric (HS256) tokens and rejects the Firebase RS256 ID token with
 * `UNAUTHORIZED_ASYMMETRIC_JWT`. Instead we verify the Firebase ID token
 * ourselves below, against Google's public JWKS. `--no-verify-jwt` only
 * disables the GATEWAY check; our in-code check still blocks anonymous
 * callers.
 *
 * License: SPDX-License-Identifier: Apache-2.0
 */

// deno-lint-ignore-file no-explicit-any

import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

// Firebase project id — must match the app's firebaseConfig.projectId.
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "gen-lang-client-0678919214";

// Google publishes the Firebase secure-token signing keys as JWKS here.
// createRemoteJWKSet caches + rotates them automatically.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

/**
 * Verify a Firebase ID token. Returns the subject (uid) on success, or null
 * if the token is missing/invalid/expired. Checks signature (RS256 against
 * Google's JWKS), issuer and audience.
 */
async function verifyFirebaseToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch (err) {
    console.warn("Firebase token verification failed:", String(err).slice(0, 120));
    return null;
  }
}

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

  // Authenticate: verify the caller's Firebase ID token ourselves (the
  // gateway can't, hence --no-verify-jwt). Blocks anonymous abuse of the
  // paid Gemini key.
  const uid = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!uid) {
    return new Response(
      JSON.stringify({ error: "Não autenticado. Faça login novamente." }),
      { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
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

  // 16k covers the enriched system prompt (a month of completed + pending
  // tasks). gemini-2.5-flash-lite has a 1M-token context so this is cheap.
  const system = String(body.system ?? "").slice(0, 16000);
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

  // gemini-2.5-flash-lite is the cheapest current stable model: lowest
  // token cost among the flash family, still supports generateContent with
  // a 1M input / 65k output context. Fallback chain covers the case where
  // Google deprecates one (as happened with gemini-2.0-flash returning 404
  // "no longer available" mid-way through this app's life).
  const ALLOWED_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite-001",
    "gemini-flash-lite-latest",
  ];
  const requestedModel = ALLOWED_MODELS.includes(body.model ?? "") ? body.model! : ALLOWED_MODELS[0];
  // Try the requested model first, then fall through the rest of the chain
  // ONLY on 404 (model retired/renamed) — other errors (429, 400) surface
  // immediately since retrying with a different model won't help.
  const modelsToTry = [requestedModel, ...ALLOWED_MODELS.filter((m) => m !== requestedModel)];

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
    let lastErrText = "";
    let lastStatus = 502;

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      if (geminiRes.ok) {
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

        return new Response(JSON.stringify({ text, model }), {
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      lastErrText = await geminiRes.text().catch(() => "");
      lastStatus = geminiRes.status;

      // Only keep trying the fallback chain on 404 (model retired/renamed).
      // Any other status (429 rate limit, 400 bad request, 500 upstream)
      // means retrying with a different model won't fix it.
      if (geminiRes.status !== 404) break;
      console.warn(`Model ${model} returned 404, trying next in chain...`);
    }

    const message =
      lastStatus === 429
        ? "IA temporariamente indisponível (limite de requisições). Tente novamente em instantes."
        : lastStatus === 400
        ? "A IA rejeitou a requisição."
        : lastStatus === 404
        ? "Nenhum modelo de IA disponível no momento (todos retornaram 404)."
        : "Erro no backend de IA.";
    return new Response(
      JSON.stringify({ error: message, upstream: lastErrText.slice(0, 300) }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro de rede ao chamar o Gemini", details: String(err).slice(0, 200) }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    );
  }
});
