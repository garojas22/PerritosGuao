/**
 * PIN del administrador.
 *
 * Qué hace: separa el "modo trabajador" (por defecto) del "modo administrador"
 * (editar productos, eliminar pedidos, ver y exportar el cierre de caja).
 *
 * Qué NO hace, y es importante saberlo: todo esto vive en el navegador del
 * local. El PIN se guarda con hash (nunca en texto plano), pero quien abra las
 * herramientas de desarrollador (F12) puede borrarlo o editar los datos
 * directamente. Frena al empleado curioso, no a uno que sepa de computadores.
 * La protección real requiere servidor (ver plan de Supabase).
 */

const PIN_KEY = 'perritos_guao_admin_pin';
const LOCK_KEY = 'perritos_guao_admin_lock';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

/** Tras MAX_FAILS intentos fallidos seguidos, se bloquea el acceso un minuto. */
const MAX_FAILS = 5;
const LOCK_MS = 60 * 1000;

export function isValidPinFormat(pin) {
return /^\d+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH;
}

function toHex(buffer) {
return Array.from(new Uint8Array(buffer))
.map(byte => byte.toString(16).padStart(2, '0'))
.join('');
}

async function hashPin(pin, salt) {
// crypto.subtle solo existe en https o localhost. Vercel y Codespaces son
// https, así que en producción siempre está disponible.
if (!globalThis.crypto?.subtle) {
throw new Error('Este navegador no permite crear el PIN en una conexión no segura.');
}
const data = new TextEncoder().encode(`${salt}:${pin}`);
return toHex(await globalThis.crypto.subtle.digest('SHA-256', data));
}

function readJson(key) {
try {
return JSON.parse(localStorage.getItem(key));
} catch (error) {
console.warn(`No se pudo leer ${key}:`, error);
return null;
}
}

export function hasAdminPin() {
const stored = readJson(PIN_KEY);
return Boolean(stored?.hash && stored?.salt);
}

/** Guarda un PIN nuevo (reemplaza el anterior si existía). */
export async function saveAdminPin(pin) {
if (!isValidPinFormat(pin)) {
throw new Error(`El PIN debe tener entre ${PIN_MIN_LENGTH} y ${PIN_MAX_LENGTH} dígitos.`);
}
const salt = toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
const hash = await hashPin(pin, salt);
localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash }));
localStorage.removeItem(LOCK_KEY);
}

/** Milisegundos que faltan para poder reintentar (0 si no hay bloqueo). */
export function getLockRemainingMs() {
const lock = readJson(LOCK_KEY);
if (!lock?.until) return 0;
return Math.max(0, lock.until - Date.now());
}

/**
 * Comprueba un PIN. Devuelve { ok, lockedMs, attemptsLeft }.
 * Los intentos fallidos se cuentan en localStorage para que refrescar la
 * página no reinicie el contador.
 */
export async function verifyAdminPin(pin) {
const lockedMs = getLockRemainingMs();
if (lockedMs > 0) return { ok: false, lockedMs, attemptsLeft: 0 };

const stored = readJson(PIN_KEY);
if (!stored?.hash || !stored?.salt) return { ok: false, lockedMs: 0, attemptsLeft: MAX_FAILS };

const matches = (await hashPin(pin, stored.salt)) === stored.hash;
if (matches) {
localStorage.removeItem(LOCK_KEY);
return { ok: true, lockedMs: 0, attemptsLeft: MAX_FAILS };
}

const previous = readJson(LOCK_KEY);
const fails = (previous?.fails || 0) + 1;
if (fails >= MAX_FAILS) {
localStorage.setItem(LOCK_KEY, JSON.stringify({ fails: 0, until: Date.now() + LOCK_MS }));
return { ok: false, lockedMs: LOCK_MS, attemptsLeft: 0 };
}
localStorage.setItem(LOCK_KEY, JSON.stringify({ fails, until: 0 }));
return { ok: false, lockedMs: 0, attemptsLeft: MAX_FAILS - fails };
}