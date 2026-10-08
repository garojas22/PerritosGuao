import { useCallback, useEffect, useRef, useState } from 'react';
import { hasAdminPin, saveAdminPin, verifyAdminPin } from '../utils/adminPin';

/**
 * Rol de quien está usando el sistema: "trabajador" (por defecto) o
 * "administrador" (tras ingresar el PIN).
 *
 * La sesión de administrador:
 * - Se guarda en sessionStorage (no localStorage): sobrevive a refrescar la
 *   página, pero se pierde al cerrar la pestaña.
 * - Se cierra sola tras IDLE_LIMIT_MS sin tocar nada, para que un admin que
 *   se olvida de salir no deje el modo abierto para el siguiente turno.
 */
const SESSION_KEY = 'perritos_guao_admin_session';
const IDLE_LIMIT_MS = 5 * 60 * 1000;
const CHECK_EVERY_MS = 15 * 1000;
const WRITE_THROTTLE_MS = 5 * 1000;

function readSession() {
try {
const lastActivity = Number(sessionStorage.getItem(SESSION_KEY));
return Number.isFinite(lastActivity) && lastActivity > 0 && Date.now() - lastActivity < IDLE_LIMIT_MS;
} catch (error) {
return false;
}
}

function writeSession(timestamp) {
try {
sessionStorage.setItem(SESSION_KEY, String(timestamp));
} catch (error) {
console.warn('No se pudo guardar la sesión de administrador:', error);
}
}

function clearSession() {
try {
sessionStorage.removeItem(SESSION_KEY);
} catch (error) {
// sin sessionStorage no hay nada que limpiar
}
}

export function useRole() {
const [isAdmin, setIsAdmin] = useState(readSession);
const [hasPin, setHasPin] = useState(hasAdminPin);
const lastActivity = useRef(Date.now());
const lastWrite = useRef(0);

const lock = useCallback(() => {
clearSession();
setIsAdmin(false);
}, []);

function startSession() {
const now = Date.now();
lastActivity.current = now;
lastWrite.current = now;
writeSession(now);
setIsAdmin(true);
}

/** Intenta entrar como administrador. Devuelve el resultado de verifyAdminPin. */
async function tryUnlock(pin) {
const result = await verifyAdminPin(pin);
if (result.ok) startSession();
return result;
}

/** Crea el PIN por primera vez (o lo reemplaza) y entra como administrador. */
async function setupPin(pin) {
await saveAdminPin(pin);
setHasPin(true);
startSession();
}

useEffect(() => {
if (!isAdmin) return undefined;

function touch() {
    const now = Date.now();
    lastActivity.current = now;
    // Se escribe como máximo cada WRITE_THROTTLE_MS para no martillar el storage.
    if (now - lastWrite.current > WRITE_THROTTLE_MS) {
    writeSession(now);
    lastWrite.current = now;
    }
}

const events = ['pointerdown', 'keydown', 'touchstart'];
events.forEach(name => window.addEventListener(name, touch, true));
const timer = setInterval(() => {
    if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) lock();
}, CHECK_EVERY_MS);

return () => {
    events.forEach(name => window.removeEventListener(name, touch, true));
    clearInterval(timer);
};
}, [isAdmin, lock]);

return { isAdmin, hasPin, tryUnlock, setupPin, lock };
}