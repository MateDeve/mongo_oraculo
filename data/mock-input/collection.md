# My structured collection

Fill in every section below, then run **Option A** from `prompts/phase-1-foundation.md`. Replace the bracketed placeholders. Keep it short and concrete; this is the spec the generator is built from. A filled-in example (the shipped bank scenario) follows at the bottom for reference.

---

## Collection

- **Name:** `desembolsos_oraculo`  (must match `EVENTS_COLLECTION` in `.env`)
- **One document is:** un conjunto de desembolsos de créditos agrupados por variables categóricas
- **Approximate volume for the demo:** ~500 registros


## Fields

| Field | Type | Notes / units |
|---|---|---|
| `fecha_desemb` | `string` | Periodo correspondiente al desembolso en formato `YYYYMM`. Permite realizar análisis por mes de desembolso. Ejemplo: `202504`, que corresponde a abril de 2025. |
| `producto` | `string` | Producto principal asociado al registro o agrupación. Puede representar líneas como crédito educativo, vehículo, consumo o moto. Ejemplos: `EDUCATIVO`, `VEHICULO`, `CONSUMO`, `MOTO`|
| `canal_recalculado` | `string` | Canal comercial o fuente recalculada por donde se origina o clasifica la operación. Puede venir vacío si no se identifica canal. Ejemplos: `DIGITAL`, `DIRECTO`, `RENTING`, `BANCOLOMBIA`, `CONCESIONARIO`, `ALIADO`, `BROKERS`, `INDEPENDIENTE Y COMERCIALIZADORA` |
| `categoria` | `string` | Categoría general del producto, negocio o tipo de financiación. Ejemplos: `CREDITO`, `LEASING`, `MOTO`, `CONSUMO`, `VEHICULOS`, `CELULARES`, `CREDITO VEHICULO NUEVO`, `REESTRUCTURADO_VEHICULOS` |
| `subcategoria` | `string` | Subclasificación más detallada dentro de la categoría o producto. Ayuda a diferenciar líneas específicas como educación, moto o vehículos. Ejemplos: `SMARTPHONES`, `CREDITO_PARA_ESTUDIAR`, `MOTO_GAMA_ALTA`, `PREGRADO`, `POSTGRADO`, `VEHICULOS`, `IDIOMAS Y EDUCACION CONTINUA`, `MOTO` |
| `ciudad` | `string` | Ciudad asociada al desembolso. Puede venir vacía si no se tiene el dato. Ejemplos: `BOGOTA`, `MEDELLIN`, `CALI`, `BARRANQUILLA`, `VILLAVICENCIO`, `TUNJA`, `APARTADO`, `ARMENIA` |
| `regional` | `string` | Regional, zona o agrupación geográfica asociada al registro. Puede venir vacía si no está asignada. Ejemplos: `ANTIOQUIA`, `CENTRO`, `SUR`, `DIGITAL`, `BOGOTA`, `CARIBE`|
| `feria` | `string` | Código o identificador de feria, campaña o estrategia comercial. Cadena vacía si no aplica. Ejemplos: `VDMELI`, `FMOTO26`. |
| `nuevo_usado` | `string` | Estado del bien financiado (aplica principalmente a vehículos y motos). Cadena vacía si no aplica al producto. Ejemplos: `Nuevo`, `Usado`, `Reutilizacion` |
| `total_creditos_desembolsados` | `number` | Cantidad total de créditos desembolsados para la combinación de campos analizada. Entero positivo. Ejemplo: `4`. |
| `valor_total_desembolsado` | `number` | Valor total desembolsado en pesos colombianos (COP) enteros, no centavos. `320130000` significa COP 320,130,000. |
| `plazo_promedio` | `number` | Plazo promedio de los créditos en meses. Puede ser decimal. No se debe sumar entre registros. Ejemplo: `72` o `61.30`. |


## Jerarquía producto → categoría → subcategoría

Las combinaciones válidas son las siguientes. Una combinación fuera de esta tabla produce datos inconsistentes.

| `producto` | `categoria` válidas | `subcategoria` válidas |
|---|---|---|
| `VEHICULO` | `CREDITO`, `LEASING`, `CREDITO VEHICULO NUEVO`, `REESTRUCTURADO_VEHICULOS` | `CREDITO`, `VEHICULOS`, `LEASING` |
| `EDUCATIVO` | `CREDITO` | `PREGRADO`, `POSTGRADO`, `IDIOMAS Y EDUCACION CONTINUA`, `CREDITO_PARA_ESTUDIAR` |
| `CONSUMO` | `CONSUMO`, `CELULARES` | `CREDITO`, `SMARTPHONES` |
| `MOTO` | `MOTO` | `MOTO_GAMA_ALTA`, `MOTO_GAMA_MEDIA`, `MOTO` |


## Enums

List every field whose value comes from a fixed set, and the allowed values.

