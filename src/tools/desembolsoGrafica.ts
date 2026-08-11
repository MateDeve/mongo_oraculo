import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../db/client";
import { getConfig } from "../config";

const BAR_COLORS = [
  "#4F81BD", "#C0504D", "#9BBB59", "#8064A2", "#4BACC6",
  "#F79646", "#2C4770", "#7F3F00", "#3E5E1E", "#36464E",
];

function buildHtml(
  titulo: string,
  dimension: string,
  labels: string[],
  values: number[],
  metrica: "valor" | "creditos",
  periodo: string,
): string {
  const isValor = metrica === "valor";
  // Chart receives values in billones COP (valor) or unit créditos for readability.
  const chartData = isValor
    ? values.map((v) => (v / 1_000_000_000).toFixed(3))
    : values.map(String);
  const yAxisLabel = isValor ? "Billones COP" : "Número de créditos";
  const tooltipSuffix = isValor ? " B COP" : " créditos";
  const backgroundColors = JSON.stringify(labels.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]!));

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      padding: 32px 40px;
      max-width: 860px;
      width: 100%;
    }
    h1 { font-size: 1.25rem; color: #1a1a2e; margin-bottom: 4px; }
    .meta { font-size: 0.82rem; color: #888; margin-bottom: 28px; }
    .chart-wrap { position: relative; height: 380px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${titulo}</h1>
    <p class="meta">Agente Oráculos &middot; Desembolsos por <strong>${dimension}</strong> &middot; ${periodo}</p>
    <div class="chart-wrap">
      <canvas id="c"></canvas>
    </div>
  </div>
  <script>
    new Chart(document.getElementById('c'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: [{
          label: ${JSON.stringify(yAxisLabel)},
          data: ${JSON.stringify(chartData)},
          backgroundColor: ${backgroundColors},
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + Number(ctx.parsed.y).toLocaleString('es-CO', {minimumFractionDigits: 3}) + '${tooltipSuffix}'
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 13 } } },
          y: {
            beginAtZero: true,
            grid: { color: '#f0f0f0' },
            title: { display: true, text: '${yAxisLabel}', font: { size: 12 } },
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Genera un archivo HTML con una gráfica de barras de desembolsos.
 * Escribe el archivo en /tmp/ y devuelve la ruta para que el usuario lo abra.
 */
export const desembolsoGrafica = tool(
  async ({ dimension, fecha_inicio, fecha_fin, metrica, titulo, top_n }): Promise<string> => {
    const db = await getDb();
    const cfg = getConfig();

    const match: Record<string, unknown> = {};
    if (fecha_inicio || fecha_fin) {
      const range: Record<string, string> = {};
      if (fecha_inicio) range["$gte"] = fecha_inicio;
      if (fecha_fin) range["$lte"] = fecha_fin;
      match["fecha_desemb"] = range;
    }

    const efectivaMetrica = metrica ?? "valor";
    const sortField = efectivaMetrica === "creditos" ? "total_creditos" : "total_valor";
    const limit = top_n ?? 8;

    const pipeline = [
      ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
      {
        $group: {
          _id: `$${dimension}`,
          total_creditos: { $sum: "$total_creditos_desembolsados" },
          total_valor: { $sum: "$valor_total_desembolsado" },
        },
      },
      { $sort: { [sortField]: -1 } },
      { $limit: limit },
    ];

    const rows = await db.collection(cfg.EVENTS_COLLECTION).aggregate(pipeline).toArray();

    if (rows.length === 0) {
      return "No se encontraron datos para los filtros indicados.";
    }

    const labels = rows.map((r) => String(r._id ?? "(vacío)"));
    const values = rows.map((r) =>
      efectivaMetrica === "creditos" ? (r.total_creditos as number) : (r.total_valor as number),
    );

    const periodo =
      fecha_inicio || fecha_fin
        ? `${fecha_inicio ?? "inicio"} – ${fecha_fin ?? "fin"}`
        : "todos los períodos";

    const tituloFinal =
      titulo ??
      `Desembolsos por ${dimension} (${efectivaMetrica === "valor" ? "valor COP" : "número de créditos"})`;

    const html = buildHtml(tituloFinal, dimension, labels, values, efectivaMetrica, periodo);

    const filename = `desembolso_${dimension}_${Date.now()}.html`;
    const filePath = join(tmpdir(), filename);
    writeFileSync(filePath, html, "utf-8");

    return `Gráfica generada: ${filePath}\nAbre ese archivo en tu navegador para verla.\n\nResumen de datos:\n${labels.map((l, i) => `  ${l}: ${efectivaMetrica === "valor" ? "$" + (values[i]! / 1_000_000_000).toFixed(2) + " B COP" : values[i]!.toLocaleString("es-CO") + " créditos"}`).join("\n")}`;
  },
  {
    name: "desembolso_grafica",
    description:
      "Genera una gráfica de barras HTML con los desembolsos agrupados por una dimensión " +
      "(producto, regional, canal_recalculado o ciudad) y la guarda en /tmp/. " +
      "Úsala cuando el usuario pida 'mostrar', 'graficar', 'visualizar', 'ver una gráfica', " +
      "o 'chart' de los desembolsos. Devuelve la ruta del archivo y un resumen de los datos.",
    schema: z.object({
      dimension: z
        .enum(["producto", "regional", "canal_recalculado", "ciudad"])
        .describe("Dimensión para el eje X: producto, regional, canal_recalculado o ciudad."),
      fecha_inicio: z
        .string()
        .optional()
        .describe("Período inicial en formato YYYYMM, ej. '202601'. Opcional."),
      fecha_fin: z
        .string()
        .optional()
        .describe("Período final en formato YYYYMM, ej. '202612'. Opcional."),
      metrica: z
        .enum(["valor", "creditos"])
        .optional()
        .describe("Eje Y: valor_total_desembolsado en COP ('valor') o total_creditos_desembolsados ('creditos'). Default: valor."),
      top_n: z
        .number()
        .int()
        .min(1)
        .max(15)
        .optional()
        .describe("Número de barras a mostrar. Default: 8."),
      titulo: z
        .string()
        .optional()
        .describe("Título personalizado para la gráfica. Opcional."),
    }),
  },
);
