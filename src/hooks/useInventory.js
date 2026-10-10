import { useEffect, useState } from 'react';
import { getBusinessDayKey } from '../utils/salesReport';

export const INVENTORY_STORAGE_KEY = 'perritos_guao_inventory';

/** Mismos días de historial que el registro de ventas (ver useSales.js). */
const RETENTION_DAYS = 90;

function loadStock() {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
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

/**
 * Entradas de inventario por día: cuántas unidades de cada insumo ingresaron
 * (o se ajustaron, con número negativo) ese día. { "2026-10-10": { "pan-brioche": 300 } }
 *
 * Lo que se VENDIÓ no se guarda aquí: sale de las ventas cobradas, así que
 * anular un cobro devuelve solo los insumos al inventario.
 */
export function useInventory() {
  const [stockByDay, setStockByDay] = useState(loadStock);

  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(stockByDay));
    } catch (error) {
      console.warn('No se pudo guardar el inventario:', error);
    }
  }, [stockByDay]);

  /** Guarda lo ingresado de un insumo en un día. `null` borra la entrada. */
  function setStockEntry(dateKey, itemId, value) {
    setStockByDay(prev => {
      const day = { ...(prev[dateKey] || {}) };
      if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        delete day[itemId];
      } else {
        day[itemId] = Number(value);
      }

      const next = { ...prev };
      if (Object.keys(day).length === 0) delete next[dateKey];
      else next[dateKey] = day;
      return next;
    });
  }

  /** Borra todo lo ingresado en un día. */
  function clearStockDay(dateKey) {
    setStockByDay(prev => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
  }

  return { stockByDay, setStockEntry, clearStockDay };
}