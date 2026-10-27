/**
 * Deudas abiertas (pago a crÃ©dito), agrupadas por cliente.
 *
 * Funciones puras, igual que salesReport.js. Reciben TODO el registro de
 * ventas âno el de un solo dÃ­aâ porque una deuda del martes se cobra el
 * sÃ¡bado: si solo se mirara el dÃ­a del cierre, la deuda desaparecerÃ­a de
 * la vista al dÃ­a siguiente de hacerla.
 */

import { isCreditPending, isCreditSale, customerKey } from './payment';
import { getBusinessDayKey } from './salesReport';

/** DÃ­as entre dos claves de dÃ­a de caja ("2026-10-20" â "2026-10-26" = 6). */
export function daysBetween(fromDayKey, toDayKey = getBusinessDayKey()) {
  if (!fromDayKey || !toDayKey) return 0;
  const [fy, fm, fd] = fromDayKey.split('-').map(Number);
  const [ty, tm, td] = toDayKey.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  const days = Math.round((to - from) / 86400000);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** "hace 8 dÃ­as" / "hoy" / "ayer" */
export function describeAge(days) {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} dÃ­as`;
}

/**
 * Deudas abiertas agrupadas por cliente, de mÃ¡s vieja a mÃ¡s reciente.
 *
 * Devuelve:
 *   customers: [{ key, name, totalUsd, oldestDayKey, oldestDays, sales: [...] }]
 *   totalUsd:  lo que el negocio tiene en la calle
 *   count:     cuÃ¡ntos pedidos sin cobrar
 */
export function summarizeOpenCredits(salesByDay = {}, todayKey = getBusinessDayKey()) {
  const byCustomer = new Map();
  let totalUsd = 0;
  let count = 0;

  Object.entries(salesByDay).forEach(([dayKey, daySales]) => {
    (daySales || []).forEach(sale => {
      if (!isCreditPending(sale)) return;

      const name = (sale.customer || '').trim() || 'Sin nombre';
      const key = customerKey(name) || 'sin-nombre';
      const amount = Number(sale.total) || 0;

      if (!byCustomer.has(key)) {
        byCustomer.set(key, { key, name, totalUsd: 0, oldestDayKey: dayKey, sales: [] });
      }
      const entry = byCustomer.get(key);
      entry.totalUsd += amount;
      // El nombre que se muestra es el de la deuda mÃ¡s vieja: es el que el
      // dueÃ±o va a reconocer si lleva semanas esperando ese pago.
      if (dayKey < entry.oldestDayKey) {
        entry.oldestDayKey = dayKey;
        entry.name = name;
      }
      entry.sales.push({ ...sale, dayKey, days: daysBetween(dayKey, todayKey) });

      totalUsd += amount;
      count += 1;
    });
  });

  const customers = [...byCustomer.values()].map(entry => ({
    ...entry,
    oldestDays: daysBetween(entry.oldestDayKey, todayKey),
    sales: entry.sales.sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
  })).sort((a, b) => a.oldestDayKey.localeCompare(b.oldestDayKey));

  return { customers, totalUsd, count };
}

/** CrÃ©ditos de UN dÃ­a: cuÃ¡nto se dejÃ³ a crÃ©dito y cuÃ¡nto de eso sigue sin pagarse. */
export function summarizeDayCredits(sales = []) {
  let openUsd = 0;
  let openCount = 0;
  let settledUsd = 0;

  sales.forEach(sale => {
    if (sale.voided || !isCreditSale(sale)) return;
    const amount = Number(sale.total) || 0;
    if (sale.creditPaid) settledUsd += amount;
    else { openUsd += amount; openCount += 1; }
  });

  return { openUsd, openCount, settledUsd };
}
