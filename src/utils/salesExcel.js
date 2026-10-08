import { summarizeSales, formatDayLabel, formatUsd } from './salesReport';

/**
 * Exportación del cierre de caja a un Excel real (.xlsx) con formato.
 *
 * Por qué .xlsx y no CSV: un CSV es texto plano, no puede llevar colores,
 * bordes ni anchos de columna, y Excel lo abre todo apelmazado. Un .xlsx sí.
 * También permite guardar la referencia de pago como TEXTO, así "0042" no se
 * convierte en 42 al abrirlo.
 *
 * La librería (exceljs) pesa ~1 MB, por eso se carga con import() dinámico:
 * solo se descarga cuando alguien pulsa "Exportar a Excel", no al abrir la app.
 */

// Verde corporativo de Excel; el botón de CashClose usa el mismo tono.
const EXCEL_GREEN = 'FF217346';
const ZEBRA = 'FFEAF4EE';
const BORDER_COLOR = 'FFBFBFBF';

const FMT_USD = '"$"#,##0.00';
const FMT_BS = '"Bs. "#,##0.00';
const FMT_RATE = '#,##0.00';

// Anchos de las columnas de texto largo; también sirven para calcular la altura de fila.
const ORDER_COL_WIDTHS = { customer: 22, items: 42, mods: 34 };

const THIN = { style: 'thin', color: { argb: BORDER_COLOR } };
const BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/**
 * Cuántas líneas visuales ocupa un texto dentro de una columna de `width`
 * caracteres. Excel no ajusta solo la altura de filas que escribimos con
 * código, así que se calcula aquí para que el texto largo no quede cortado.
 */
function wrappedLineCount(lines, width) {
return lines.reduce((total, text) => total + Math.max(1, Math.ceil(text.length / width)), 0);
}

/** Número válido o null (null deja la celda vacía en vez de escribir 0). */
function numberOrNull(value) {
if (value === null || value === undefined || value === '') return null;
return Number.isFinite(Number(value)) ? Number(value) : null;
}

function styleHeaderRow(row) {
row.height = 26;
row.eachCell(cell => {
cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_GREEN } };
cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
cell.border = BORDERS;
});
}

function styleBodyRow(row, index) {
row.eachCell({ includeEmpty: true }, cell => {
cell.border = BORDERS;
if (index % 2 === 1) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
}
});
}

function writeTitle(sheet, lastColumn, title, subtitle) {
sheet.mergeCells(`A1:${lastColumn}1`);
const titleCell = sheet.getCell('A1');
titleCell.value = title;
titleCell.font = { bold: true, size: 16, color: { argb: EXCEL_GREEN } };
titleCell.alignment = { vertical: 'middle' };
sheet.getRow(1).height = 28;

sheet.mergeCells(`A2:${lastColumn}2`);
const subtitleCell = sheet.getCell('A2');
subtitleCell.value = subtitle;
subtitleCell.font = { size: 11, color: { argb: 'FF595959' } };
}

/* ---------- Hoja 1: detalle de pedidos ---------- */

