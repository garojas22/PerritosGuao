/**
 * Reglas de los mÃ©todos de pago que piden referencia.
 *
 * Viven aquÃ­, en un solo lugar, porque las usan el carrito (para validar),
 * App (para decidir quÃ© guardar) y el resto del sistema. AsÃ­ los textos de los
 * mÃ©todos y el largo de la referencia no quedan repetidos y desincronizados.
 */

export const PAY_MOBILE = 'Pago mÃ³vil';
export const PAY_CARD = 'Tarjeta';

/** CuÃ¡ntos dÃ­gitos se piden de la referencia (los Ãºltimos N). */
export const PAY_REF_LENGTH = 4;

/**
 * Pago mÃ³vil y tarjeta piden referencia: es lo que permite cuadrar cada cobro
 * contra el banco o el punto de venta. El efectivo no la necesita.
 */
export function needsPayRef(payType) {
return payType === PAY_MOBILE || payType === PAY_CARD;
}

/** Â¿Esta venta se dejÃ³ a crÃ©dito? */
export function isCreditSale(sale) {
if (!sale) return false;
const payments = getOrderPayments(sale);
return payments.length === 1 && payments[0].method === PAY_CREDIT;
}

/** Â¿Sigue debiÃ©ndose? Una venta anulada ya no es deuda de nadie. */
export function isCreditPending(sale) {
return isCreditSale(sale) && !sale.creditPaid && !sale.voided;
}

/** Â¿Este cobro fue anulado? */
export function isVoided(sale) {
return Boolean(sale?.voided);
}

/**
 * Clave para agrupar las deudas de una misma persona.
 * "Gabriel", "gabriel " y "GABRIEL" tienen que caer en la misma cuenta, o el
 * panel de por cobrar mostrarÃ­a tres deudores distintos que son uno solo.
 */
