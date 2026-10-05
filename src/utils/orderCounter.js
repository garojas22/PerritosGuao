import { getBusinessDayKey } from './salesReport';
import { SALES_STORAGE_KEY } from '../hooks/useSales';

/**
 * Numeración de pedidos que sobrevive a refrescar la página.
 *
 * Antes el contador vivía en un useRef dentro de useOrders: arrancaba en 1 cada
 * vez que se cargaba la página. Por eso, tras un refresco, el pedido 003
 * volvía a salir como 001 y chocaba con ventas ya cobradas.
 *
 * Ahora el último número usado se guarda en localStorage junto con el día de
 * caja. Reglas:
 * - La numeración reinicia en 001 cada día de caja (el mismo corte que usa el
 *   cierre de caja, ver BUSINESS_DAY_CUTOFF_HOUR en salesReport.js).
 * - Nunca retrocede: si se anula una venta, su número no se reutiliza.
 * - Se toma el mayor entre el contador guardado y las ventas ya cobradas hoy.
 *   Esto cubre el primer día tras esta actualización, cuando ya hay ventas
 *   registradas pero todavía no existía ningún contador guardado.
 */
const COUNTER_KEY = 'perritos_guao_order_counter';

function readStoredCounter(dateKey) {
try {
const parsed = JSON.parse(localStorage.getItem(COUNTER_KEY));
if (parsed && parsed.dateKey === dateKey && Number.isFinite(parsed.last)) {
    return parsed.last;
}
} catch (error) {
console.warn('No se pudo leer el contador de pedidos:', error);
}
return 0;
}

function highestNumberSoldOn(dateKey) {
try {
const sales = JSON.parse(localStorage.getItem(SALES_STORAGE_KEY));
const list = sales?.[dateKey];
if (!Array.isArray(list)) return 0;
return list.reduce((max, sale) => Math.max(max, parseInt(sale.num, 10) || 0), 0);
} catch (error) {
console.warn('No se pudo revisar las ventas del día:', error);
return 0;
}
}

/** Devuelve el siguiente número de pedido ("001", "002", ...) y lo deja guardado. */
export function nextOrderNumber() {
const dateKey = getBusinessDayKey();
const last = Math.max(readStoredCounter(dateKey), highestNumberSoldOn(dateKey));
const next = last + 1;

try {
localStorage.setItem(COUNTER_KEY, JSON.stringify({ dateKey, last: next }));
} catch (error) {
console.warn('No se pudo guardar el contador de pedidos:', error);
}

return String(next).padStart(3, '0');
}