import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HumanMessage } from "@langchain/core/messages";
import { bootstrapCredentials } from "./credentials";
import { getConfig } from "./config";
import { buildPatternAgent, isPattern, type Pattern } from "./patterns";
import { closeMongoClient } from "./db/client";
import { messageContentToString } from "./util/message";
import type { Agent } from "./agent/graph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache agent promises per pattern so each is built at most once,
// and concurrent first-requests for the same pattern share the build.
const agentPromises = new Map<Pattern, Promise<Agent>>();

function getAgent(pattern: Pattern): Promise<Agent> {
  let promise = agentPromises.get(pattern);
  if (!promise) {
    promise = buildPatternAgent(pattern);
    agentPromises.set(pattern, promise);
  }
  return promise;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

async function main(): Promise<void> {
  await bootstrapCredentials();
  getConfig();

  const html = readFileSync(join(__dirname, "ui", "index.html"), "utf-8");
  const port = parseInt(process.env.PORT ?? "3000", 10);

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (method === "GET" && url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (method === "GET" && url === "/api/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (method === "POST" && url === "/api/chat") {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as Record<string, unknown>;
        const { pattern, threadId, userId, message } = body;

        if (typeof message !== "string" || !message.trim()) {
          sendJson(res, 400, { error: "message is required" });
          return;
        }
        if (typeof pattern !== "string" || !isPattern(pattern)) {
          sendJson(res, 400, { error: "Invalid pattern. Choose one of: rag, structured, hybrid" });
          return;
        }

        const agent = await getAgent(pattern);
        const result = await agent.invoke(
          { messages: [new HumanMessage(message.trim())] },
          {
            configurable: {
              thread_id: typeof threadId === "string" ? threadId : "demo",
              user_id: typeof userId === "string" ? userId : "user_demo",
            },
            recursionLimit: 25,
          },
        );

        const last = result.messages.at(-1);
        const answer = last ? messageContentToString(last.content) : "(no answer produced)";
        sendJson(res, 200, { answer });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 500, { error: message });
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`\n  MongoDB Agent Chat`);

    const participantId = process.env.INSTRUQT_PARTICIPANT_ID;
    const participantDns = process.env.INSTRUQT_PARTICIPANTS_DNS;
    const vmHostname = process.env.HOSTNAME ?? "bootcamp";

    if (participantId && participantDns) {
      console.log(`  ➜  https://${port}-${vmHostname}-${participantId}.${participantDns}`);
    } else {
      console.log(`  ➜  http://localhost:${port}`);
    }
    console.log();
  });

  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down…");
    server.close();
    await closeMongoClient();
    process.exit(0);
  };

  process.on("SIGINT",  () => { shutdown().catch(console.error); });
  process.on("SIGTERM", () => { shutdown().catch(console.error); });
}

main().catch((err: unknown) => {
  console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
 