import { useEffect, useState } from 'react';
import { getBusinessDayKey } from '../utils/salesReport';

export const SALES_STORAGE_KEY = 'perritos_guao_sales';

/** DÃ­as de historial que se conservan. MÃ¡s allÃ¡ de eso se descartan solos
 *  para que localStorage no crezca sin lÃ­mite. */
const RETENTION_DAYS = 90;

function loadSales() {
  try {
    const raw = localStorage.getItem(SALES_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    // Se descartan dÃ­as viejos y cualquier clave con formato inesperado.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffKey = getBusinessDayKey(cutoff);

    return Object.fromEntries(
      Object.entries(parsed).filter(([dateKey, list]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Array.isArray(list) && dateKey >= cutoffKey
      )
    );
  } catch (error) {
    console.warn('No se pudo cargar el registro de ventas:', error);
    return {};
  }
}

/**
 * Registro de ventas cerradas, agrupado por dÃ­a de caja y persistido en
 * localStorage.
 *
 * A diferencia de `orders` (que es el tablero de trabajo y se puede vaciar),
 * esto es el libro contable: una vez que un pedido se cobra entra aquÃ­ y
 * sobrevive a refrescos y cierres del navegador.
 */
export function useSales() {
  const [salesByDay, setSalesByDay] = useState(loadSales);

  useEffect(() => {
    try {
      localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(salesByDay));
    } catch (error) {
      console.warn('No se pudo guardar el registro de ventas:', error);
    }
  }, [salesByDay]);

  /** Registra un pedido como venta cobrada. Idempotente: si ese pedido ya
   *  fue cobrado hoy no se duplica (protege contra dobles clics). */
  function recordSale(order) {
    if (!order) return null;

    const now = new Date();
    const dateKey = getBusinessDayKey(now);

    const sale = {
      ...order,
      saleId: `${dateKey}-${order.num}-${now.getTime()}`,
      dateKey,
      closedAt: now.toISOString(),
      closedTime: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
    };

    setSalesByDay(prev => {
      const dayList = prev[dateKey] || [];
      if (dayList.some(existing => existing.num === order.num && existing.time === order.time)) {
        return prev; // ya registrado, no duplicar
      }
      return { ...prev, [dateKey]: [...dayList, sale] };
    });

    return sale;
  }

  /**
   * Anula un cobro SIN borrarlo: queda en el registro, tachado, con el motivo
   * y la hora. No borrar es lo que permite que el dueÃ±o vea tres anulaciones
   * de $8 del mismo trabajador en la misma semana.
   */
  function voidSale(dateKey, saleId, reason) {
    const motivo = String(reason || '').trim();
    if (!motivo) return false;

    setSalesByDay(prev => {
      const dayList = prev[dateKey];
      if (!Array.isArray(dayList)) return prev;
      return {
        ...prev,
        [dateKey]: dayList.map(sale => (
          sale.saleId === saleId && !sale.voided
            ? { ...sale, voided: { at: new Date().toISOString(), reason: motivo } }
            : sale
        )),
      };
    });
    return true;
  }

  /** Deshace una anulaciÃ³n. Solo el administrador deberÃ­a poder llamarla. */
  function unvoidSale(dateKey, saleId) {
    setSalesByDay(prev => {
      const dayList = prev[dateKey];
      if (!Array.isArray(dayList)) return prev;
      return {
        ...prev,
        [dateKey]: dayList.map(sale => {
          if (sale.saleId !== saleId) return sale;
          const { voided, ...rest } = sale;
          return rest;
        }),
      };
    });
  }

  /**
   * Marca una venta a crÃ©dito como pagada. Solo el administrador: si el
   * trabajador pudiera cerrarla, bastarÃ­a con cobrar en efectivo y marcar
   * "pagado" para que la plata no apareciera por ningÃºn lado.
   */
  function settleCredit(dateKey, saleId, method) {
    setSalesByDay(prev => {
      const dayList = prev[dateKey];
      if (!Array.isArray(dayList)) return prev;
      return {
        ...prev,
        [dateKey]: dayList.map(sale => (
          sale.saleId === saleId && !sale.creditPaid
            ? { ...sale, creditPaid: { at: new Date().toISOString(), method: method || 'Efectivo' } }
            : sale
        )),
      };
    });
  }

  /** Reabre una deuda marcada como pagada por error. */
  function reopenCredit(dateKey, saleId) {
    setSalesByDay(prev => {
      const dayList = prev[dateKey];
      if (!Array.isArray(dayList)) return prev;
      return {
        ...prev,
        [dateKey]: dayList.map(sale => {
          if (sale.saleId !== saleId) return sale;
          const { creditPaid, ...rest } = sale;
          return rest;
        }),
      };
    });
  }

  /** Quita una venta del registro (para corregir un cobro hecho por error). */
  function removeSale(dateKey, saleId) {
    setSalesByDay(prev => {
      const dayList = prev[dateKey];
      if (!Array.isArray(dayList)) return prev;
      return { ...prev, [dateKey]: dayList.filter(sale => sale.saleId !== saleId) };
    });
  }

  /** Borra por completo el registro de un dÃ­a. */
  function clearDay(dateKey) {
    setSalesByDay(prev => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
  }

  const today = getBusinessDayKey();
  const availableDays = Object.keys(salesByDay)
    .filter(day => (salesByDay[day] || []).length > 0)
    .sort((a, b) => b.localeCompare(a));

  return {
    salesByDay,
    todaySales: salesByDay[today] || [],
    today,
    availableDays,
    recordSale,
    removeSale,
    voidSale,
    unvoidSale,
    settleCredit,
    reopenCredit,
    clearDay,
  };
}