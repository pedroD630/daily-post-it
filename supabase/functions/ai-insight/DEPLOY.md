# AI Insight Edge Function — Deploy

Proxy autenticado que chama o Google Gemini API do servidor. É o único
provider de IA do app (Coach IA) — funciona em qualquer browser/device
sem nenhuma configuração do usuário.

> **Chrome Built-in AI foi descartado.** A disponibilidade do Gemini Nano
> on-device se mostrou inconsistente na prática (não é suportado em
> mobile, e mesmo em desktop Chrome a API não funcionou de forma
> confiável). O proxy pago é o caminho único e garantido.

## Pré-requisitos (uma vez)

1. **Supabase CLI instalado** ([docs](https://supabase.com/docs/guides/cli/getting-started))
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <seu-project-ref>
   ```

2. **Chave do Gemini API COM BILLING ATIVO**
   - Vai em https://aistudio.google.com/apikey → **Create API key**
   - ⚠️ **O free tier sozinho retorna 429 (rate limit) rapidamente em uso
     real.** Para produção, é necessário vincular a chave a um projeto do
     Google Cloud com **billing habilitado** (cartão cadastrado, crédito
     mínimo). Sem isso, a mensagem de erro será algo como:
     *"É necessário ter um saldo de crédito acima de US$ 0 para retomar
     o serviço."*
   - Depois de habilitar billing, a chave usa o tier pago automaticamente
     (o free tier continua sendo aplicado primeiro quando disponível,
     conforme a própria política do Google)

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

Adicionar a env var no Vercel Project Settings → Environment Variables:

| Variável | Valor |
|---|---|
| `VITE_AI_PROXY_ENABLED` | `true` |

(O cliente já lê `VITE_SUPABASE_URL` que você configurou antes; a função
fica em `${VITE_SUPABASE_URL}/functions/v1/ai-insight` automaticamente
via `supabase.functions.invoke("ai-insight", ...)`.)

Redeploy do frontend na Vercel pra a env var fazer efeito.

## Verificar

1. Abre o app em qualquer browser (inclusive mobile)
2. Loga com Google
3. Vai em Insights → deve aparecer o card **"Coach IA"** com chat
4. Manda uma mensagem → resposta em 2-4s

## Como confirmar que a auth está funcionando

Do console do navegador com o usuário DESLOGADO, tenta:
```javascript
fetch("https://<project>.supabase.co/functions/v1/ai-insight", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ system: "test", messages: [{ role: "user", text: "oi" }] })
}).then(r => console.log(r.status));
```
Deve retornar **401**. Isso confirma que o Supabase está rejeitando
requisições sem JWT válido.

## Formato da requisição (v2 — chat multi-turn)

```json
{
  "system": "system prompt completo, rebuilding a cada turno",
  "messages": [
    { "role": "user",  "text": "primeira pergunta do usuário" },
    { "role": "model", "text": "resposta anterior do coach" },
    { "role": "user",  "text": "pergunta atual" }
  ]
}
```
A função mantém só os últimos 24 turnos (trim automático) e capa cada
mensagem em 4000 caracteres pra manter custo previsível.

## Custo estimado (com billing habilitado)

| Cenário | Custo |
|---|---|
| 100 usuários × 3 mensagens/dia = 9k req/mês | **< R$ 5/mês** (gemini-2.5-flash-lite é o modelo mais barato disponível) |
| 1000 usuários × 5 mensagens/dia = 150k req/mês | **~R$ 15-30/mês** |
| Supabase Edge Functions | Grátis até 500k invocations/mês |

Preço de referência Gemini 2.5 Flash-Lite: mais barato que o Flash padrão.
Uma conversa típica de coaching usa poucas centenas de tokens por turno.

## Modelo usado + fallback automático

A função tenta, nesta ordem: `gemini-2.5-flash-lite` →
`gemini-2.0-flash-lite-001` → `gemini-flash-lite-latest`. Se o modelo
principal retornar 404 (aposentado/renomeado pela Google — já aconteceu
uma vez com `gemini-2.0-flash`), a função automaticamente tenta o próximo
da lista, sem exigir novo deploy. Erros que não são 404 (429 rate limit,
400 bad request) não disparam fallback, pois trocar de modelo não resolve.

Se todos os modelos da lista pararem de funcionar, olhe a lista atualizada
em `GET https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE`
e atualize o array `ALLOWED_MODELS` em `index.ts` (e o `GEMINI_MODEL_CHAIN`
equivalente em `src/utils/aiInsights.ts` pro caminho BYOK).

## Monitoramento

- Logs da função: `supabase functions logs ai-insight --follow`
- Metrics: Supabase Dashboard → Functions → ai-insight
- Billing/uso do Gemini: [Google Cloud Console → Billing](https://console.cloud.google.com/billing)
- Rate limiting: se precisar, adicionar Supabase KV com contador por
  `user_id` (extraído do JWT). Deixei fora do MVP — com billing ativo,
  o risco é custo gradual, não erro 429 abrupto.

## Segurança

- ✅ JWT do Firebase é validado pelo Supabase antes da função rodar
- ✅ `GEMINI_API_KEY` fica em Deno.env, nunca sai do server
- ✅ CORS restringível via `ALLOWED_ORIGINS`
- ✅ Prompts capped (system 6k, cada mensagem 4k chars, histórico 24 turnos)
- ✅ Safety settings do Gemini em `BLOCK_ONLY_HIGH` (permissivo mas ainda ativo)
- ⚠️ Sem rate limiting explícito por usuário — monitore o billing do
  Google Cloud nas primeiras semanas de produção pra calibrar se precisa
