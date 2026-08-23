/**
 * Cálculos y exportación del cierre de caja.
 *
 * Funciones puras: no tocan React ni localStorage. Reciben la lista de
 * ventas del día y devuelven los números ya listos para mostrar o exportar.
 * Al no depender de nada externo son fáciles de probar y de reutilizar.
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

    const pay = sale.pay || 'Sin especificar';
    if (!summary.byPayment[pay]) summary.byPayment[pay] = { count: 0, totalUsd: 0, totalBs: 0 };
    summary.byPayment[pay].count += 1;
    summary.byPayment[pay].totalUsd += total;
    if (Number.isFinite(Number(sale.totalBs))) {
      summary.byPayment[pay].totalBs += Number(sale.totalBs);
    }

    const type = sale.type || 'Sin especificar';
    if (!summary.byType[type]) summary.byType[type] = { count: 0, totalUsd: 0 };
    summary.byType[type].count += 1;
    summary.byType[type].totalUsd += total;

    (sale.items || []).forEach(item => {
      const qty = Number(item.qty) || 0;
      const lineTotal = (Number(item.price) || 0) * qty;
      summary.itemsSold += qty;

      const current = productMap.get(item.name) || { name: item.name, qty: 0, totalUsd: 0 };
      current.qty += qty;
      current.totalUsd += lineTotal;
      productMap.set(item.name, current);
    });
  });

  summary.averageTicket = summary.count > 0 ? summary.totalUsd / summary.count : 0;
  summary.products = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty);

  return summary;
}

/** Escapa un valor para CSV: comillas dobles y separadores no rompen la celda. */
function csvCell(value) {
  const text = String(value ?? '');
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Number -> "3,50" (coma decimal, que es lo que espera Excel en español). */
function csvNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  return String(Number(value).toFixed(2)).replace('.', ',');
}

/**
 * Construye el CSV del día listo para abrir en Excel.
 *
 * Detalles que importan para que Excel no lo muestre mal:
 * - Separador ";" (Excel en español espera punto y coma, no coma).
 * - Decimales con coma, para que las celdas se lean como números.
 * - BOM al inicio (lo agrega downloadSalesCsv), para que respete los acentos.
 */
export function buildSalesCsv(sales = [], dateKey) {
  const summary = summarizeSales(sales);
  const rows = [];

  rows.push(['CIERRE DE CAJA']);
  rows.push(['Fecha', formatDayLabel(dateKey)]);
  rows.push(['Pedidos', summary.count]);
  rows.push(['Total USD', csvNumber(summary.totalUsd)]);
  if (summary.hasBsData) rows.push(['Total Bs', csvNumber(summary.totalBs)]);
  rows.push(['Ticket promedio USD', csvNumber(summary.averageTicket)]);
  rows.push([]);

  rows.push(['DETALLE DE PEDIDOS']);
  rows.push([
    'N° pedido', 'Hora pedido', 'Hora cobro', 'Cliente',
    'Tipo', 'Método de pago', 'Productos', 'Modificadores',
    'Unidades', 'Total USD', 'Total Bs', 'Tasa BCV',
  ]);

  sales.forEach(sale => {
    const items = sale.items || [];
    const productos = items.map(i => `${i.qty}x ${i.name}`).join(' | ');
    const modificadores = items
      .filter(i => Array.isArray(i.mods) && i.mods.length > 0)
      .map(i => `${i.name}: ${i.mods.join(', ')}`)
      .join(' | ');
    const unidades = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

    rows.push([
      sale.num,
      sale.time || '',
      sale.closedTime || '',
      sale.customer || '',
      sale.type || '',
      sale.pay || '',
      productos,
      modificadores,
      unidades,
      csvNumber(sale.total),
      csvNumber(sale.totalBs),
      csvNumber(sale.bcvRate),
    ]);
  });

  rows.push([]);
  rows.push(['RESUMEN POR MÉTODO DE PAGO']);
  rows.push(['Método', 'Pedidos', 'Total USD', 'Total Bs']);
  Object.entries(summary.byPayment).forEach(([method, data]) => {
    rows.push([method, data.count, csvNumber(data.totalUsd), csvNumber(data.totalBs)]);
  });

  rows.push([]);
  rows.push(['RESUMEN POR TIPO DE PEDIDO']);
  rows.push(['Tipo', 'Pedidos', 'Total USD']);
  Object.entries(summary.byType).forEach(([type, data]) => {
    rows.push([type, data.count, csvNumber(data.totalUsd)]);
  });

  rows.push([]);
  rows.push(['PRODUCTOS VENDIDOS']);
  rows.push(['Producto', 'Unidades', 'Total USD']);
  summary.products.forEach(product => {
    rows.push([product.name, product.qty, csvNumber(product.totalUsd)]);
  });

  return rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}

/** Dispara la descarga del CSV en el navegador. */
export function downloadSalesCsv(sales, dateKey) {
  const csv = buildSalesCsv(sales, dateKey);
  // El BOM (\uFEFF) es lo que hace que Excel abra el archivo como UTF-8
  // y muestre bien acentos y ñ. Sin él salen caracteres rotos.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cierre-caja-${dateKey}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
