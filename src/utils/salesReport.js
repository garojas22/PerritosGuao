import { getOrderPayments, paymentBs } from './payment';

/**
 * Cálculos del cierre de caja.
 *
 * Funciones puras: no tocan React ni localStorage. Reciben la lista de
 * ventas del día y devuelven los números ya listos para mostrar o exportar.
 * Al no depender de nada externo son fáciles de probar y de reutilizar.
 * La exportación a Excel vive aparte, en salesExcel.js.
 */

/** Hora a partir de la cual un pedido cuenta para el día SIGUIENTE.
 *  0 = el día de caja va de medianoche a medianoche.
 *  Si el negocio cierra después de medianoche (ej. cierra a las 2am y quiere
 *  que esas ventas cuenten para el día anterior), pon aquí 4 y el corte del
 *  día pasa a ser a las 4:00 a. m. */
export const BUSINESS_DAY_CUTOFF_HOUR = 0;

/** Devuelve la clave de día de caja ("2026-08-23") para una fecha dada. */
export function getBusinessDayKey(date = new Date()) {
  const d = new Date(date);
  if (BUSINESS_DAY_CUTOFF_HOUR > 0 && d.getHours() < BUSINESS_DAY_CUTOFF_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  // Se construye a mano en vez de usar toISOString() porque ese método
  // convierte a UTC y en Venezuela (UTC-4) adelantaría el día después
  // de las 8 p. m., metiendo ventas en la fecha equivocada.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "2026-08-23" -> "sábado, 23 de agosto de 2026" */
export function formatDayLabel(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatUsd(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

export function formatBs(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `Bs. ${Number(value).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Resume las ventas de un día: totales, desglose por método de pago,
 * por tipo de pedido y ranking de productos.
 */
export function summarizeSales(sales = []) {
  const summary = {
    count: sales.length,
    totalUsd: 0,
    totalBs: 0,
    hasBsData: false,
    averageTicket: 0,
    byPayment: {},
    splitCount: 0, // pedidos pagados con más de un método
    byType: {},
    products: [],
    itemsSold: 0,
  };

  const productMap = new Map();

  sales.forEach(sale => {
    const total = Number(sale.total) || 0;
    summary.totalUsd += total;

    if (Number.isFinite(Number(sale.totalBs))) {
      summary.totalBs += Number(sale.totalBs);
      summary.hasBsData = true;
    }

    // Un pedido puede pagarse con varios métodos: cada uno suma SU parte del
    // total, así el efectivo de la caja cuadra aunque el pedido sea mixto.
    const payments = getOrderPayments(sale);
    if (payments.length > 1) summary.splitCount += 1;

    if (payments.length === 0) {
      payments.push({ method: 'Sin especificar', amount: total });
    }

    payments.forEach(payment => {
      const method = payment.method || 'Sin especificar';
      if (!summary.byPayment[method]) summary.byPayment[method] = { count: 0, totalUsd: 0, totalBs: 0 };
      summary.byPayment[method].count += 1;
      summary.byPayment[method].totalUsd += Number(payment.amount) || 0;
      const partBs = paymentBs(sale, payment);
      if (partBs !== null) summary.byPayment[method].totalBs += partBs;
    });

    const type = sale.type || 'Sin especificar';
    if (!summary.byType[type]) summary.byType[type] = { count: 0, totalUsd: 0 };
    summary.byType[type].count += 1;
    summary.byType[type].totalUsd += total;

    (sale.items || []).forEach(item => {
      const qty = Number(item.qty) || 0;
      const lineTotal = (Number(item.price) || 0) * qty;
      summary.itemsSold += qty;

      const current = productMap.get(item.name) || { name: item.name, qty: 0, totalUsd: 0, hasDirectSales: false };
      current.qty += qty;
      current.totalUsd = (Number(current.totalUsd) || 0) + lineTotal;
      current.hasDirectSales = true;
      productMap.set(item.name, current);

      if (item.isCombo) {
        (item.parts || []).forEach(part => {
          const partEntry = productMap.get(part.name) || { name: part.name, qty: 0, totalUsd: null, hasDirectSales: false };
          partEntry.qty += qty;
          productMap.set(part.name, partEntry);
        });
      }
    });
  });

  summary.averageTicket = summary.count > 0 ? summary.totalUsd / summary.count : 0;
  summary.products = Array.from(productMap.values())
    .map(({ hasDirectSales, ...product }) => ({
      ...product,
      totalUsd: hasDirectSales ? product.totalUsd : null,
    }))
    .sort((a, b) => b.qty - a.qty);

  return summary;
}