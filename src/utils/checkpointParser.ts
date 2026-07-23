/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Parses AI-proposed checkpoints out of a chat reply.
 *
 * The coach is instructed (in the system prompt) that whenever it proposes
 * concrete milestones toward a goal, it should append a machine-readable
 * block at the very end of its reply:
 *
 *   <<<CHECKPOINTS>>>
 *   [{"goalTitle":"Ter R$20.000 investidos","title":"Guardar R$500 por mês","description":"..."}]
 *   <<<END>>>
 *
 * We strip that block from the visible text and surface the parsed items as
 * suggestion cards the user can accept. Matching to an actual goal id happens
 * at accept-time in the caller (by goalTitle).
 */

export interface ParsedCheckpoint {
  goalTitle: string;
  title: string;
  description?: string;
}

export interface ParsedReply {
  /** Reply text with the checkpoint block removed. */
  text: string;
  /** Proposed checkpoints (empty if none). */
  checkpoints: ParsedCheckpoint[];
}

const BLOCK_RE = /<<<CHECKPOINTS>>>([\s\S]*?)<<<END>>>/i;

export function parseAIReply(raw: string): ParsedReply {
  const match = raw.match(BLOCK_RE);
  if (!match) return { text: raw.trim(), checkpoints: [] };

  const text = raw.replace(BLOCK_RE, "").trim();
  let checkpoints: ParsedCheckpoint[] = [];
  try {
    // The captured group may include stray ```json fences — strip them.
    const jsonStr = match[1].replace(/```json/gi, "").replace(/```/g, "").trim();
    const arr = JSON.parse(jsonStr);
    if (Array.isArray(arr)) {
      checkpoints = arr
        .filter((x) => x && typeof x.title === "string" && typeof x.goalTitle === "string")
        .map((x) => ({
          goalTitle: String(x.goalTitle).trim(),
          title: String(x.title).trim().slice(0, 120),
          description: x.description ? String(x.description).trim().slice(0, 300) : undefined,
        }))
        .slice(0, 6); // sanity cap
    }
  } catch (err) {
    console.warn("Failed to parse checkpoint block:", err);
  }

  return { text, checkpoints };
}
