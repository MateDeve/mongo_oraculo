import { buildAgent, type Agent } from "./agent/graph";
import { knowledgeBaseSearch } from "./retrieval/retrieverTool";
import { structuredQuery } from "./query/queryTool";
import { assess } from "./hybrid/hybridTool";
import { remember } from "./tools/memoryTools";
import { desembolsoResumen } from "./tools/desembolsoResumen";
import { desembolsoGrafica } from "./tools/desembolsoGrafica";
import type { AgentTool } from "./tools/registry";
import { RAG_PROMPT, STRUCTURED_PROMPT, HYBRID_PROMPT } from "./agent/prompts/index";

/**
 * Pattern selector: wires the right tools and system prompt for each of the
 * three supported agent patterns.
 *
 *   rag        -> document retrieval only
 *   structured -> MongoDB query only
 *   hybrid     -> both, plus the assess fusion tool (the flagship)
 */

export const PATTERNS = ["rag", "structured", "hybrid"] as const;
export type Pattern = (typeof PATTERNS)[number];

export function isPattern(value: string): value is Pattern {
  return (PATTERNS as readonly string[]).includes(value);
}

export function toolsForPattern(pattern: Pattern): AgentTool[] {
  // `remember` is cross-cutting: long-term memory applies to every pattern.
  switch (pattern) {
    case "rag":
      return [knowledgeBaseSearch, remember];
    case "structured":
      return [structuredQuery, remember];
    case "hybrid":
      return [knowledgeBaseSearch, structuredQuery, assess, desembolsoResumen, desembolsoGrafica, remember];
  }
}

export function promptForPattern(pattern: Pattern): string {
  switch (pattern) {
    case "rag":
      return RAG_PROMPT;
    case "structured":
      return STRUCTURED_PROMPT;
    case "hybrid":
      return HYBRID_PROMPT;
  }
}

/** Build a compiled agent for the given pattern. */
export function buildPatternAgent(pattern: Pattern): Promise<Agent> {
  return buildAgent(toolsForPattern(pattern), promptForPattern(pattern));
}