- `producto`: `EDUCATIVO`, `VEHICULO`, `CONSUMO`, `MOTO`
- `canal_recalculado`: `INDEPENDIENTE Y COMERCIALIZADORA`, `RENTING`, `DIRECTO`, `BROKERS`, `BANCOLOMBIA`, `CONCESIONARIO`, `DIGITAL`, `ALIADO`
- `categoria`: `CREDITO`, `LEASING`, `MOTO`, `CONSUMO`, `REESTRUCTURADO_VEHICULOS`, `CELULARES`, `VEHICULOS`, `CREDITO VEHICULO NUEVO`
- `subcategoria`: `SMARTPHONES`, `CREDITO_PARA_ESTUDIAR`, `MOTO_GAMA_ALTA`, `PREGRADO`, `VEHICULOS`, `POSTGRADO`, `MOTO_GAMA_MEDIA`, `IDIOMAS Y EDUCACION CONTINUA`, `CREDITO`, `LEASING`, `MOTO`
- `ciudad`: `VILLAVICENCIO`, `BOGOTA`, `TUNJA`, `APARTADO`, `ARMENIA`, `VALLEDUPAR`, `IBAGUE`, `CARTAGENA`, `BUCARAMANGA`, `MEDELLIN`, `CALI`, `BARRANQUILLA`, `PUERTO COLOMBIA`, `MANIZALES`, `YOPAL`, `PASTO`, `POPAYAN`, `MONTERIA`, `PEREIRA`, `CUCUTA`, `NEIVA`, `SANTA MARTA`
- `regional`: `CENTRO`, `SUR`, `DIGITAL`, `BOGOTA`, `ANTIOQUIA`, `CARIBE`
- `nuevo_usado`: `Nuevo`, `Usado`, `Reutilizacion`


## Units and conventions

- `valor_total_desembolsado`: pesos colombianos enteros (COP), no centavos. `320130000` significa COP 320,130,000.
- `fecha_desemb`: cadena en formato `YYYYMM`. `202608` es agosto de 2026.
- `plazo_promedio`: meses, puede ser decimal (float). No sumar entre registros; solo promediar ponderado si se necesita un valor agregado.
- `total_creditos_desembolsados`: entero positivo (conteo de créditos).
- Cadena vacía (`""`) en `ciudad`, `feria` o `nuevo_usado` significa "sin dato", no un valor válido del enum.


## Reglas de consistencia

- `fecha_desemb` debe tener el formato `YYYYMM` (año y mes).

- `total_creditos_desembolsados` no puede ser negativo.

- `valor_total_desembolsado` no puede ser negativo.

- `plazo_promedio` debe ser mayor que cero cuando existan créditos desembolsados.

- Si `total_creditos_desembolsados` es mayor que 0, entonces `valor_total_desembolsado` también debe ser mayor que 0.

- Los valores de `canal_recalculado`, `categoria`, `subcategoria`, `producto` y `regional` deben corresponder a valores válidos presentes en los datos.

- Los valores vacíos (por ejemplo, en `ciudad`) deben interpretarse como "sin información" y no como un valor válido.

- Los conteos deben calcularse utilizando `total_creditos_desembolsados`.

- Los montos desembolsados deben calcularse utilizando `valor_total_desembolsado`.

- El campo `plazo_promedio` representa un promedio y no debe sumarse entre registros.

- Las sumas, promedios, mínimos, máximos y demás agregaciones deben calcularse únicamente sobre los registros filtrados.

- Nunca se deben generar ni asumir regiones, canales, productos, ciudades o períodos que no existan en los datos proporcionados.

- Si ningún registro cumple los filtros solicitados, la respuesta debe indicar explícitamente que no se encontraron resultados.

- Las comparaciones entre regiones, productos, canales o períodos deben utilizar la misma lógica de cálculo y los mismos filtros.

- No se deben inferir valores faltantes ni realizar estimaciones cuando los datos no estén disponibles.

- Cuando la pregunta sea "¿cuánto se desembolsó?", debe utilizarse `valor_total_desembolsado`.

- Cuando la pregunta sea "¿cuántos créditos se desembolsaron?", debe utilizarse `total_creditos_desembolsados`.

- Cuando la pregunta haga referencia a plazos, duración o financiación promedio, debe utilizarse `plazo_promedio`.

- Cuando se solicite un ranking, un máximo, un mínimo o una comparación, el resultado debe calcularse únicamente a partir de los registros disponibles.


## Verifiable facts (the anchors)

The specific questions your demo will ask, each with the answer the data must make true. The generator seeds a record for each and asserts it before loading, so these are the questions you can safely demo.

