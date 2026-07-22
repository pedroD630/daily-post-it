/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Builds the system + user prompts fed to the AI provider. Consolidates
 * derived stats so the model only sees aggregates — never the raw text
 * of the user's tasks or notes (privacy + smaller context).
 */

import { Day, Goal } from "../types";
import { computeStats, computeStreak, computeWeeklyBars } from "./insights";
import {
  actualWeeklyFrequency,
  daysUntilDeadline,
  getGoalStatus,
  toWeeklyTarget,
} from "./goalFrequency";

export function buildInsightPrompt(
  days: Day[],
  goals: Goal[],
  pointsBalance: number
): { system: string; user: string } {
  const stats = computeStats(days);
  const streak = computeStreak(days);
  const weekly = computeWeeklyBars(days);
  const active = goals.filter((g) => !g.archived);

  const system = [
    "Você é um coach de produtividade brasileiro, curto, prático e amigável.",
    "Você recebe MÉTRICAS DERIVADAS dos hábitos do usuário (nunca o conteúdo bruto das tarefas).",
    "Devolva de 2 a 3 observações SEPARADAS POR LINHA EM BRANCO.",
    "Cada observação deve ter no máximo 2 frases curtas.",
    "Não use emojis (no máximo 1 se combinar naturalmente).",
    "Nunca invente números. Se um campo está zerado ou vazio, comente esse fato.",
    "Foque em: consistência, gargalos, sugestões acionáveis, tom motivacional sem clichê.",
    "Máximo total: 400 caracteres.",
  ].join(" ");

  const weeklyText = weekly.map((b) => `${b.label}=${b.completed}`).join(", ");

  const goalsText = active.length
    ? active
        .map((g) => {
          const target = toWeeklyTarget(g.targetFrequency.amount, g.targetFrequency.unit);
          const actual = actualWeeklyFrequency(g, days);
          const status = getGoalStatus(actual, target);
          const dl = daysUntilDeadline(g.deadline);
          return `- "${g.title}": ${actual}/${Math.max(1, Math.round(target))} por semana (${status}); ${dl >= 0 ? `${dl}d até deadline` : "past due"}`;
        })
        .join("\n")
    : "(nenhuma meta cadastrada)";

  const user = [
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
    "Com base APENAS nesses dados, dê 2-3 observações práticas.",
  ].join("\n");

  return { system, user };
}
