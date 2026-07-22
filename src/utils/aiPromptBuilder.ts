/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Builds the system prompt fed to the AI Coach chat. Consolidates derived
 * stats (streak, completion rate, goals) AND a compact sample of the
 * user's own completed task texts, so the model can speak concretely
 * about "what you've been spending time on" — the whole point of this
 * feature. This is the user's own data, sent through the app owner's
 * backend proxy to analyze it for their own benefit.
 */

import { Day, Goal } from "../types";
import { computeStats, computeStreak, computeWeeklyBars } from "./insights";
import {
  actualWeeklyFrequency,
  daysUntilDeadline,
  getGoalStatus,
  toWeeklyTarget,
} from "./goalFrequency";

const MAX_ACTIVITY_SAMPLE = 60;
const MAX_TASK_TEXT_LEN = 60;

/**
 * Builds the (re-generated every turn) system prompt. Rebuilding on every
 * message means the coach always reasons from the LATEST stats even mid
 * conversation — if the user completes a task while chatting and asks a
 * follow-up, the numbers reflect that.
 */
export function buildSystemPrompt(days: Day[], goals: Goal[], pointsBalance: number): string {
  const stats = computeStats(days);
  const streak = computeStreak(days);
  const weekly = computeWeeklyBars(days);
  const active = goals.filter((g) => !g.archived);

  const weeklyText = weekly.map((b) => `${b.label}=${b.completed}`).join(", ");

  const goalsText = active.length
    ? active
        .map((g) => {
          const target = toWeeklyTarget(g.targetFrequency.amount, g.targetFrequency.unit);
          const actual = actualWeeklyFrequency(g, days);
          const status = getGoalStatus(actual, target);
          const dl = daysUntilDeadline(g.deadline);
          return `- "${g.title}" (palavras-chave: ${g.keywords.join(", ")}): ${actual}/${Math.max(1, Math.round(target))} por semana (status: ${status}); ${dl >= 0 ? `${dl}d até o prazo` : "prazo já passou"}`;
        })
        .join("\n")
    : "(nenhuma meta cadastrada ainda)";

  // Sample of recently completed task texts — this is what lets the coach
  // say concrete things like "you've been focusing a lot on X lately".
  // Newest first, capped, truncated per-item to keep the prompt small.
  const recentCompleted = [...days]
    .filter((d) => !d.discarded)
    .sort((a, b) => b.id.localeCompare(a.id))
    .flatMap((d) => d.tasks.filter((t) => t.completed && t.text.trim()))
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, MAX_ACTIVITY_SAMPLE)
    .map((t) => `- ${t.text.trim().slice(0, MAX_TASK_TEXT_LEN)}`)
    .join("\n");

  return [
    "Você é um coach de produtividade brasileiro dentro do app Daily Post-it.",
    "Você conversa em um único chat contínuo com o usuário sobre o desempenho dele.",
    "Você recebe métricas derivadas E uma amostra das tarefas concluídas recentemente (dados reais do usuário).",
    "",
    "Seu papel:",
    "- Analisar em quais atividades o usuário tem dedicado mais tempo (baseado nas tarefas concluídas).",
    "- Avaliar consistência e ritmo em relação às metas de longo prazo cadastradas.",
    "- Sugerir quais deveriam ser as tarefas prioritárias para alcançar cada meta.",
    "- Comentar constância (streak, taxa de conclusão) de forma honesta e motivadora, sem clichês.",
    "- Responder perguntas de acompanhamento do usuário sobre os próprios dados.",
    "",
    "Regras de estilo:",
    "- Respostas curtas e diretas: 2 a 5 frases por padrão, só se estenda se o usuário pedir detalhes.",
    "- Português do Brasil, tom direto e prático, no máximo 1 emoji por resposta.",
    "- Nunca invente números — use apenas o que está nos dados abaixo.",
    "- Se um dado está vazio ou zerado, diga isso honestamente em vez de inventar.",
    "",
    "=== DADOS DO USUÁRIO ===",
    `Streak atual: ${streak} dias`,
    `Total de tarefas concluídas (histórico): ${stats.totalCompleted}`,
    `Taxa de conclusão nos últimos 30 dias: ${stats.completionRate30d ?? "sem dados"}%`,
    `Melhor dia até hoje: ${stats.bestDay?.count ?? 0} tarefas concluídas`,
    `Últimos 7 dias (concluídas por dia): ${weeklyText}`,
    `Saldo de pontos: ${pointsBalance}`,
    "",
    "Metas ativas:",
    goalsText,
    "",
    `Amostra de tarefas concluídas recentemente (até ${MAX_ACTIVITY_SAMPLE}, mais novas primeiro):`,
    recentCompleted || "(nenhuma tarefa concluída ainda)",
  ].join("\n");
}

/** First message the coach sends when the chat is empty, to break the ice. */
export function buildWelcomeMessage(days: Day[], goals: Goal[]): string {
  const streak = computeStreak(days);
  const active = goals.filter((g) => !g.archived);
  if (streak === 0 && active.length === 0) {
    return "Oi! Ainda não tenho muito dado seu pra analisar — complete algumas tarefas e cadastre uma meta que eu te ajudo a acompanhar o progresso. Qualquer dúvida, é só perguntar.";
  }
  const goalPart = active.length
    ? `Vi que você tem ${active.length} meta${active.length > 1 ? "s" : ""} ativa${active.length > 1 ? "s" : ""}.`
    : "Você ainda não tem metas cadastradas — se quiser acompanhamento de longo prazo, vale criar uma.";
  return `Oi! ${goalPart} Seu streak atual é de ${streak} dia${streak === 1 ? "" : "s"}. Me pergunte sobre suas atividades, consistência, ou o que priorizar pra bater suas metas.`;
}
