/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Starter beliefs, inserted once when the `beliefs` store is empty (first
 * launch). The user can edit, archive or delete any of them afterwards —
 * they are a starting point, not a fixed list.
 *
 * Keywords must be >= 3 chars to match (see utils/beliefMatching), and are
 * deliberately ordinary words people already type into their tasks, so
 * evidence accumulates without the user having to think about it.
 */

export interface BeliefSeed {
  negativeStatement: string;
  healthyStatement: string;
  keywords: string[];
}

export const BELIEF_SEEDS: BeliefSeed[] = [
  {
    negativeStatement: "Eu não sou suficiente.",
    healthyStatement: "Meu valor não depende do meu pior hábito.",
    keywords: ["treino", "estudar", "entreguei", "terminei"],
  },
  {
    negativeStatement: "Eu nunca termino o que começo.",
    healthyStatement: "Eu concluo o que me proponho, um passo por vez.",
    keywords: ["terminei", "conclui", "finalizei", "entreguei"],
  },
  {
    negativeStatement: "Não tenho disciplina.",
    healthyStatement: "Disciplina é uma escolha que eu refaço todo dia.",
    keywords: ["acordei", "rotina", "cedo", "planejei"],
  },
  {
    negativeStatement: "Eu sempre recaio.",
    healthyStatement: "Cada dia limpo é uma prova de que eu consigo.",
    keywords: ["resisti", "evitei", "segurei", "recusei"],
  },
  {
    negativeStatement: "Sou preguiçoso.",
    healthyStatement: "Eu ajo mesmo quando não estou com vontade.",
    keywords: ["comecei", "arrumei", "limpei", "organizei"],
  },
  {
    negativeStatement: "Ninguém pode contar comigo.",
    healthyStatement: "Eu honro os compromissos que assumo.",
    keywords: ["ajudei", "liguei", "respondi", "combinei"],
  },
  {
    negativeStatement: "Não sou capaz de aprender isso.",
    healthyStatement: "Meu cérebro constrói caminhos novos a cada tentativa.",
    keywords: ["estudei", "pratiquei", "curso", "aula"],
  },
  {
    negativeStatement: "Meu corpo é um caso perdido.",
    healthyStatement: "Cuidar do meu corpo é um ato de respeito.",
    keywords: ["treino", "caminhei", "corri", "alongamento"],
  },
];
