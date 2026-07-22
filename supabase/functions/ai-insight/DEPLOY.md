# AI Insight Edge Function — Deploy

Proxy autenticado que chama o Google Gemini API do servidor. Serve como
alternativa "zero-config" pro usuário quando o Chrome Built-in AI não
está disponível (mobile, Safari, Firefox).

## Pré-requisitos (uma vez)

1. **Supabase CLI instalado** ([docs](https://supabase.com/docs/guides/cli/getting-started))
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <seu-project-ref>
   ```

2. **Chave grátis do Gemini API**
   - Vai em https://aistudio.google.com/apikey → **Create API key**
   - Cria projeto se pedir; a key é grátis, sem cartão

## Passos de deploy

### 1. Registrar a chave como secret no Supabase
```bash
supabase secrets set GEMINI_API_KEY=AIzaSy...
```

(Opcional — restringir CORS às origens permitidas em produção)
```bash
supabase secrets set ALLOWED_ORIGINS="https://daily-post-it.vercel.app,http://localhost:5173"
```
Sem essa var, aceita `*` (bom pra dev, revisar antes de produção).

### 2. Deploy da função
```bash
supabase functions deploy ai-insight
```

O `--no-verify-jwt` **NÃO** é usado — queremos que o Supabase valide o JWT
do Firebase automaticamente (via Third-Party Auth já configurado) antes de
a função rodar. Isso rejeita qualquer chamada anônima.

### 3. Ativar no cliente (Vercel)

Adicionar as duas env vars no Vercel Project Settings → Environment Variables:

| Variável | Valor |
|---|---|
| `VITE_AI_PROXY_ENABLED` | `true` |

(O cliente já lê `VITE_SUPABASE_URL` que você configurou antes; a função
fica em `${VITE_SUPABASE_URL}/functions/v1/ai-insight` automaticamente
via `supabase.functions.invoke("ai-insight", ...)`.)

Redeploy do frontend na Vercel pra as env vars fazerem efeito.

## Verificar

1. Abre o app em modo anônimo do Chrome mobile (ou qualquer browser que
   NÃO tenha Chrome Built-in AI)
2. Loga com Google
3. Vai em Insights → o painel roxo deve mostrar badge **"Cloud AI (Gemini)"**
4. Clica em **Analisar** → resposta em 2-3s

## Como confirmar que a auth está funcionando

Do console do navegador com o usuário DESLOGADO, tenta:
```javascript
fetch("https://<project>.supabase.co/functions/v1/ai-insight", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ system: "test", user: "test" })
}).then(r => console.log(r.status));
```
Deve retornar **401**. Isso confirma que o Supabase está rejeitando
requisições sem JWT válido.

## Custo estimado

| Cenário | Custo |
|---|---|
| 100 usuários × 2 análises/dia = 6k req/mês | **R$ 0** (dentro do free tier Supabase + Gemini) |
| 1000 usuários × 3 análises/dia = 90k req/mês | **~R$ 5-15/mês** (só pagamento é do Gemini, Supabase Functions cobre até 500k/mês) |
| Se estourar Gemini free tier | Habilitar billing no Google Cloud (input $0.10/1M tokens, output $0.40/1M) |

## Monitoramento

- Logs da função: `supabase functions logs ai-insight --follow`
- Metrics: Supabase Dashboard → Functions → ai-insight
- Rate limiting: se precisar, adicionar Supabase KV com contador por
  `user_id` (extraído do JWT). Deixei fora do MVP porque o Gemini free
  tier (15 RPM) já rate-limita naturalmente.

## Segurança

- ✅ JWT do Firebase é validado pelo Supabase antes da função rodar
- ✅ `GEMINI_API_KEY` fica em Deno.env, nunca sai do server
- ✅ CORS restringível via `ALLOWED_ORIGINS`
- ✅ Prompts capped em 4k/8k chars pra prevenir abuse
- ✅ Safety settings do Gemini em `BLOCK_ONLY_HIGH` (permissivo mas ainda ativo)
- ⚠️ Sem rate limiting explícito por usuário — Gemini quota natural cobre MVP
