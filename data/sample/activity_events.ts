import {
  PRODUCTOS,
  CANALES,
  REGIONALES,
  NUEVO_USADO,
  type Producto,
  type Canal,
  type Regional,
} from "../../src/query/schema";

/**
 * Synthetic, internally consistent disbursement records for `desembolsos_oraculo`.
 *
 * Deterministic: a fixed seed produces the same dataset every run, so the
 * verify script can assert exact answers. Four anchor records are injected for
 * the three verifiable facts defined in collection.md, and consistency
 * assertions run before returning. If any assertion fails, load must not proceed.
 *
 * All values are synthetic. Amounts are in full COP (not cents).
 */

export interface Desembolso {
  _id: string;
  fecha_desemb: string;
  producto: Producto;
  canal_recalculado: Canal;
  categoria: string;
  subcategoria: string;
  ciudad: string;
  regional: Regional;
  feria: string;
  nuevo_usado: string;
  total_creditos_desembolsados: number;
  valor_total_desembolsado: number;
  plazo_promedio: number;
}

// ---------------------------------------------------------------------------
// Enum value sets used for filler generation
// ---------------------------------------------------------------------------

const CIUDADES = [
  "BOGOTA", "MEDELLIN", "CALI", "BARRANQUILLA", "BUCARAMANGA",
  "CARTAGENA", "IBAGUE", "MANIZALES", "PEREIRA", "CUCUTA",
  "VILLAVICENCIO", "PASTO", "NEIVA", "SANTA MARTA", "MONTERIA", "",
] as const;

// Valid categoria/subcategoria per producto, and whether nuevo_usado applies.
const PRODUCT_HIERARCHY = {
  VEHICULO: {
    categorias: ["CREDITO", "LEASING", "CREDITO VEHICULO NUEVO", "REESTRUCTURADO_VEHICULOS"],
    subcategorias: ["CREDITO", "VEHICULOS", "LEASING"],
    nuevoUsadoApplies: true,
    plazMin: 60,
    plazRange: 16, // 60–75
    valorMin: 800_000_000,
    valorRange: 4_200_000_000,
    creditMin: 10,
    creditRange: 91,
  },
  EDUCATIVO: {
    categorias: ["CREDITO"],
    subcategorias: ["PREGRADO", "POSTGRADO", "IDIOMAS Y EDUCACION CONTINUA", "CREDITO_PARA_ESTUDIAR"],
    nuevoUsadoApplies: false,
    plazMin: 36,
    plazRange: 25, // 36–60
    valorMin: 100_000_000,
    valorRange: 900_000_000,
    creditMin: 20,
    creditRange: 81,
  },
  CONSUMO: {
    categorias: ["CONSUMO", "CELULARES"],
    subcategorias: ["CREDITO", "SMARTPHONES"],
    nuevoUsadoApplies: false,
    plazMin: 24,
    plazRange: 25, // 24–48
    valorMin: 80_000_000,
    valorRange: 720_000_000,
    creditMin: 10,
    creditRange: 71,
  },
  MOTO: {
    categorias: ["MOTO"],
    subcategorias: ["MOTO_GAMA_ALTA", "MOTO_GAMA_MEDIA", "MOTO"],
    nuevoUsadoApplies: true,
    plazMin: 12,
    plazRange: 25, // 12–36
    valorMin: 30_000_000,
    valorRange: 270_000_000,
    creditMin: 5,
    creditRange: 46,
  },
} as const satisfies Record<Producto, {
  categorias: readonly string[];
  subcategorias: readonly string[];
  nuevoUsadoApplies: boolean;
  plazMin: number;
  plazRange: number;
  valorMin: number;
  valorRange: number;
  creditMin: number;
  creditRange: number;
}>;

// ---------------------------------------------------------------------------
// Anchor constants — must dominate over any filler accumulation
// ---------------------------------------------------------------------------

const SEED = 424242;
const FILLER_COUNT = 496; // + 4 anchors = 500 total

/** Filler amounts stay well below anchor values so rank assertions hold. */
const FILLER_VALOR_MAX = 5_000_000_000; // 5B COP per filler record

/** Verifiable fact 1: BANCOLOMBIA leads by value in current month. */
const ANCHOR_A1_VALOR = 100_000_000_000; // 100B COP (>>max possible filler per canal-month)
/** Verifiable fact 1: DIRECTO leads by value in previous month. */
const ANCHOR_A2_VALOR = 120_000_000_000; // 120B COP > A1

/** Verifiable fact 2: ANTIOQUIA leads by credits in current month. */
const ANCHOR_A3_CREDITS = 2000;
/** Verifiable fact 2: BOGOTA leads by credits in previous month. */
const ANCHOR_A4_CREDITS = 2500; // > A3

