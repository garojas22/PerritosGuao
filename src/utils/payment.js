/**
 * Reglas del método de pago "Pago móvil" y su referencia.
 *
 * Viven aquí, en un solo lugar, porque las usan el carrito (para validar),
 * App (para decidir qué guardar) y el resto del sistema. Así el texto
 * "Pago móvil" y el largo de la referencia no quedan repetidos y
 * desincronizados entre archivos.
 */

export const PAY_MOBILE = 'Pago móvil';

/** Cuántos dígitos se piden de la referencia (los últimos N). */
export const PAY_REF_LENGTH = 4;

export function isMobilePay(payType) {
return payType === PAY_MOBILE;
}

/** Deja solo dígitos y corta al largo permitido. Se usa mientras se escribe. */
export function sanitizePayRef(value = '') {
return String(value).replace(/\D/g, '').slice(0, PAY_REF_LENGTH);
}

export function isValidPayRef(value = '') {
const text = String(value);
return text.length === PAY_REF_LENGTH && /^\d+$/.test(text);
}