function buildOrdersSheet(workbook, sales, dateKey) {
const sheet = workbook.addWorksheet('Pedidos', {
views: [{ state: 'frozen', ySplit: 4 }], // el encabezado queda fijo al bajar
pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
});

sheet.columns = [
{ key: 'num', width: 11 },
{ key: 'time', width: 12 },
{ key: 'closed', width: 12 },
{ key: 'customer', width: ORDER_COL_WIDTHS.customer },
{ key: 'type', width: 12 },
{ key: 'pay', width: 16 },
{ key: 'ref', width: 12 },
{ key: 'items', width: ORDER_COL_WIDTHS.items },
{ key: 'mods', width: ORDER_COL_WIDTHS.mods },
{ key: 'units', width: 10 },
{ key: 'usd', width: 14 },
{ key: 'bs', width: 20 },
{ key: 'rate', width: 12 },
{ key: 'fixes', width: 28 },
];

writeTitle(sheet, 'N', 'CIERRE DE CAJA', formatDayLabel(dateKey));

const headerRow = sheet.getRow(4);
headerRow.values = [
'N° pedido', 'Hora pedido', 'Hora cobro', 'Cliente', 'Tipo', 'Método de pago',
'Ref. pago móvil', 'Productos', 'Modificadores', 'Unidades', 'Total USD', 'Total Bs', 'Tasa BCV', 'Correcciones',
];
styleHeaderRow(headerRow);

sales.forEach((sale, index) => {
const items = sale.items || [];
// Un producto por línea dentro de la celda: se lee mucho mejor que
// separarlos con " | " en una sola línea larga.
const productLines = items.map(item => `${item.qty}x ${item.name}`);
const modLines = items
    .filter(item => Array.isArray(item.mods) && item.mods.length > 0)
    .map(item => `${item.name}: ${item.mods.join(', ')}`);
const units = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

const row = sheet.addRow([
    `#${sale.num}`,
    sale.time || '',
    sale.closedTime || '',
    sale.customer || '',
    sale.type || '',
    sale.pay || '',
    sale.payRef ? String(sale.payRef) : '', // TEXTO a propósito, ver cabecera
    productLines.join('\n'),
    modLines.join('\n'),
    units,
    numberOrNull(sale.total),
    numberOrNull(sale.totalBs),
    numberOrNull(sale.bcvRate),
    // Si el pedido se corrigió después de generarse, queda a la vista del administrador.
    sale.revision > 0
    ? `${sale.revision} ${sale.revision === 1 ? 'vez' : 'veces'} · total original ${formatUsd(sale.edits?.[0]?.prevTotal)}`
    : '',
]);

styleBodyRow(row, index);
// Altura según la cantidad de líneas: así el texto con saltos no se corta.
const visualLines = Math.max(
    wrappedLineCount(productLines, ORDER_COL_WIDTHS.items),
    wrappedLineCount(modLines, ORDER_COL_WIDTHS.mods),
    wrappedLineCount([sale.customer || ''], ORDER_COL_WIDTHS.customer),
);
row.height = Math.max(22, visualLines * 16 + 6);
row.alignment = { vertical: 'middle' };
['num', 'time', 'closed', 'type', 'pay', 'ref', 'units'].forEach(key => {
    row.getCell(key).alignment = { vertical: 'middle', horizontal: 'center' };
});
['items', 'mods'].forEach(key => {
    row.getCell(key).alignment = { vertical: 'middle', wrapText: true };
});
row.getCell('customer').alignment = { vertical: 'middle', wrapText: true };
row.getCell('fixes').alignment = { vertical: 'middle', wrapText: true };
row.getCell('num').font = { bold: true };
row.getCell('usd').numFmt = FMT_USD;
row.getCell('bs').numFmt = FMT_BS;
row.getCell('rate').numFmt = FMT_RATE;
row.getCell('usd').font = { bold: true };
});

if (sales.length === 0) return sheet;

const first = 5;
const last = 4 + sales.length;
sheet.autoFilter = `A4:N${last}`;

// Fila de total con fórmulas: si alguien edita un monto en Excel, el total se actualiza.
const summary = summarizeSales(sales);
const totalRow = sheet.addRow([]);
sheet.mergeCells(`A${totalRow.number}:I${totalRow.number}`);
totalRow.getCell(1).value = 'TOTAL DEL DÍA';
totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
totalRow.getCell('units').value = { formula: `SUM(J${first}:J${last})`, result: summary.itemsSold };
totalRow.getCell('usd').value = { formula: `SUM(K${first}:K${last})`, result: summary.totalUsd };
if (summary.hasBsData) {
totalRow.getCell('bs').value = { formula: `SUM(L${first}:L${last})`, result: summary.totalBs };
}
totalRow.height = 26;
for (let col = 1; col <= 14; col += 1) {
const cell = totalRow.getCell(col);
cell.font = { bold: true, size: 12 };
cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8DC' } };
cell.border = { ...BORDERS, top: { style: 'medium', color: { argb: EXCEL_GREEN } } };
if (col >= 10 && col <= 13) cell.alignment = { vertical: 'middle', horizontal: 'center' };
}
totalRow.getCell('usd').numFmt = FMT_USD;
totalRow.getCell('bs').numFmt = FMT_BS;

return sheet;
}