- "¿Cuál canal tuvo el mayor valor desembolsado en el mes actual (`202608`)?" → El canal `BANCOLOMBIA` debe tener el mayor `valor_total_desembolsado` en `202608`, con COP 8,500,000,000. En el mes anterior (`202607`), el canal `DIRECTO` debe superar a `BANCOLOMBIA`, de modo que el filtro por `fecha_desemb` cambie el resultado y sea demostrable.
- "¿Cuál regional tiene el mayor número de créditos desembolsados en el mes actual (`202608`)?" → La regional `ANTIOQUIA` debe tener 120 créditos (`total_creditos_desembolsados`) en `202608`. La regional `BOGOTA` debe tener más de 120 créditos en `202607` pero menos en `202608`, de modo que el filtro de fecha sea determinante.
- "¿Cuál producto tiene el mayor plazo promedio en todos los períodos?" → El producto `VEHICULO` debe tener el mayor plazo promedio ponderado (~72 meses). El producto `CONSUMO` debe tener el menor (~36 meses), dejando una brecha clara que el agente puede citar.


## Sample records (hand-author 3 to 5)

Paste representative documents you write from scratch. These are mock, not exported; they anchor field shapes, realistic value ranges, and naming. JSON is easiest.

```json
[
  {
    "fecha_desemb": "202501",
    "canal_recalculado": "BANCOLOMBIA",
    "categoria": "CREDITO",
    "subcategoria": "CREDITO",
    "producto": "VEHICULO",
    "ciudad": "MEDELLIN",
    "regional": "ANTIOQUIA",
    "feria": "",
    "nuevo_usado": "Nuevo",
    "total_creditos_desembolsados": 36,
    "valor_total_desembolsado": 4986053190,
    "plazo_promedio": 67
  },
  {
    "fecha_desemb": "202507",
    "canal_recalculado": "DIRECTO",
    "categoria": "CREDITO",
    "subcategoria": "CREDITO",
    "producto": "VEHICULO",
    "ciudad": "",
    "regional": "ANTIOQUIA",
    "feria": "",
    "nuevo_usado": "Usado",
    "total_creditos_desembolsados": 37,
    "valor_total_desembolsado": 2959095680,
    "plazo_promedio": 61.2972972972973
  },
  {
    "fecha_desemb": "202506",
    "canal_recalculado": "DIGITAL",
    "categoria": "CREDITO",
    "subcategoria": "PREGRADO",
    "producto": "EDUCATIVO",
    "ciudad": "BOGOTA",
    "regional": "BOGOTA",
    "feria": "",
    "nuevo_usado": "",
    "total_creditos_desembolsados": 84,
    "valor_total_desembolsado": 1260000000,
    "plazo_promedio": 48
  },
  {
    "fecha_desemb": "202507",
    "canal_recalculado": "DIRECTO",
    "categoria": "CONSUMO",
    "subcategoria": "CREDITO",
    "producto": "CONSUMO",
    "ciudad": "CALI",
    "regional": "SUR",
    "feria": "",
    "nuevo_usado": "",
    "total_creditos_desembolsados": 52,
    "valor_total_desembolsado": 780000000,
    "plazo_promedio": 36
  },
  {
    "fecha_desemb": "202506",
    "canal_recalculado": "CONCESIONARIO",
    "categoria": "MOTO",
    "subcategoria": "MOTO_GAMA_ALTA",
    "producto": "MOTO",
    "ciudad": "MEDELLIN",
    "regional": "ANTIOQUIA",
    "feria": "FMOTO26",
    "nuevo_usado": "Nuevo",
    "total_creditos_desembolsados": 23,
    "valor_total_desembolsado": 345000000,
    "plazo_promedio": 24
  }
]
```

---

## Reference: the shipped bank scenario, filled in

This is what a completed `collection.md` looks like, matching `data/sample/activity_events.ts`.

- **Name:** `activity_events`
- **One document is:** one operational event at a bank (a login, a balance query, a transfer, a user change).
- **Approximate volume:** ~60 records.

Fields: `_id` (string, `evt_0001`), `userId` / `userName` (string, the actor), `action` (string enum), `amount` (number, minor units, non-zero only for transfers), `channel` (string enum), `status` (string enum), `timestamp` (Date, UTC).

Enums: `action` = `LOGIN`, `BALANCE_QUERY`, `TRANSFER_INITIATED`, `TRANSFER_APPROVED`, `USER_CREATED`, `USER_MODIFIED`; `channel` = `WEB`, `MOBILE`, `API`, `BRANCH`; `status` = `SUCCESS`, `FAILED`, `PENDING`.

Units: `amount` in minor units (cents); `1500000` means 15,000.00.

Consistency rules: only `TRANSFER_INITIATED` and `TRANSFER_APPROVED` carry a non-zero `amount`; per-user successful-transfer totals sum to the global total.

Verifiable facts: "largest transfer this month" is a single $25,000.00 transfer dated this month, with a larger $30,000.00 transfer dated last month so the month filter matters; a dual-control violation where one operator both initiates and approves the same high-value transfer, for the hybrid demo.
