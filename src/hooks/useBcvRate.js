import { useEffect, useState } from 'react';
import { getBusinessDayKey } from '../utils/salesReport';

const CACHE_KEY = 'bcv_rate_data';
const MANUAL_KEY = 'perritos_bcv_manual';

/** Cada cuánto se vuelve a consultar la API mientras la app está abierta.
 *  Antes se consultaba UNA sola vez al montar y se cacheaba por día: si el
 *  BCV movía la tasa a mediodía, el local seguía cobrando con la de la mañana
 *  hasta que alguien refrescara el navegador. */
const REFRESH_MS = 30 * 60 * 1000;

/* ============================================================
   Estado compartido

   Cart y Ticket llaman al hook por separado. Si cada uno guardara su propia
   tasa, el dueño podría fijar una manual y el comprobante seguiría imprimiendo
   la automática. Por eso la tasa vive aquí, en el módulo, y los componentes
   se suscriben.
   ============================================================ */
let autoRate = null;
let manualEntry = loadManual();
let fetching = false;
const listeners = new Set();

function notify() {
  listeners.forEach(listener => listener());
}

function loadManual() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MANUAL_KEY));
    if (parsed && Number.isFinite(Number(parsed.rate)) && Number(parsed.rate) > 0) {
      return { rate: Number(parsed.rate), setAt: parsed.setAt || null };
    }
  } catch { /* localStorage bloqueado o JSON corrupto */ }
  return null;
}

function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY));
    // getBusinessDayKey y no toISOString(): toISOString convierte a UTC y en
    // Venezuela (UTC-4) el "día" cambiaba a las 8 p. m., así que la caché se
    // invalidaba en plena noche de trabajo.
    if (parsed && parsed.date === getBusinessDayKey() && Number.isFinite(Number(parsed.rate))) {
      return Number(parsed.rate);
    }
  } catch { /* igual que arriba */ }
  return null;
}

function writeCache(rate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, date: getBusinessDayKey() }));
  } catch { /* localStorage lleno */ }
}

async function fetchRate({ force = false } = {}) {
  if (fetching) return;

  if (!force) {
    const cached = readCache();
    if (cached !== null && autoRate === null) {
      autoRate = cached;
      notify();
    }
  }

  fetching = true;
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const fetched = Number(data?.promedio);
    if (Number.isFinite(fetched) && fetched > 0) {
      autoRate = fetched;
      writeCache(fetched);
      notify();
    }
  } catch (error) {
    // Si falla se conserva lo último que se supo (la caché del día). Dejar la
    // tasa en null obligaría a cobrar sin Bs, que es peor que una tasa de hace
    // unas horas.
    console.warn('Error cargando tasa BCV:', error);
    if (autoRate === null) {
      const cached = readCache();
      if (cached !== null) { autoRate = cached; notify(); }
    }
  } finally {
    fetching = false;
  }
}

/** Fija la tasa a mano. Solo debe llamarse desde el modo administrador. */
export function setManualRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) return;
  manualEntry = { rate: value, setAt: new Date().toISOString() };
  try { localStorage.setItem(MANUAL_KEY, JSON.stringify(manualEntry)); } catch { /* lleno */ }
  notify();
}

/** Vuelve a la tasa automática. */
export function clearManualRate() {
  manualEntry = null;
  try { localStorage.removeItem(MANUAL_KEY); } catch { /* bloqueado */ }
  notify();
}

/** Horas que lleva puesta la tasa manual, o null si no hay. */
export function getManualAgeHours() {
  if (!manualEntry?.setAt) return null;
  const hours = (Date.now() - new Date(manualEntry.setAt).getTime()) / 3600000;
  return Number.isFinite(hours) ? hours : null;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Arranca la consulta y la repite; una sola vez aunque haya varios hooks. */
let started = false;
function start() {
  if (started) return;
  started = true;
  fetchRate();
  setInterval(() => fetchRate({ force: true }), REFRESH_MS);
  // Al volver a la pestaña se revisa: el local deja la app abierta todo el día.
  window.addEventListener('focus', () => fetchRate({ force: true }));
}

/**
 * Tasa que se debe usar para cobrar. La manual manda sobre la automática.
 * Devuelve un número (o null), igual que antes, para no tocar Cart ni Ticket.
 */
export function useBcvRate() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    start();
    return subscribe(() => forceRender(n => n + 1));
  }, []);

  return manualEntry ? manualEntry.rate : autoRate;
}

/** Lo mismo pero con el detalle, para el panel del administrador. */
export function useBcvRateInfo() {
  const rate = useBcvRate();
  return {
    rate,
    autoRate,
    isManual: manualEntry !== null,
    setAt: manualEntry?.setAt ?? null,
    ageHours: getManualAgeHours(),
  };
}
