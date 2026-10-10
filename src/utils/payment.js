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