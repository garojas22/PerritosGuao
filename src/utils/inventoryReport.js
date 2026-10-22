import { INVENTORY_ITEMS, getInventoryName } from '../data/inventory';

/**
 * Cálculo del inventario del cierre de caja.
 *
 * Funciones puras, igual que salesReport.js. Cada línea vendida guarda en
 * `uses` los insumos que gasta UNA unidad (ver lineOptions.js), así que lo
 * vendido de un insumo es la suma de `uses.qty × qty` de todas las líneas.
 *
 * Por insumo y por día:
 *   Disponible = Sobrante de ayer + Ingresó hoy
 *   Quedan     = Disponible − Vendido
 * El "sobrante de ayer" se arrastra solo desde el primer día en que se
 * ingresó ese insumo. Si el conteo real no coincide, se puede corregir el
 * sobrante con que empieza un día (`startByDay`): esa cifra reemplaza a la
 * calculada y es la que se arrastra a los días siguientes.
 */

/** Total vendido por insumo en una lista de ventas: { "pan-brioche": 12, ... }. */
export function countUsage(sales = []) {
  const usage = {};

  sales.forEach(sale => {
    (sale.items || []).forEach(line => {
      const lineQty = Number(line.qty) || 0;
      (line.uses || []).forEach(use => {
        usage[use.item] = (usage[use.item] || 0) + (Number(use.qty) || 0) * lineQty;
      });
    });
  });

  return usage;
}

/** Ventas con líneas cobradas antes de existir el inventario (sin el campo `uses`). */
function countSalesWithoutUses(sales = []) {
  return sales.filter(sale => (sale.items || []).some(line => !Array.isArray(line.uses))).length;
}

/**
 * Sobrante con que cada insumo llega a `dayKey` (al cierre del día anterior).
 * Un insumo que nunca se ingresó no aparece en el resultado: no hay cifra que arrastrar.
 */
export function getCarryOver(dayKey, stockByDay = {}, salesByDay = {}, startByDay = {}) {
  const days = [...new Set([...Object.keys(stockByDay), ...Object.keys(salesByDay), ...Object.keys(startByDay)])]
    .filter(day => day < dayKey)
    .sort();

  const balance = {};

  days.forEach(day => {
    // Conteo real de ese día: reemplaza lo que venía arrastrando el cálculo.
    Object.entries(startByDay[day] || {}).forEach(([id, qty]) => {
      balance[id] = Number(qty) || 0;
    });

    Object.entries(stockByDay[day] || {}).forEach(([id, qty]) => {
      balance[id] = (balance[id] ?? 0) + (Number(qty) || 0);
    });

    Object.entries(countUsage(salesByDay[day] || [])).forEach(([id, qty]) => {
      if (balance[id] !== undefined) balance[id] -= qty;
    });
  });

  return balance;
}

/** Cuando lo que queda es este porcentaje (o menos) de lo disponible se avisa "Poco". */
const LOW_STOCK_RATIO = 0.15;
/**
 * ...y también cuando quedan pocas unidades, sin importar el porcentaje.
 * Con cifras chicas el porcentaje engaña: 1 de 6 es el 16 %, no avisaba, y
 * al cocinero le queda una sola salchicha.
 */
const LOW_STOCK_UNITS = 5;

/**
 * Suma acumulada de un campo numérico en un array de filas.
 * Devuelve null si TODAS las filas tienen ese campo en null
 * (nadie ha ingresado nada → no existe cifra que mostrar).
 */
function sumField(rows, field) {
  const withData = rows.filter(row => row[field] !== null);
  if (withData.length === 0) return null;
  return withData.reduce((acc, row) => acc + (row[field] ?? 0), 0);
}

/** Resumen agregado de un subgrupo (la fila de cabecera plegable). */
function computeSubgroupSummary(rows) {
  return {
    carry:     sumField(rows, 'carry'),
    entered:   sumField(rows, 'entered'),
    available: sumField(rows, 'available'),
    sold:      rows.reduce((acc, r) => acc + r.sold, 0),
    remaining: sumField(rows, 'remaining'),
    // cuántos ítems están agotados o por acabarse: se muestra aunque el grupo esté plegado
    alerts: {
      out: rows.filter(r => r.status === 'out').length,
      low: rows.filter(r => r.status === 'low').length,
    },
  };
}

