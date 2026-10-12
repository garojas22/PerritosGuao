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
 * Filas del inventario de un día, agrupadas (Panes, Proteínas...).
 *
 * Cada fila trae: carry (sobrante de ayer), entered (ingresó hoy), available,
 * sold, remaining y status ('out' | 'low' | null). Los valores son `null`
 * mientras no se haya ingresado nada de ese insumo.
 */
export function summarizeInventory({ dayKey, sales = [], stockByDay = {}, salesByDay = {}, startByDay = {} }) {
  const usage = countUsage(sales);
  const carry = getCarryOver(dayKey, stockByDay, salesByDay, startByDay);
  const entered = stockByDay[dayKey] || {};
  const fixedStart = startByDay[dayKey] || {};

  // Un insumo que ya no está en la lista pero sí se vendió no debe desaparecer del reporte.
  const knownIds = new Set(INVENTORY_ITEMS.map(item => item.id));
  const extraItems = Object.keys(usage)
    .filter(id => !knownIds.has(id))
    .map(id => ({ id, name: getInventoryName(id), group: 'Otros' }));

  const groups = new Map();
  let hasStock = false;
  let soldTotal = 0;

  [...INVENTORY_ITEMS, ...extraItems].forEach(item => {
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
      else if (available > 0 && remaining / available <= LOW_STOCK_RATIO) status = 'low';
    }

    if (tracked) hasStock = true;
    soldTotal += sold;

    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push({
      id: item.id,
      name: item.name,
      carry: previous,
      carryAdjusted: adjusted,
      entered: ingreso,
      available,
      sold,
      remaining,
      status,
    });
  });

  return {
    groups: [...groups.entries()].map(([group, rows]) => ({ group, rows })),
    hasStock,
    soldTotal,
    salesWithoutDetail: countSalesWithoutUses(sales),
  };
}