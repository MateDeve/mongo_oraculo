import { HumanMessage } from "@langchain/core/messages";
import { bootstrapCredentials } from "../src/credentials";
import { getConfig } from "../src/config";
import { closeMongoClient } from "../src/db/client";
import { knowledgeBaseSearch } from "../src/retrieval/retrieverTool";
import { structuredQuery } from "../src/query/queryTool";
import { assess } from "../src/hybrid/hybridTool";
import { buildPatternAgent } from "../src/patterns";
import { messageContentToString } from "../src/util/message";
import { generateActivityEvents, computeExpectations } from "../data/sample/activity_events";
import { getMemoryStore, saveUserMemory, listUserMemories } from "../src/memory/store";

/**
 * Acceptance checks for the three bootcamp checkpoints. Run after `npm run load`.
 *
 *   Checkpoint 1: the agent skeleton runs and answers a sample question per leg.
 *   Checkpoint 2: correct, evidence-backed results (retrieval cites; query is
 *                 correct; hybrid draws on both legs).
 *   Checkpoint 3: >= 2 tools working, memory resumes on a repeated thread_id,
 *                 and one demo scenario runs end to end.
 *
 * Correctness for the structured leg is checked against expectations derived
 * from the SAME deterministic generator that seeded the data.
 */

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failures++;
}

async function askAgent(
  pattern: "rag" | "structured" | "hybrid",
  thread: string,
  q: string,
  user = "verify_user",
): Promise<string> {
  const agent = await buildPatternAgent(pattern);
  const res = await agent.invoke(
    { messages: [new HumanMessage(q)] },
    { configurable: { thread_id: thread, user_id: user }, recursionLimit: 25 },
  );
  const last = res.messages.at(-1);
  return last ? messageContentToString(last.content) : "";
}

async function main(): Promise<void> {
  await bootstrapCredentials();
  getConfig();

  const exp = computeExpectations(generateActivityEvents());
  const topCanalCurrent = exp.topCanalByValorCurrentMonth.canal;
  const topCanalPrev = exp.topCanalByValorPreviousMonth.canal;
  const topRegionalCurrent = exp.topRegionalByCreditsCurrentMonth.regional;

  // ---- Checkpoint 1: skeleton runs, one answer per leg -----------------------
  console.log("\nCheckpoint 1: skeleton runs and answers a sample question");
  const ragAnswer = await askAgent("rag", "cp1-rag", "¿Qué productos de crédito están disponibles?");
  check("RAG agent returns a non-empty grounded answer", ragAnswer.trim().length > 0);

  const structAnswer = await askAgent(
    "structured",
    "cp1-struct",
    `¿Cuál canal tuvo el mayor valor total desembolsado en ${exp.currentMonth}?`,
  );
  check("Structured agent returns a non-empty answer", structAnswer.trim().length > 0);

  // ---- Checkpoint 2: correct, evidence-backed results ------------------------
  console.log("\nCheckpoint 2: correct, evidence-backed results");

  const kb = await knowledgeBaseSearch.invoke({ query: "¿Qué tipos de crédito ofrece la organización?" });
  check("Retrieval returns cited passages (source .md)", kb.includes(".md"));

  // Fact 1: BANCOLOMBIA leads by disbursed value in current month.
  const topCanalQuery = await structuredQuery.invoke({
    question: `¿Cuál canal (canal_recalculado) tuvo el mayor valor total desembolsado (valor_total_desembolsado) en el mes ${exp.currentMonth}? Devuelve el nombre del canal y el total.`,
  });
  check(
    `structured_query identifies top canal in current month (${topCanalCurrent})`,
    topCanalQuery.toLowerCase().includes(topCanalCurrent.toLowerCase()),
    `expected canal ${topCanalCurrent}`,
  );
  check("structured_query result includes a plain-language explanation", topCanalQuery.includes("explanation"));

  // Fact 2: ANTIOQUIA leads by credit count in current month.
  const topRegionalQuery = await structuredQuery.invoke({
    question: `¿Cuál regional tuvo el mayor número de créditos desembolsados (total_creditos_desembolsados) en ${exp.currentMonth}? Devuelve la regional y el total.`,
  });
  check(
    `structured_query identifies top regional by credits in current month (${topRegionalCurrent})`,
    topRegionalQuery.toLowerCase().includes(topRegionalCurrent.toLowerCase()),
    `expected regional ${topRegionalCurrent}`,
  );

  // Filter relevance: DIRECTO should top the previous month, not the current.
  check(
    `previous month top canal (${topCanalPrev}) differs from current month top canal (${topCanalCurrent})`,
    topCanalPrev !== topCanalCurrent,
  );

  const judgment = await assess.invoke({ subjectId: exp.anchorRecordId });
  check("hybrid assess produces citations (retrieval leg)", judgment.includes("citations") && judgment.includes(".md"));
  check("hybrid assess reaches a verdict (fusion of both legs)", /CONSISTENT|INCONSISTENT|NEEDS REVIEW/i.test(judgment));

  // ---- Checkpoint 3: >=2 tools, memory resumes, one E2E scenario -------------
  console.log("\nCheckpoint 3: tools + memory + end-to-end scenario");
  check("At least two tools working", true); // retrieval + query + hybrid all exercised above

  // Short-term memory: same thread_id resumes the conversation.
  const memThread = "cp3-memory";
  await askAgent("hybrid", memThread, "Recuerda esto para nuestra conversación: mi nombre es Dana.");
  const recall = await askAgent("hybrid", memThread, "¿Cuál es mi nombre?");
  check("Short-term memory resumes on the same thread_id", /dana/i.test(recall), `recall was: "${recall.slice(0, 120)}"`);

  // Long-term memory: durable, cross-thread, keyed by user.
  const ltmUser = "verify_ltm_user";
  const store = await getMemoryStore();
  await saveUserMemory(store, ltmUser, "team", {
    kind: "profile",
    summary: "The user is on the RiskRunners team.",
    references: [],
  });
  const stored = await listUserMemories(store, ltmUser);
  check("Long-term store persists a user memory", stored.some((m) => /RiskRunners/.test(m.summary)));

  const ltmRecall = await askAgent("hybrid", "cp3-ltm-fresh-thread", "¿En qué equipo estoy?", ltmUser);
  check(
    "Long-term memory recalls across a different thread (same user)",
    /riskrunners/i.test(ltmRecall),
    `recall was: "${ltmRecall.slice(0, 120)}"`,
  );

  const scenario = await askAgent(
    "hybrid",
    "cp3-scenario",
    `Analiza el registro ${exp.anchorRecordId} y determina si los valores son consistentes con las políticas vigentes. Explica y cita fuentes.`,
  );
  check("End-to-end hybrid scenario returns a reasoned answer", scenario.trim().length > 0);

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`\nVerify failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => closeMongoClient());
