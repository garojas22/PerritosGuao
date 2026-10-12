/**
 * Reglas de los métodos de pago que piden referencia.
 *
 * Viven aquí, en un solo lugar, porque las usan el carrito (para validar),
 * App (para decidir qué guardar) y el resto del sistema. Así los textos de los
 * métodos y el largo de la referencia no quedan repetidos y desincronizados.
 */

export const PAY_MOBILE = 'Pago móvil';
export const PAY_CARD = 'Tarjeta';

/** Cuántos dígitos se piden de la referencia (los últimos N). */
export const PAY_REF_LENGTH = 4;

/**
 * Pago móvil y tarjeta piden referencia: es lo que permite cuadrar cada cobro
 * contra el banco o el punto de venta. El efectivo no la necesita.
 */
export function needsPayRef(payType) {
return payType === PAY_MOBILE || payType === PAY_CARD;
}

/** Deja solo dígitos y corta al largo permitido. Se usa mientras se escribe. */
export function sanitizePayRef(value = '') {
return String(value).replace(/\D/g, '').slice(0, PAY_REF_LENGTH);
}

export function isValidPayRef(value = '') {
const text = String(value);
return text.length === PAY_REF_LENGTH && /^\d+$/.test(text);
}
/* ============================================================
   Pago dividido: un mismo pedido pagado con varios métodos
   (ej. $2 en efectivo y $8 en pago móvil).

   Cada pedido guarda `payments: [{ method, amount, ref }]` con el monto en
   USD de cada método. `order.pay` queda como texto resumen ("Efectivo + Pago
   móvil") y `order.payRef` con las referencias, para que todo lo que ya leía
   esos dos campos siga funcionando.
   ============================================================ */

export const PAY_CASH = 'Efectivo';
export const PAY_METHODS = [PAY_CASH, PAY_MOBILE, PAY_CARD];

/** Tope de partes de pago en un mismo pedido. Un método puede repetirse. */
export const MAX_SPLIT_PARTS = PAY_METHODS.length;

export function roundMoney(value) {
return Math.round((Number(value) || 0) * 100) / 100;
}

/** Acepta "2,5" o "2.5"; devuelve 0 si no es un número válido. */
export function parseAmount(value) {
const number = Number(String(value ?? '').trim().replace(',', '.'));
return Number.isFinite(number) && number > 0 ? number : 0;
}

/** Fila vacía del formulario de pago dividido. */
export function createPayPart(method, amount = '', ref = '') {
return { id: `${Date.now()}-${Math.random()}`, method, amount, ref };
}

/**
 * Pagos de un pedido. Los pedidos y ventas guardados ANTES de esta función no
 * tienen `payments`: se reconstruyen con su único método y el total completo.
 */
export function getOrderPayments(order) {
if (Array.isArray(order?.payments) && order.payments.length > 0) return order.payments;
if (!order?.pay) return [];
return [{ method: order.pay, amount: roundMoney(order.total), ref: order.payRef || '' }];
}

export function isSplitPayment(order) {
return getOrderPayments(order).length > 1;
}

/** "Efectivo + Pago móvil" */
export function buildPayLabel(payments) {
return [...new Set(payments.map(part => part.method))].join(' + ');
}

/** Referencias de los métodos que la llevan, en un solo texto. */
export function buildPayRefText(payments) {
return payments.map(part => part.ref).filter(Boolean).join(' / ');
}

/** Lo que falta (+) o sobra (−) para igualar el total. */
export function getSplitRemaining(parts, total) {
const paid = parts.reduce((sum, part) => sum + parseAmount(part.amount), 0);
return roundMoney(total - paid);
}

/**
 * Valida el pago dividido contra el total del pedido.
 * Devuelve `null` si está bien, o el mensaje para mostrarle al cajero.
 */
export function validateSplit(parts, total) {
if (parts.length < 2) return 'Agrega al menos dos métodos de pago.';

if (parts.some(part => parseAmount(part.amount) <= 0)) return 'Escribe el monto de cada método de pago.';

const remaining = getSplitRemaining(parts, total);
if (remaining > 0) return `Faltan $${remaining.toFixed(2)} para cubrir el total.`;
if (remaining < 0) return `Los montos se pasan del total por $${Math.abs(remaining).toFixed(2)}.`;

if (parts.some(part => needsPayRef(part.method) && !isValidPayRef(part.ref))) {
return `Escribe los ${PAY_REF_LENGTH} últimos dígitos de la referencia de cada pago.`;
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
 * Así cada método cuenta con la tasa con la que se cobró el pedido.
 */
export function paymentBs(sale, payment) {
const totalBs = Number(sale?.totalBs);
const total = Number(sale?.total);
if (!Number.isFinite(totalBs) || !(total > 0)) return null;
return totalBs * (Number(payment.amount) / total);
}