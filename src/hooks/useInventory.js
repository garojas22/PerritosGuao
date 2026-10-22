import { useEffect, useState } from 'react';
import { getBusinessDayKey } from '../utils/salesReport';

export const INVENTORY_STORAGE_KEY = 'perritos_guao_inventory';
export const INVENTORY_START_KEY = 'perritos_guao_inventory_start';
// Insumos creados por el admin desde la app; sobreviven a actualizaciones del código.
export const CUSTOM_ITEMS_KEY = 'perritos_guao_inventory_items_custom';

/** Mismos días de historial que el registro de ventas (ver useSales.js). */
const RETENTION_DAYS = 90;

function loadStock(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffKey = getBusinessDayKey(cutoff);

    return Object.fromEntries(
      Object.entries(parsed).filter(([dateKey, entries]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(dateKey) &&
        entries && typeof entries === 'object' && !Array.isArray(entries) &&
        dateKey >= cutoffKey
      )
    );
  } catch (error) {
    console.warn('No se pudo cargar el inventario:', error);
    return {};
  }
}

/** Cambia (o borra, con null) un insumo dentro de un mapa { día: { insumo: número } }. */
function withEntry(map, dateKey, itemId, value) {
  const day = { ...(map[dateKey] || {}) };
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    delete day[itemId];
  } else {
    day[itemId] = Number(value);
  }

  const next = { ...map };
  if (Object.keys(day).length === 0) delete next[dateKey];
  else next[dateKey] = day;
  return next;
}

function loadCustomItems() {
  try {
    const raw = localStorage.getItem(CUSTOM_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('No se pudieron cargar los insumos personalizados:', error);
    return [];
  }
}

/**
 * Entradas de inventario por día: cuántas unidades de cada insumo ingresaron
 * (o se ajustaron, con número negativo) ese día. { "2026-10-10": { "pan-brioche": 300 } }
 *
 * Lo que se VENDIÓ no se guarda aquí: sale de las ventas cobradas, así que
 * anular un cobro devuelve solo los insumos al inventario.
 */
export function useInventory() {
  const [stockByDay, setStockByDay] = useState(() => loadStock(INVENTORY_STORAGE_KEY));
  // Correcciones del sobrante con que empieza cada día (conteo real que
  // reemplaza lo que arrastraba el cálculo). { "2026-10-10": { "pan-brioche": 9 } }
  const [startByDay, setStartByDay] = useState(() => loadStock(INVENTORY_START_KEY));
  // Insumos creados por el admin; se mezclan con INVENTORY_ITEMS en App.jsx.
  const [customItems, setCustomItems] = useState(loadCustomItems);

  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(stockByDay));
    } catch (error) {
      console.warn('No se pudo guardar el inventario:', error);
    }
  }, [stockByDay]);

  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_START_KEY, JSON.stringify(startByDay));
    } catch (error) {
      console.warn('No se pudo guardar el inventario:', error);
    }
  }, [startByDay]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(customItems));
    } catch (error) {
      console.warn('No se pudieron guardar los insumos personalizados:', error);
    }
  }, [customItems]);

  /** Guarda lo ingresado de un insumo en un día. `null` borra la entrada. */
  function setStockEntry(dateKey, itemId, value) {
    setStockByDay(prev => withEntry(prev, dateKey, itemId, value));
  }

  /** Corrige el sobrante con que empieza un día. `null` vuelve al cálculo automático. */
  function setStartEntry(dateKey, itemId, value) {
    setStartByDay(prev => withEntry(prev, dateKey, itemId, value));
  }

  /** Borra todo lo ingresado y corregido en un día. */
  function clearStockDay(dateKey) {
    setStockByDay(prev => withEntry({ ...prev, [dateKey]: {} }, dateKey, '', null));
    setStartByDay(prev => withEntry({ ...prev, [dateKey]: {} }, dateKey, '', null));
  }

  /**
   * Guarda un insumo nuevo o actualiza uno existente (por id).
   * Los insumos creados aquí se mezclan con INVENTORY_ITEMS en App.jsx.
   * Un insumo con ventas registradas NO se borra, solo se desactiva.
   */
  function saveCustomItem(item) {
    setCustomItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
  }

  return { stockByDay, startByDay, setStockEntry, setStartEntry, clearStockDay, customItems, saveCustomItem };
}