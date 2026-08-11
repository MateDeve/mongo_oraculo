/**
 * Plain-language descriptions of the structured collections, fed to the model
 * so it generates better MongoDB pipelines. This is a PROMPT AID, not a gate:
 * it improves query quality; it does not validate or restrict anything.
 *
 * ---------------------------------------------------------------------------
 * ADAPTING THIS FILE TO YOUR DATA
 *
 * This is the highest-leverage file for a structured or hybrid team. The model
 * writes its pipeline from this text alone; it never sees your documents. A
 * vague description here produces confidently wrong answers, which is the
 * failure mode that costs the most time to notice.
 *
 * Replace ACTIVITY_EVENTS_DESCRIPTION with your own, and cover five things:
 *
 * 1. One line saying what a single document IS. "One document per support
 *    ticket" tells the model whether to count documents or group them.
 * 2. Every field the model may need, with its type. Call out Date fields and
 *    anything stored differently from how people say it: cents vs dollars,
 *    seconds vs milliseconds, ids vs display names.
 * 3. Enum values verbatim. The model cannot guess that you write "IN_PROGRESS"
 *    and not "in progress", and a wrong literal silently matches nothing.
 * 4. Guidance mapping the questions you actually expect to the fields that
 *    answer them. "Open tickets" means status in X and Y, not resolvedAt null.
 *    Two or three of these are worth more than any amount of field detail.
 * 5. The traps. Anything where the obvious pipeline is wrong: soft-deleted rows
 *    that must be filtered out, a status that looks final but is not, a field
 *    that is null for a whole class of records.
 *
 * Write it for a competent new colleague who has never seen your data. If a
 * sentence would not help them, it will not help the model.
 *
 * The Phase 1 prompts have Claude Code write this for you. Read what it wrote:
 * it can infer 1 through 3 from your data, but only your team knows 4 and 5.
 * ---------------------------------------------------------------------------
 *
 * The enums here are the single source of truth, imported by the synthetic data
 * generator so the data and the description never drift.
 *
 * BILINGUAL NOTE: this description stays in English in every language, on
 * purpose, not by oversight. It is almost entirely field names, enum values, and
 * pipeline guidance; models read it fine cross-lingually, and translating it
 * would risk drifting against the generator that imports these enums. Only the
 * surrounding prompt prose in src/query/prompts/ is localised, which is enough
 * to get a Spanish `explanation` back.
 */

export const PRODUCTOS = ["EDUCATIVO", "VEHICULO", "CONSUMO", "MOTO"] as const;
export type Producto = (typeof PRODUCTOS)[number];

export const CANALES = [
  "INDEPENDIENTE Y COMERCIALIZADORA",
  "RENTING",
  "DIRECTO",
  "BROKERS",
  "BANCOLOMBIA",
  "CONCESIONARIO",
  "DIGITAL",
  "ALIADO",
] as const;
export type Canal = (typeof CANALES)[number];

export const REGIONALES = ["CENTRO", "SUR", "DIGITAL", "BOGOTA", "ANTIOQUIA", "CARIBE"] as const;
export type Regional = (typeof REGIONALES)[number];

export const NUEVO_USADO = ["Nuevo", "Usado", "Reutilizacion"] as const;
export type NuevoUsado = (typeof NUEVO_USADO)[number];

const DESEMBOLSOS_DESCRIPTION = `Collection: desembolsos_oraculo
One document per pre-aggregated disbursement group. Each row is NOT a single credit —
it is the rolled-up total for a unique combination of categorical fields (product,
channel, city, campaign, etc.) for one disbursement period. Always aggregate the
numeric fields; never count documents as if they were individual credits.

Fields:
  _id                          string   stable id like "dsb_0001"
  fecha_desemb                 string   disbursement period in YYYYMM format.
                                        "202608" = August 2026. STRING, not a Date.
  producto                     string   one of: ${PRODUCTOS.join(", ")}
  canal_recalculado            string   commercial channel; one of: ${CANALES.join(", ")}
  categoria                    string   product category; e.g. CREDITO, LEASING, MOTO, CONSUMO, CELULARES,
                                        VEHICULOS, "CREDITO VEHICULO NUEVO", REESTRUCTURADO_VEHICULOS
  subcategoria                 string   sub-category; e.g. PREGRADO, POSTGRADO, MOTO_GAMA_ALTA,
                                        MOTO_GAMA_MEDIA, VEHICULOS, CREDITO_PARA_ESTUDIAR, SMARTPHONES
  ciudad                       string   city name, or empty string when unknown
  regional                     string   geographic zone; one of: ${REGIONALES.join(", ")}
  feria                        string   campaign/fair code, or empty string when none
  nuevo_usado                  string   asset condition: "Nuevo", "Usado", "Reutilizacion",
                                        or empty string for products where it does not apply
  total_creditos_desembolsados number   count of individual credits in this group (positive integer)
  valor_total_desembolsado     number   total disbursed in full Colombian pesos (COP), NOT cents.
                                        4986053190 means COP 4,986,053,190.
  plazo_promedio               number   average loan term in months for credits in this group (may be
                                        decimal, e.g. 61.30). Do NOT sum across records.

Guidance for pipelines:
  - "how much was disbursed / monto desembolsado?" => {$sum: "$valor_total_desembolsado"}
  - "how many credits / cuántos créditos?" => {$sum: "$total_creditos_desembolsados"} NOT {$count:{}}
  - "average term / plazo promedio ponderado?" => weighted average:
      {$divide: [{$sum: {$multiply: ["$plazo_promedio","$total_creditos_desembolsados"]}},
                 {$sum: "$total_creditos_desembolsados"}]}
  - "by channel / por canal?" => $group on canal_recalculado
  - "by period / por mes?" => $match or $group on fecha_desemb; current month = "202608",
      previous month = "202607". Lexicographic order on YYYYMM strings is chronological.
  - "top / ranking?" => $group → $sort descending → $limit 1 (or N)
  - fecha_desemb is a STRING. Use {"$gte": "202601"} for range filters.
      Never use $dateTrunc, $dateFromString, or $$NOW with this field.

Traps:
  - plazo_promedio is already an average per group — summing it is meaningless.
      For a cross-group average, weight by total_creditos_desembolsados.
  - valor_total_desembolsado is in full COP, not centavos. Never divide by 100.
  - Empty string ("") in ciudad, feria, or nuevo_usado means "no data available".
      It is not a valid category value. Filter with {"$ne": ""} when you want
      only records that actually have that field populated.
  - One document ≠ one credit. $count counts rows, not credits. Always $sum
      total_creditos_desembolsados for a credit count.`;

/**
 * Return a plain-language description of the target collection for the query
 * prompt. Unknown collections get a generic note so teams can point the tool at
 * their own data without editing this file first.
 */
export function describeCollection(name: string): string {
  if (name === "desembolsos_oraculo") return DESEMBOLSOS_DESCRIPTION;
  // Falling through to this generic note means the model is guessing at your
  // fields. It usually still answers, which is exactly why this is easy to miss.
  // Register your collection above, following the checklist at the top.
  return `Collection: ${name}\n(No schema description registered. Infer fields and types from the question; prefer a conservative read-only pipeline.)`;
}