export function customerKey(name = '') {
return String(name)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Deja solo dÃ­gitos y corta al largo permitido. Se usa mientras se escribe. */
export function sanitizePayRef(value = '') {
return String(value).replace(/\D/g, '').slice(0, PAY_REF_LENGTH);
}

export function isValidPayRef(value = '') {
const text = String(value);
return text.length === PAY_REF_LENGTH && /^\d+$/.test(text);
}
/* ============================================================
   Pago dividido: un mismo pedido pagado con varios mÃ©todos
   (ej. $2 en efectivo y $8 en pago mÃ³vil).

   Cada pedido guarda `payments: [{ method, amount, ref }]` con el monto en
   USD de cada mÃ©todo. `order.pay` queda como texto resumen ("Efectivo + Pago
   mÃ³vil") y `order.payRef` con las referencias, para que todo lo que ya leÃ­a
   esos dos campos siga funcionando.
   ============================================================ */

export const PAY_CASH = 'Efectivo';

/**
 * Pago a crÃ©dito: la comida sale, el dinero no entra todavÃ­a.
 *
 * No estÃ¡ en PAY_METHODS a propÃ³sito. PAY_METHODS es la lista de mÃ©todos que
 * se pueden DIVIDIR en un mismo pedido, y un crÃ©dito partido ("$5 ahora y $5
 * despuÃ©s") obligarÃ­a a llevar saldos por venta. Mientras el crÃ©dito sea del
 * pedido completo, una venta a crÃ©dito es una deuda y se cierra de una sola vez.
 */
export const PAY_CREDIT = 'CrÃ©dito';

export const PAY_METHODS = [PAY_CASH, PAY_MOBILE, PAY_CARD];

/** Lo que se le ofrece al cajero al cobrar (incluye crÃ©dito). */
export const PAY_METHODS_ALL = [...PAY_METHODS, PAY_CREDIT];

/** Tope de partes de pago en un mismo pedido. Un mÃ©todo puede repetirse. */
export const MAX_SPLIT_PARTS = PAY_METHODS.length;

export function roundMoney(value) {
return Math.round((Number(value) || 0) * 100) / 100;
}

/** Acepta "2,5" o "2.5"; devuelve 0 si no es un nÃºmero vÃ¡lido. */
export function parseAmount(value) {
const number = Number(String(value ?? '').trim().replace(',', '.'));
return Number.isFinite(number) && number > 0 ? number : 0;
}

/** Fila vacÃ­a del formulario de pago dividido. */
export function createPayPart(method, amount = '', ref = '') {
return { id: `${Date.now()}-${Math.random()}`, method, amount, ref };
}

/**
 * Pagos de un pedido. Los pedidos y ventas guardados ANTES de esta funciÃ³n no
 * tienen `payments`: se reconstruyen con su Ãºnico mÃ©todo y el total completo.
 */
export function getOrderPayments(order) {
if (Array.isArray(order?.payments) && order.payments.length > 0) return order.payments;
if (!order?.pay) return [];
return [{ method: order.pay, amount: roundMoney(order.total), ref: order.payRef || '' }];
}

export function isSplitPayment(order) {
return getOrderPayments(order).length > 1;
}

/** "Efectivo + Pago mÃ³vil" */
export function buildPayLabel(payments) {
return [...new Set(payments.map(part => part.method))].join(' + ');
}

/** Referencias de los mÃ©todos que la llevan, en un solo texto. */
export function buildPayRefText(payments) {
return payments.map(part => part.ref).filter(Boolean).join(' / ');
}

/** Lo que falta (+) o sobra (â) para igualar el total. */
export function getSplitRemaining(parts, total) {
const paid = parts.reduce((sum, part) => sum + parseAmount(part.amount), 0);
return roundMoney(total - paid);
}

/**
 * Valida el pago dividido contra el total del pedido.
 * Devuelve `null` si estÃ¡ bien, o el mensaje para mostrarle al cajero.
 */
export function validateSplit(parts, total) {
if (parts.length < 2) return 'Agrega al menos dos mÃ©todos de pago.';

if (parts.some(part => parseAmount(part.amount) <= 0)) return 'Escribe el monto de cada mÃ©todo de pago.';

const remaining = getSplitRemaining(parts, total);
if (remaining > 0) return `Faltan $${remaining.toFixed(2)} para cubrir el total.`;
if (remaining < 0) return `Los montos se pasan del total por $${Math.abs(remaining).toFixed(2)}.`;

if (parts.some(part => needsPayRef(part.method) && !isValidPayRef(part.ref))) {
return `Escribe los ${PAY_REF_LENGTH} Ãºltimos dÃ­gitos de la referencia de cada pago.`;
}

// Dos cobros del MISMO mÃ©todo no pueden compartir referencia: son dos
// transacciones distintas en el banco, asÃ­ que es un error de tipeo (pegar la
// misma dos veces). Entre mÃ©todos distintos sÃ­ puede coincidir por azar, y por
// eso ese caso no se bloquea.
const seen = new Set();
for (const part of parts) {
if (!needsPayRef(part.method)) continue;
const key = `${part.method}|${part.ref}`;
if (seen.has(key)) return `Hay dos pagos de ${part.method} con la misma referencia (${part.ref}). Revisa el comprobante.`;
seen.add(key);
}
return null;
}

/** Convierte las filas del formulario en los pagos que se guardan en el pedido. */
export function partsToPayments(parts) {
return parts.map(part => ({
method: part.method,
amount: roundMoney(parseAmount(part.amount)),
ref: needsPayRef(part.method) ? part.ref : '',
}));
}

/** Pagos guardados -> filas del formulario (para corregir un pedido). */
export function paymentsToParts(payments) {
return payments.map(part => createPayPart(part.method, Number(part.amount).toFixed(2), part.ref || ''));
}

/**
 * Parte del total en Bs que corresponde a un pago, proporcional a su monto.
 * AsÃ­ cada mÃ©todo cuenta con la tasa con la que se cobrÃ³ el pedido.
 */
export function paymentBs(sale, payment) {
// Sin tasa BCV el pedido se guardÃ³ con totalBs = null: Number(null) es 0 y
// habrÃ­a mostrado "Bs. 0,00" como si fuera un monto real.
if (sale?.totalBs === null || sale?.totalBs === undefined || sale?.totalBs === '') return null;
const totalBs = Number(sale.totalBs);
const total = Number(sale?.total);
if (!Number.isFinite(totalBs) || !(total > 0)) return null;
return totalBs * (Number(payment.amount) / total);
}