/**
 * Filas del inventario de un día con soporte de dos niveles (group → subgroup).
 *
 * Parámetros:
 *  - inventoryItems: lista combinada (código + localStorage). Por defecto usa
 *    INVENTORY_ITEMS para no romper llamadas antiguas.
 *  - usedInventoryIds: Set de IDs que algún producto del menú consume. Si se
 *    pasa, las filas cuyo ID no aparece quedan marcadas como `manualOnly: true`.
 *
 * Salida por grupo:
 *  - rows:      ítems sin subgroup (se renderizan directamente).
 *  - subgroups: ítems con subgroup, ya agrupados. Cada subgrupo trae sus `rows`
 *               y un `summary` calculado (suma de todas sus marcas).
 */
export function summarizeInventory({
  dayKey,
  sales = [],
  stockByDay = {},
  salesByDay = {},
  startByDay = {},
  inventoryItems = INVENTORY_ITEMS,
  usedInventoryIds = null,
}) {
  const usage = countUsage(sales);
  const carry = getCarryOver(dayKey, stockByDay, salesByDay, startByDay);
  const entered = stockByDay[dayKey] || {};
  const fixedStart = startByDay[dayKey] || {};

  // Un insumo que ya no está en la lista pero sí se vendió no debe desaparecer del reporte.
  const knownIds = new Set(inventoryItems.map(item => item.id));
  const extraItems = Object.keys(usage)
    .filter(id => !knownIds.has(id))
    .map(id => ({ id, name: getInventoryName(id), group: 'Otros', note: '' }));

  // groupMap: group → { directRows[], subgroupMap: subgroup → rows[] }
  const groupMap = new Map();
  let hasStock = false;
  let soldTotal = 0;

  [...inventoryItems, ...extraItems].forEach(item => {
    const sold = usage[item.id] || 0;
    const ingreso = Number.isFinite(entered[item.id]) ? entered[item.id] : null;
    const adjusted = Number.isFinite(fixedStart[item.id]);
    // Si ese día se corrigió el sobrante, esa cifra manda sobre la calculada.
    const previous = adjusted
      ? fixedStart[item.id]
      : (Number.isFinite(carry[item.id]) ? carry[item.id] : null);
    const tracked = ingreso !== null || previous !== null;

    const available = tracked ? (previous ?? 0) + (ingreso ?? 0) : null;
    const remaining = tracked ? available - sold : null;

    let status = null;
    if (tracked) {
      if (remaining <= 0) status = 'out';
      else if (remaining <= LOW_STOCK_UNITS || (available > 0 && remaining / available <= LOW_STOCK_RATIO)) status = 'low';
    }

    if (tracked) hasStock = true;
    soldTotal += sold;

    // manualOnly: ningún producto del menú activo consume este insumo.
    // El dueño solo puede registrar entradas/salidas a mano.
    const manualOnly = usedInventoryIds !== null && !usedInventoryIds.has(item.id);

    const row = {
      id:           item.id,
      name:         item.name,
      note:         item.note ?? '',
      carry:        previous,
      carryAdjusted: adjusted,
      entered:      ingreso,
      available,
      sold,
      remaining,
      status,
      manualOnly,
    };

    if (!groupMap.has(item.group)) {
      groupMap.set(item.group, { directRows: [], subgroupMap: new Map() });
    }
    const g = groupMap.get(item.group);

    if (item.subgroup) {
      if (!g.subgroupMap.has(item.subgroup)) g.subgroupMap.set(item.subgroup, []);
      g.subgroupMap.get(item.subgroup).push(row);
    } else {
      g.directRows.push(row);
    }
  });

  const groups = [...groupMap.entries()].map(([group, { directRows, subgroupMap }]) => ({
    group,
    rows: directRows,
    subgroups: [...subgroupMap.entries()].map(([subgroup, rows]) => ({
      subgroup,
      rows,
      summary: computeSubgroupSummary(rows),
    })),
  }));

  return {
    groups,
    hasStock,
    soldTotal,
    salesWithoutDetail: countSalesWithoutUses(sales),
  };
}
