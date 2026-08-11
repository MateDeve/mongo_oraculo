# Prompts de la Fase 1: Fundación (Checkpoint 1)

Objetivo: que el esqueleto corra y responda una pregunta de muestra sobre tus datos. Ver [`../../HOW-TO-USE.es.md`](../../HOW-TO-USE.es.md#fase-1-fundación-checkpoint-1).

Trabaja en pasos pequeños. Después de cada cambio ejecuta `npm run typecheck`, y después de cambiar datos, `npm run load`.

---

## Prompt: elegir mi patrón

```
Estoy construyendo un agente structured. Actualiza src/patterns.ts para
que mi patrón exponga solo las herramientas que necesita, y ajusta la selección del system
prompt si hace falta. Deja intactos los otros patrones para poder compararlos. Ejecuta
npm run typecheck al terminar.
```

## Prompt (RAG / híbrido): cargar mi base de conocimiento

```
Reemplaza la base de conocimiento de ejemplo por la nuestra. Nuestros documentos son
[DESCRIBE: p. ej. 8 runbooks en markdown sobre incidencias de VPN y accesos]. Voy a poner
los archivos en data/sample/kb/.

1. Dime el formato y la estructura de carpetas que esperas.
2. Revisa cómo data/load.ts divide los documentos en chunks y ajústalo si nuestra
   estructura lo requiere (queremos un chunk por [SECCIÓN / ENCABEZADO / OTRO], con
   metadatos de source y section para las citas).
3. Nuestros chunks pierden sentido sin el documento que los rodea ("el umbral", en una
   sección que nunca repite a qué aplica). Dime si el chunking contextual con los
   embeddings contextualizados de Voyage (voyage-context-4, vía el endpoint
   /contextualizedembeddings, que embebe cada chunk considerando el documento completo)
   ayudaría de forma medible en nuestro corpus, o si voyage-4-large basta aquí. Si ayuda,
   muéstrame qué cambia en src/retrieval/embeddings.ts y data/load.ts, y confirma que
   VOYAGE_EMBEDDING_DIMENSIONS siga coincidiendo con el índice vectorial.
4. Señala cualquier otra capacidad de Voyage o de MongoDB Atlas que le venga mejor a
   nuestros datos que los valores por defecto: un modelo de embeddings de dominio
   (voyage-code-3 para código, voyage-law-2, voyage-finance-2), voyage-multimodal-3.5 si
   nuestros documentos traen diagramas o páginas escaneadas (texto e imágenes comparten
   el mismo espacio vectorial, así que podemos recuperar ambos con una sola consulta), o
   Atlas Search / búsqueda híbrida junto a la búsqueda vectorial. Recomienda una, con su
   compromiso en una línea; no cambies de modelo sin decirme por qué.
5. Mantén todo sintético o aprobado para el evento, según las reglas de Data Compliance.
Cuando agregue los archivos, guíame por npm run load y confirma que el índice vectorial se
construye.
```

## Prompt (structured / híbrido): modelar mi colección y mis datos

Lo predeterminado para los equipos de datos estructurados es la **Opción A**: traer un esquema y
unos pocos registros de muestra escritos a mano, y dejar que el prompt los expanda en un dataset
mock completo, de modo que ningún dato real salga de su sistema de origen (sin exportación, sin
aprobación del data owner, sin revisión de clasificación ni de seguridad en la ruta crítica). Usa
la **Opción B** solo si ya tienes en mano un dataset sintético exportado y aprobado.

### Opción A: generar datos mock a partir de tu esquema y tus muestras (predeterminado)

Primero completa `data/mock-input/collection.md` (esquema, enums, unidades, reglas de consistencia,
los hechos verificables que tu demo debe poder responder, y de 3 a 5 registros de muestra escritos
a mano). Luego:

```
Lee data/mock-input/collection.md. Usándolo como especificación, reescribe
data/sample/activity_events.ts como un generador determinista para nuestra colección,
tomando como modelo el generador bancario existente:

1. Mantenlo determinista (semilla fija => dataset idéntico en cada ejecución) y genera
   aproximadamente el volumen que indiqué, con valores realistas a partir de mis campos,
   enums y unidades.
2. Siembra un registro ancla por cada "hecho verificable" que listé, y valida con asserts
   todos esos hechos y mis reglas de consistencia antes de retornar; si algún assert falla,
   lanza un error para que la carga se detenga. Exporta las expectations para que
   scripts/verify.ts pueda revisarlas.
3. Actualiza la descripción en lenguaje natural de src/query/schema.ts para que coincida con
   mis campos, tipos, enums y unidades. Sigue la lista de cinco puntos del comentario al
   inicio de ese archivo; las trampas y la guía de pregunta-a-campo pesan más que la lista
   de campos. Deja esa descripción en inglés: es una ayuda de prompt llena de nombres de
   campo.
4. Actualiza EVENTS_COLLECTION en .env si el nombre de la colección es distinto.
Usa solo datos sintéticos, y no toques el cliente del modelo, las credenciales ni el grafo.
5. Hazme las preguntas necesarias hasta que estes seguro de la tarea
Ejecuta npm run typecheck y luego guíame por npm run load.
```

### Opción B: cargar un dataset que ya exporté (solo si lo tienes)

```
Nuestros datos estructurados son [DESCRIBE: la entidad, los campos clave y sus tipos, y los
valores de los enums, p. ej. support_tickets con status, priority, assignee, createdAt]. Los
montos o cantidades están en [UNIDADES].

1. Reescribe data/sample/activity_events.ts para modelar nuestra colección, manteniendo el
   generador determinista e internamente consistente (afirma con asserts que el registro que
   llamaremos "[TU SUPERLATIVO, p. ej. el ticket abierto más antiguo]" realmente lo es, y que
   los totales cuadran). Exporta las expectations que el script de verificación pueda revisar.
2. Actualiza la descripción en lenguaje natural de src/query/schema.ts para que coincida con
   nuestros campos, tipos y enums. Sigue la lista de cinco puntos del comentario al inicio
   de ese archivo; las trampas y la guía de pregunta-a-campo pesan más que la lista de
   campos. Deja esa descripción en inglés: es una ayuda de prompt llena de nombres de campo.
3. Actualiza EVENTS_COLLECTION en .env si le cambiamos el nombre.
Ejecuta npm run typecheck y luego guíame por npm run load.
```

## Prompt: hacer la primera pregunta real

```
Ayúdame a correr una pregunta de muestra de punta a punta para el Checkpoint 1:
  npm run dev -- --pattern [PATRÓN] --thread demo --user me "[TU PREGUNTA DE MUESTRA]"
Si la respuesta es incorrecta o viene vacía, diagnostica si el problema está en los datos,
en la recuperación/consulta o en el prompt, y propón el arreglo más pequeño posible. No
modifiques el cliente del modelo, las credenciales ni el grafo.
```

## Ideas para probar en esta fase

- Haz dos o tres de tus preguntas reales y anota cuáles ya funcionan.
- Para RAG, confirma que la respuesta cita una fuente y una sección reales.
- Para structured, confirma que el número coincide con un valor que puedas calcular a mano desde tu generador.
- Mantén el dataset pequeño pero representativo; puedes hacerlo crecer en la Fase 2.
