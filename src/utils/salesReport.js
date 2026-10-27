import { getOrderPayments, paymentBs, isCreditSale } from './payment';

/**
 * CÃ¡lculos del cierre de caja.
 *
 * Funciones puras: no tocan React ni localStorage. Reciben la lista de
 * ventas del dÃ­a y devuelven los nÃºmeros ya listos para mostrar o exportar.
 * Al no depender de nada externo son fÃ¡ciles de probar y de reutilizar.
 * La exportaciÃ³n a Excel vive aparte, en salesExcel.js.
 */

/** Hora a partir de la cual un pedido cuenta para el dÃ­a SIGUIENTE.
 *  0 = el dÃ­a de caja va de medianoche a medianoche.
 *  Si el negocio cierra despuÃ©s de medianoche (ej. cierra a las 2am y quiere
 *  que esas ventas cuenten para el dÃ­a anterior), pon aquÃ­ 4 y el corte del
 *  dÃ­a pasa a ser a las 4:00 a. m. */
export const BUSINESS_DAY_CUTOFF_HOUR = 0;

/** Devuelve la clave de dÃ­a de caja ("2026-08-23") para una fecha dada. */
export function getBusinessDayKey(date = new Date()) {
  const d = new Date(date);
  if (BUSINESS_DAY_CUTOFF_HOUR > 0 && d.getHours() < BUSINESS_DAY_CUTOFF_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  // Se construye a mano en vez de usar toISOString() porque ese mÃ©todo
  // convierte a UTC y en Venezuela (UTC-4) adelantarÃ­a el dÃ­a despuÃ©s
  // de las 8 p. m., metiendo ventas en la fecha equivocada.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "2026-08-23" -> "sÃ¡bado, 23 de agosto de 2026" */
export function formatDayLabel(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Solo la primera letra en mayÃºscula. Antes el CSS usaba capitalize y salÃ­a "15 De Octubre De 2026".
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Â¿Hay un nÃºmero real? `null` y '' NO cuentan (Number(null) serÃ­a 0 y pasarÃ­a por vÃ¡lido). */
export function hasAmount(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function formatUsd(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

export function formatBs(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'â';
  return `Bs. ${Number(value).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Resume las ventas de un dÃ­a: totales, desglose por mÃ©todo de pago,
 * por tipo de pedido y ranking de productos.
 */
export function summarizeSales(sales = []) {
  // Las anuladas no cuentan para nada: ni total, ni productos, ni mÃ©todos de
  // pago. Pero no desaparecen â se informan aparte para que el dueÃ±o las vea.
  const activas = sales.filter(sale => !sale.voided);
  const anuladas = sales.filter(sale => sale.voided);

  const summary = {
    count: activas.length,
    totalUsd: 0,
    // Lo vendido y lo cobrado dejan de ser el mismo nÃºmero cuando hay crÃ©dito:
    // la comida saliÃ³, la plata no entrÃ³.
    collectedUsd: 0,
    creditOpenUsd: 0,
    creditOpenCount: 0,
    voidedCount: anuladas.length,
    voidedUsd: anuladas.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0),
    totalBs: 0,
    hasBsData: false,
    averageTicket: 0,
    byPayment: {},
    splitCount: 0, // pedidos pagados con mÃ¡s de un mÃ©todo
    byType: {},
    products: [],
    itemsSold: 0,
  };

  const productMap = new Map();

  activas.forEach(sale => {
    const total = Number(sale.total) || 0;
    summary.totalUsd += total;

    if (isCreditSale(sale) && !sale.creditPaid) {
      summary.creditOpenUsd += total;
      summary.creditOpenCount += 1;
    }

    if (hasAmount(sale.totalBs)) {
      summary.totalBs += Number(sale.totalBs);
      summary.hasBsData = true;
    }

    // Un pedido puede pagarse con varios mÃ©todos: cada uno suma SU parte del
    // total, asÃ­ el efectivo de la caja cuadra aunque el pedido sea mixto.
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

  // Lo que de verdad entrÃ³ a la caja hoy. Un crÃ©dito ya pagado sÃ­ entrÃ³, pero
  // entrÃ³ el dÃ­a que lo pagaron, no hoy: por eso solo se descuenta lo abierto.
  summary.collectedUsd = summary.totalUsd - summary.creditOpenUsd;
  summary.averageTicket = summary.count > 0 ? summary.totalUsd / summary.count : 0;
  summary.products = Array.from(productMap.values())
    .map(({ hasDirectSales, ...product }) => ({
      ...product,
      totalUsd: hasDirectSales ? product.totalUsd : null,
    }))
    .sort((a, b) => b.qty - a.qty);

  return summary;
}