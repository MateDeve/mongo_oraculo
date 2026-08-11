import type { StructuredToolInterface } from "@langchain/core/tools";
import { knowledgeBaseSearch } from "../retrieval/retrieverTool";
import { structuredQuery } from "../query/queryTool";
import { assess } from "../hybrid/hybridTool";
import { desembolsoResumen } from "./desembolsoResumen";
import { desembolsoGrafica } from "./desembolsoGrafica";

/**
 * The tool registry. This is where a team plugs in its 2-3 business tools.
 *
 * To add a tool:
 *   1. Write it in its own file (copy src/tools/exampleBusinessTool.ts).
 *   2. Import it here.
 *   3. Add it to `allTools` below (or to a specific pattern in src/patterns.ts
 *      if it should only be available for one agent pattern).
 *
 * Example:
 *   import { exampleBusinessTool } from "./exampleBusinessTool";
 *   export const allTools = [knowledgeBaseSearch, structuredQuery, assess, exampleBusinessTool];
 */

export type AgentTool = StructuredToolInterface;

/** Every tool the scaffold ships with. */
export const allTools: AgentTool[] = [knowledgeBaseSearch, structuredQuery, assess, desembolsoResumen, desembolsoGrafica];

/** Lookup by tool name, handy for tests and the verify script. */
export const toolsByName: Record<string, AgentTool> = Object.fromEntries(
  allTools.map((t) => [t.name, t]),
);