/* ---------- Hoja 2: resumen ---------- */

/** Escribe un bloque (título + encabezado + filas) y devuelve la siguiente fila libre. */
function writeBlock(sheet, startRow, title, headers, rows, formats = {}) {
const titleRow = sheet.getRow(startRow);
titleRow.getCell(1).value = title;
titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: EXCEL_GREEN } };

const headerRow = sheet.getRow(startRow + 1);
headerRow.values = headers;
styleHeaderRow(headerRow);

rows.forEach((values, index) => {
const row = sheet.getRow(startRow + 2 + index);
row.values = values;
styleBodyRow(row, index);
Object.entries(formats).forEach(([col, format]) => {
    row.getCell(Number(col)).numFmt = format;
});
for (let col = 2; col <= headers.length; col += 1) {
    row.getCell(col).alignment = { horizontal: col === 2 ? 'center' : 'right' };
}
});

return startRow + 2 + rows.length + 1; // deja una fila en blanco entre bloques
}

function buildSummarySheet(workbook, sales, dateKey) {
const sheet = workbook.addWorksheet('Resumen', {
pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
});
sheet.columns = [{ width: 36 }, { width: 14 }, { width: 18 }, { width: 22 }];

const summary = summarizeSales(sales);
writeTitle(sheet, 'D', 'CIERRE DE CAJA · RESUMEN', formatDayLabel(dateKey));

const kpis = [
['Pedidos cobrados', summary.count],
['Unidades vendidas', summary.itemsSold],
['Total vendido USD', summary.totalUsd],
...(summary.hasBsData ? [['Total vendido Bs', summary.totalBs]] : []),
['Ticket promedio USD', summary.averageTicket],
];
let next = writeBlock(sheet, 4, 'Totales del día', ['Concepto', 'Valor'], kpis);
// Formato de cada KPI según lo que es (cantidad, dólares o bolívares).
const kpiFormats = { 'Total vendido USD': FMT_USD, 'Total vendido Bs': FMT_BS, 'Ticket promedio USD': FMT_USD };
kpis.forEach(([label], index) => {
const cell = sheet.getRow(6 + index).getCell(2);
if (kpiFormats[label]) cell.numFmt = kpiFormats[label];
cell.font = { bold: true };
});

next = writeBlock(
sheet, next, 'Por método de pago (para cuadrar la caja)',
['Método', 'Pedidos', 'Total USD', 'Total Bs'],
Object.entries(summary.byPayment).map(([method, data]) => [
    method, data.count, data.totalUsd, data.totalBs > 0 ? data.totalBs : null,
]),
{ 3: FMT_USD, 4: FMT_BS },
);

next = writeBlock(
sheet, next, 'Por tipo de pedido',
['Tipo', 'Pedidos', 'Total USD'],
Object.entries(summary.byType).map(([type, data]) => [type, data.count, data.totalUsd]),
{ 3: FMT_USD },
);

writeBlock(
sheet, next, 'Productos vendidos',
['Producto', 'Unidades', 'Total USD'],
summary.products.map(product => [product.name, product.qty, product.totalUsd]),
{ 3: FMT_USD },
);

return sheet;
}

/* ---------- API pública ---------- */

/** Arma el libro de Excel del día. Exportada aparte de la descarga para poder probarla. */
export async function buildSalesWorkbook(sales = [], dateKey) {
const { default: ExcelJS } = await import('exceljs');
const workbook = new ExcelJS.Workbook();
workbook.creator = 'Punto Pedido';
workbook.created = new Date();

buildOrdersSheet(workbook, sales, dateKey);
buildSummarySheet(workbook, sales, dateKey);
return workbook;
}

/** Genera el .xlsx y dispara la descarga en el navegador. */
export async function downloadSalesExcel(sales, dateKey) {
const workbook = await buildSalesWorkbook(sales, dateKey);
const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], {
type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `cierre-caja-${dateKey}.xlsx`;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
}