const CURRENT_MONTH = "202608";
const PREV_MONTH = "202607";

// 20 months of filler data: Jan 2025 – Aug 2026
const FILLER_MONTHS = [
  "202501", "202502", "202503", "202504", "202505",
  "202506", "202507", "202508", "202509", "202510",
  "202511", "202512", "202601", "202602", "202603",
  "202604", "202605", "202606", "202607", "202608",
] as const;

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick from empty array");
  return item;
}

function randInt(rng: () => number, min: number, range: number): number {
  return min + Math.floor(rng() * range);
}

// ---------------------------------------------------------------------------
// Filler builder
// ---------------------------------------------------------------------------

function buildFiller(rng: () => number): Omit<Desembolso, "_id">[] {
  const records: Omit<Desembolso, "_id">[] = [];

  for (let i = 0; i < FILLER_COUNT; i++) {
    const producto = pick(rng, PRODUCTOS);
    const h = PRODUCT_HIERARCHY[producto];
    const categoria = pick(rng, h.categorias);
    const subcategoria = pick(rng, h.subcategorias);
    const canal_recalculado = pick(rng, CANALES);
    const regional = pick(rng, REGIONALES);
    const ciudad = pick(rng, CIUDADES);
    const fecha_desemb = pick(rng, FILLER_MONTHS);
    const feria = rng() < 0.08 ? pick(rng, ["VDMELI", "FMOTO26", "FSALUD", "FDIGITAL"]) : "";
    const nuevo_usado = h.nuevoUsadoApplies ? pick(rng, NUEVO_USADO) : "";

    const plazo_promedio = h.plazMin + rng() * h.plazRange;
    const total_creditos_desembolsados = randInt(rng, h.creditMin, h.creditRange);
    // Cap filler valor well below anchor thresholds.
    const rawValor = h.valorMin + rng() * h.valorRange;
    const valor_total_desembolsado = Math.round(Math.min(rawValor, FILLER_VALOR_MAX));

    records.push({
      fecha_desemb,
      producto,
      canal_recalculado,
      categoria,
      subcategoria,
      ciudad,
      regional,
      feria,
      nuevo_usado,
      total_creditos_desembolsados,
      valor_total_desembolsado,
      plazo_promedio,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Full dataset builder (filler + anchors + stable IDs)
// ---------------------------------------------------------------------------

function buildRecords(): Desembolso[] {
  const rng = mulberry32(SEED);
  const filler = buildFiller(rng);

  // Anchor A1 — verifiable fact 1 (current month): BANCOLOMBIA leads by value.
  const a1: Omit<Desembolso, "_id"> = {
    fecha_desemb: CURRENT_MONTH,
    producto: "VEHICULO",
    canal_recalculado: "BANCOLOMBIA",
    categoria: "CREDITO",
    subcategoria: "VEHICULOS",
    ciudad: "BOGOTA",
    regional: "BOGOTA",
    feria: "",
    nuevo_usado: "Nuevo",
    total_creditos_desembolsados: 150,
    valor_total_desembolsado: ANCHOR_A1_VALOR,
    plazo_promedio: 72,
  };

  // Anchor A2 — verifiable fact 1 (previous month): DIRECTO leads by value.
  // Also ensures BANCOLOMBIA is NOT the leader in the previous month.
  const a2: Omit<Desembolso, "_id"> = {
    fecha_desemb: PREV_MONTH,
    producto: "VEHICULO",
    canal_recalculado: "DIRECTO",
    categoria: "CREDITO VEHICULO NUEVO",
    subcategoria: "VEHICULOS",
    ciudad: "MEDELLIN",
    regional: "ANTIOQUIA",
    feria: "",
    nuevo_usado: "Nuevo",
    total_creditos_desembolsados: 180,
    valor_total_desembolsado: ANCHOR_A2_VALOR,
    plazo_promedio: 71,
  };

  // Anchor A3 — verifiable fact 2 (current month): ANTIOQUIA leads by credits.
  const a3: Omit<Desembolso, "_id"> = {
    fecha_desemb: CURRENT_MONTH,
    producto: "CONSUMO",
    canal_recalculado: "DIGITAL",
    categoria: "CONSUMO",
    subcategoria: "CREDITO",
    ciudad: "MEDELLIN",
    regional: "ANTIOQUIA",
    feria: "",
    nuevo_usado: "",
    total_creditos_desembolsados: ANCHOR_A3_CREDITS,
    valor_total_desembolsado: 1_200_000_000,
    plazo_promedio: 36,
  };

  // Anchor A4 — verifiable fact 2 (previous month): BOGOTA leads by credits.
  // Also ensures BOGOTA has > ANTIOQUIA credits in previous month.
  const a4: Omit<Desembolso, "_id"> = {
    fecha_desemb: PREV_MONTH,
    producto: "CONSUMO",
    canal_recalculado: "BANCOLOMBIA",
    categoria: "CONSUMO",
    subcategoria: "CREDITO",
    ciudad: "BOGOTA",
    regional: "BOGOTA",
    feria: "",
    nuevo_usado: "",
    total_creditos_desembolsados: ANCHOR_A4_CREDITS,
    valor_total_desembolsado: 1_500_000_000,
    plazo_promedio: 36,
  };

  // Sort by fecha_desemb then by canal_recalculado for a stable ordering,
  // then assign sequential ids so _id values are deterministic across runs.
  const all = [...filler, a1, a2, a3, a4];
  all.sort((x, y) => {
    const d = x.fecha_desemb.localeCompare(y.fecha_desemb);
    return d !== 0 ? d : x.canal_recalculado.localeCompare(y.canal_recalculado);
  });

  return all.map((r, i) => ({ _id: `dsb_${String(i + 1).padStart(4, "0")}`, ...r }));
}

// ---------------------------------------------------------------------------
// Expectations
// ---------------------------------------------------------------------------

export interface Expectations {
  totalRecords: number;
  currentMonth: string;
  previousMonth: string;
  topCanalByValorCurrentMonth: { canal: string; total: number };
  topCanalByValorPreviousMonth: { canal: string; total: number };
  topRegionalByCreditsCurrentMonth: { regional: string; total: number };
  topRegionalByCreditsPreviousMonth: { regional: string; total: number };
  highestPlazoPorProducto: { producto: string; weightedAvgPlazo: number };
  lowestPlazoPorProducto: { producto: string; weightedAvgPlazo: number };
  anchorRecordId: string; // BANCOLOMBIA anchor, for hybrid assess test
}

function groupSum(
  records: Desembolso[],
  filter: (r: Desembolso) => boolean,
  keyFn: (r: Desembolso) => string,
  valueFn: (r: Desembolso) => number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!filter(r)) continue;
    const k = keyFn(r);
    map.set(k, (map.get(k) ?? 0) + valueFn(r));
  }
  return map;
}

function maxEntry(map: Map<string, number>): [string, number] {
  let maxKey: string | undefined;
  let maxVal = -Infinity;
  for (const [k, v] of map) {
    if (v > maxVal) {
      maxVal = v;
      maxKey = k;
    }
  }
  if (maxKey === undefined) throw new Error("maxEntry called on empty map");
  return [maxKey, maxVal];
}

export function computeExpectations(records: Desembolso[]): Expectations {
  const canalValorCurrent = groupSum(
    records,
    (r) => r.fecha_desemb === CURRENT_MONTH,
    (r) => r.canal_recalculado,
    (r) => r.valor_total_desembolsado,
  );
  const canalValorPrev = groupSum(
    records,
    (r) => r.fecha_desemb === PREV_MONTH,
    (r) => r.canal_recalculado,
    (r) => r.valor_total_desembolsado,
  );
  const regionalCreditsCurrent = groupSum(
    records,
    (r) => r.fecha_desemb === CURRENT_MONTH,
    (r) => r.regional,
    (r) => r.total_creditos_desembolsados,
  );
  const regionalCreditsPrev = groupSum(
    records,
    (r) => r.fecha_desemb === PREV_MONTH,
    (r) => r.regional,
    (r) => r.total_creditos_desembolsados,
  );

  // Weighted-average plazo per producto across all months.
  const plazSumWeighted = new Map<string, number>();
  const creditSumPerProducto = new Map<string, number>();
  for (const r of records) {
    const p = r.producto;
    plazSumWeighted.set(p, (plazSumWeighted.get(p) ?? 0) + r.plazo_promedio * r.total_creditos_desembolsados);
    creditSumPerProducto.set(p, (creditSumPerProducto.get(p) ?? 0) + r.total_creditos_desembolsados);
  }
  const plazAvg = new Map<string, number>();
  for (const [p, weightedSum] of plazSumWeighted) {
    const credits = creditSumPerProducto.get(p) ?? 1;
    plazAvg.set(p, weightedSum / credits);
  }
  const [topCanalCurrent, topCanalCurrentTotal] = maxEntry(canalValorCurrent);
  const [topCanalPrev, topCanalPrevTotal] = maxEntry(canalValorPrev);
  const [topRegionalCurrent, topRegionalCurrentTotal] = maxEntry(regionalCreditsCurrent);
  const [topRegionalPrev, topRegionalPrevTotal] = maxEntry(regionalCreditsPrev);
  const [highestPlazoProd, highestPlazAvgVal] = maxEntry(plazAvg);
  const lowestEntry = [...plazAvg.entries()].reduce((a, b) => (b[1] < a[1] ? b : a));

  const anchor = records.find(
    (r) => r.canal_recalculado === "BANCOLOMBIA" && r.fecha_desemb === CURRENT_MONTH && r.valor_total_desembolsado === ANCHOR_A1_VALOR,
  );
  if (!anchor) throw new Error("Anchor A1 (BANCOLOMBIA current month) missing from generated records.");

  return {
    totalRecords: records.length,
    currentMonth: CURRENT_MONTH,
    previousMonth: PREV_MONTH,
    topCanalByValorCurrentMonth: { canal: topCanalCurrent, total: topCanalCurrentTotal },
    topCanalByValorPreviousMonth: { canal: topCanalPrev, total: topCanalPrevTotal },
    topRegionalByCreditsCurrentMonth: { regional: topRegionalCurrent, total: topRegionalCurrentTotal },
    topRegionalByCreditsPreviousMonth: { regional: topRegionalPrev, total: topRegionalPrevTotal },
    highestPlazoPorProducto: { producto: highestPlazoProd, weightedAvgPlazo: highestPlazAvgVal },
    lowestPlazoPorProducto: { producto: lowestEntry[0], weightedAvgPlazo: lowestEntry[1] },
    anchorRecordId: anchor._id,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Generate the synthetic disbursements and assert internal consistency.
 * Throws if any assertion fails so callers never load bad data.
 */
export function generateActivityEvents(): Desembolso[] {
  const records = buildRecords();
  const exp = computeExpectations(records);

  // Fact 1a: BANCOLOMBIA leads by value in current month.
  if (exp.topCanalByValorCurrentMonth.canal !== "BANCOLOMBIA") {
    throw new Error(
      `Expected BANCOLOMBIA to lead current-month value; got ${exp.topCanalByValorCurrentMonth.canal}.`,
    );
  }

  // Fact 1b: DIRECTO leads by value in previous month (filter matters).
  if (exp.topCanalByValorPreviousMonth.canal !== "DIRECTO") {
    throw new Error(
      `Expected DIRECTO to lead previous-month value; got ${exp.topCanalByValorPreviousMonth.canal}.`,
    );
  }
  if (exp.topCanalByValorPreviousMonth.total <= exp.topCanalByValorCurrentMonth.total) {
    throw new Error("Previous-month top-canal total must exceed current-month total so the month filter matters.");
  }

  // Fact 2a: ANTIOQUIA leads by credits in current month.
  if (exp.topRegionalByCreditsCurrentMonth.regional !== "ANTIOQUIA") {
    throw new Error(
      `Expected ANTIOQUIA to lead current-month credits; got ${exp.topRegionalByCreditsCurrentMonth.regional}.`,
    );
  }

  // Fact 2b: BOGOTA leads by credits in previous month.
  if (exp.topRegionalByCreditsPreviousMonth.regional !== "BOGOTA") {
    throw new Error(
      `Expected BOGOTA to lead previous-month credits; got ${exp.topRegionalByCreditsPreviousMonth.regional}.`,
    );
  }

  // Fact 3: VEHICULO has the highest weighted average plazo.
  if (exp.highestPlazoPorProducto.producto !== "VEHICULO") {
    throw new Error(
      `Expected VEHICULO to have highest avg plazo; got ${exp.highestPlazoPorProducto.producto}.`,
    );
  }

  // Consistency rules: no negative values, no zero-credit records with positive value.
  for (const r of records) {
    if (r.total_creditos_desembolsados < 0)
      throw new Error(`Negative total_creditos_desembolsados in ${r._id}`);
    if (r.valor_total_desembolsado < 0)
      throw new Error(`Negative valor_total_desembolsado in ${r._id}`);
    if (r.plazo_promedio <= 0)
      throw new Error(`Non-positive plazo_promedio in ${r._id}`);
    if (r.total_creditos_desembolsados > 0 && r.valor_total_desembolsado === 0)
      throw new Error(`Credits > 0 but valor = 0 in ${r._id}`);
    if (!PRODUCTOS.includes(r.producto))
      throw new Error(`Unknown producto "${r.producto}" in ${r._id}`);
    if (!CANALES.includes(r.canal_recalculado))
      throw new Error(`Unknown canal "${r.canal_recalculado}" in ${r._id}`);
    if (!REGIONALES.includes(r.regional))
      throw new Error(`Unknown regional "${r.regional}" in ${r._id}`);
  }

  return records;
}
