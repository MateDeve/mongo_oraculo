import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getDb } from "../db/client";
import { getConfig } from "../config";

/**
 * Agrupa y rankea desembolsos por una dimensión categórica.
 * Usa la colección desembolsos_oraculo directamente con un pipeline de
 * $group + $sort + $limit, sin pasar por el modelo generador de pipelines.
 */
export const desembolsoResumen = tool(
  async ({ dimension, fecha_inicio, fecha_fin, metrica, top_n }): Promise<string> => {
    const db = await getDb();
    const cfg = getConfig();

    const match: Record<string, unknown> = {};
    if (fecha_inicio || fecha_fin) {
      const range: Record<string, string> = {};
      if (fecha_inicio) range["$gte"] = fecha_inicio;
      if (fecha_fin) range["$lte"] = fecha_fin;
      match["fecha_desemb"] = range;
    }

    const sortField = metrica === "creditos" ? "total_creditos" : "total_valor";
    const limit = top_n ?? 10;

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

    const resultados = rows.map((r) => ({
      [dimension]: r._id ?? "(vacío)",
      total_creditos: r.total_creditos as number,
      valor_total_cop: r.total_valor as number,
      valor_billones: ((r.total_valor as number) / 1_000_000_000).toFixed(2),
    }));

    return JSON.stringify({
      dimension,
      metrica: metrica ?? "valor",
      periodo: fecha_inicio || fecha_fin ? `${fecha_inicio ?? "inicio"} – ${fecha_fin ?? "fin"}` : "todos los períodos",
      resultados,
    });
  },
  {
    name: "desembolso_resumen",
    description:
      "Rankea los desembolsos de la colección desembolsos_oraculo agrupados por una dimensión: " +
      "producto, regional, canal_recalculado o ciudad. " +
      "Útil para '¿qué canal desembolsó más?', 'ranking de regionales por créditos', " +
      "'top productos del mes'. Filtra por período en formato YYYYMM (ej. '202601').",
    schema: z.object({
      dimension: z
        .enum(["producto", "regional", "canal_recalculado", "ciudad"])
        .describe("Dimensión por la cual agrupar: producto, regional, canal_recalculado o ciudad."),
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
        .describe("Ordenar por valor_total_desembolsado ('valor') o total_creditos_desembolsados ('creditos'). Default: valor."),
      top_n: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Cuántos resultados devolver. Default: 10."),
    }),
  },
);
