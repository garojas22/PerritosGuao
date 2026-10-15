import { useEffect, useState } from "react";
import { nextOrderNumber } from "../utils/orderCounter.js";
import { describeLine, partTitle, getComboIssue, getDefaultSelection, resolveComboParts, resolveSelection } from "../utils/lineOptions.js";
import { buildPayLabel, buildPayRefText, roundMoney } from "../utils/payment.js";

// STATUS_FLOW define a qué estado salta un pedido al hacer clic en su tarjeta.
const STATUS_FLOW = { Pendiente: "Preparando", Preparando: "Listo", Listo: "Pendiente" };

/**
 * Encapsula todo el estado del sistema: el carrito en construcción,
 * la lista de pedidos generados, y las acciones que los modifican.
 * En un sistema real, generateTicket() haría un POST a la API en
 * lugar de solo empujar al array en memoria.
 */
function normalizeIngredientKey(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getIngredientKeyFromMod(mod = "") {
  const normalized = mod.trim();
  if (!normalized) return "";

  const withoutPrefix = normalized
    .replace(/^sin\s+/i, "")
    .replace(/^extra\s+/i, "")
    .replace(/^sabor\s+/i, "");

  return normalizeIngredientKey(withoutPrefix);
}

function copyOrderLine(line) {
  return {
    ...line,
    uses: (line.uses || []).map(use => ({ ...use })),
    ingredients: [...(line.ingredients || [])],
    availMods: [...(line.availMods || [])],
    mods: [...(line.mods || [])],
    ...(Array.isArray(line.parts) ? {
      parts: line.parts.map(part => ({
        ...part,
        uses: (part.uses || []).map(use => ({ ...use })),
        ingredients: [...(part.ingredients || [])],
        availMods: [...(part.availMods || [])],
        optionLabels: [...(part.optionLabels || [])],
        mods: [...(part.mods || [])],
      })),
    } : {}),
  };
}

const ORDERS_STORAGE_KEY = "perritos_guao_active_orders";

/**
 * Los pedidos activos (pendientes, en preparación y listos sin cobrar) se
 * guardan en el navegador: antes vivían solo en memoria y un refresco de la
 * página, o la tablet que se apaga, los borraba con la cocina trabajando.
 */
function loadOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(order =>
      order && order.num && Array.isArray(order.items) && order.status in STATUS_FLOW
    );
  } catch (error) {
    console.warn("No se pudieron cargar los pedidos activos:", error);
    return [];
  }
}

export function useOrders() {
  const [cart, setCart] = useState([]); // [{ uid, id, name, price, qty, availMods, mods }]
  const [orders, setOrders] = useState(loadOrders);

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    } catch (error) {
      console.warn("No se pudieron guardar los pedidos activos:", error);
    }
  }, [orders]);

  /**
   * Agrega un producto al carrito. Si tiene tamaños o elecciones (pan, carne),
   * `selection` trae lo que se eligió; si no se pasa, se usan los valores por
   * defecto. Todo lo elegido se guarda en la línea (precio, detalle e insumos
   * que gasta) para que un cambio posterior del menú no altere el pedido.
   */
  function addToCart(item, selection = null, productsById = {}) {
    // Una oferta con precio inválido o con un producto que ya no existe no se puede vender.
    if (item.hidden || getComboIssue(item, productsById)) return false;
    let parts = null;
    if (item.isCombo) {
      try {
        parts = resolveComboParts(item, productsById, selection || []);
      } catch (error) {
        console.warn(error.message);
        return false;
      }
    }
    const resolved = item.isCombo ? null : resolveSelection(item, selection ?? getDefaultSelection(item));
    const availableMods = Array.isArray(item.ingredients) && item.ingredients.length > 0
      ? item.ingredients.map(ingredient => `Sin ${ingredient}`)
      : Array.isArray(item.mods) ? item.mods : [];

    setCart(prev => [
      ...prev,
      {
        uid: Date.now() + Math.random(),
        id: item.id,
        name: item.name,
        isCombo: Boolean(item.isCombo),
        price: item.isCombo ? Number(item.price) : resolved.price,
        variantLabel: resolved?.variantLabel ?? '',
        optionLabels: resolved?.optionLabels ?? [],
        parts,
        uses: item.isCombo
          ? parts.flatMap(part => part.uses.map(use => ({ ...use })))
          : resolved.uses, // insumos que gasta UNA unidad (para el inventario)
        qty: 1,
        ingredients: item.ingredients ?? [],
        availMods: availableMods,
        mods: [],
      },
    ]);
    return true;
  }

  function updateQty(uid, delta) {
    setCart(prev => prev.map(l => l.uid === uid ? { ...l, qty: Math.max(1, l.qty + delta) } : l));
  }

  function removeLine(uid) {
    setCart(prev => prev.filter(l => l.uid !== uid));
  }

  function toggleMod(uid, mod, partIndex = null) {
    setCart(prev => prev.map(l => {
      if (l.uid !== uid) return l;
      if (l.isCombo && Number.isInteger(partIndex)) {
        return {
          ...l,
          parts: l.parts.map((part, index) => {
            if (index !== partIndex) return part;
            const has = part.mods.includes(mod);
            return { ...part, mods: has ? part.mods.filter(m => m !== mod) : [...part.mods, mod] };
          }),
        };
      }
      const has = l.mods.includes(mod);
      return { ...l, mods: has ? l.mods.filter(m => m !== mod) : [...l.mods, mod] };
    }));
  }

  // Redondeado a centavos: sumar precios con decimales deja restos tipo 13.490000000000002.
  const cartTotal = roundMoney(cart.reduce((s, l) => s + l.price * l.qty, 0));

  function getStoredBcvRate() {
    try {
      const raw = localStorage.getItem('bcv_rate_data');
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const today = new Date().toISOString().split('T')[0];

      if (parsed && parsed.date === today && typeof parsed.rate === 'number' && Number.isFinite(parsed.rate)) {
        return parsed.rate;
      }
    } catch (error) {
      console.warn('No se pudo leer la tasa BCV del localStorage:', error);
    }

    return null;
  }

  /** Carga un pedido existente en el carrito para poder corregirlo. */
  function loadCartFromOrder(order) {
    setCart(order.items.map(copyOrderLine));
  }

  function clearCart() {
    setCart([]);
  }

  /**
   * Genera un pedido nuevo o, si se pasa replaceNum, CORRIGE uno existente.
   *
   * Corregir conserva el mismo número, la hora original y el estado, y reemplaza
   * el pedido en su sitio. No se crea un número nuevo ni se borra nada: así la
   * numeración no deja huecos y el pedido original nunca desaparece sin dejar
   * rastro. Cada corrección guarda en `edits` cómo era antes, para que el
   * administrador pueda verlo en el cierre de caja.
   */
  function generateTicket({ customer, orderType, deliveryFee = 0, payments, ingredientAvailability = {}, replaceNum = null }) {
    const trimmedCustomer = customer.trim();
    if (!trimmedCustomer || !Array.isArray(payments) || payments.length === 0) {
      return null;
    }

    const rate = getStoredBcvRate();
    const chargedDeliveryFee = orderType === "Delivery"
      ? roundMoney(Math.max(0, Number(deliveryFee) || 0))
      : 0;
    const total = roundMoney(cartTotal + chargedDeliveryFee);
    const totalBs = rate !== null ? total * rate : null;
    const stockWarnings = new Set();

    cart.forEach(item => {
      const parts = item.isCombo
        ? item.parts.map(part => ({ name: part.label || part.name, mods: part.mods }))
        : [{ name: item.name, mods: item.mods }];
      parts.forEach(part => {
        const unavailable = [];
        part.mods.forEach(mod => {
          const ingredientKey = getIngredientKeyFromMod(mod);
          if (!ingredientKey) return;
          if (ingredientAvailability[ingredientKey] === false) {
            unavailable.push(ingredientKey);
          }
        });
        if (unavailable.length > 0) {
          stockWarnings.add(JSON.stringify({ partName: part.name, ingredients: unavailable }));
        }
      });
    });

    // Solo se puede corregir un pedido que sigue activo y que aún no está listo.
    const previous = replaceNum
      ? orders.find(o => o.num === replaceNum && o.status !== "Listo")
      : null;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

    // Un pedido activo de un día anterior puede seguir en el tablero: si el número
    // que toca ya lo usa alguno, se salta al siguiente para no mezclarlos.
    let num = previous ? previous.num : nextOrderNumber(); // persistente: no se reinicia al refrescar (ver orderCounter.js)
    while (!previous && orders.some(existing => existing.num === num)) {
      num = nextOrderNumber();
    }

    const order = {
      num,
      customer: trimmedCustomer,
      type: orderType,
      deliveryFee: chargedDeliveryFee,
      // `payments` es el detalle real: [{ method, amount (USD), ref }]. Uno solo
      // si se pagó con un método, varios si el pago fue dividido (ver payment.js).
      // `pay` y `payRef` son el resumen en texto que ya leían el tablero, el
      // comprobante y el Excel: "Efectivo + Pago móvil" y las referencias.
      payments,
      pay: buildPayLabel(payments),
      payRef: buildPayRefText(payments),
      items: cart.map(copyOrderLine),
      total,
      totalBs,
      bcvRate: rate, // se guarda la tasa usada, para poder auditar el cierre de caja
      stockWarnings: Array.from(stockWarnings, warning => JSON.parse(warning)),
      status: previous ? previous.status : "Pendiente",
      time: previous ? previous.time : timeLabel,
      revision: previous ? (previous.revision || 0) + 1 : 0,
      edits: previous
        ? [
            ...(previous.edits || []),
            {
              at: now.toISOString(),
              time: timeLabel,
              prevTotal: previous.total,
              prevPay: previous.pay,
              prevPayments: previous.payments ?? null,
              prevItems: previous.items.map(line => {
                if (line.isCombo) {
                  const parts = line.parts.map(part => {
                    const detail = [part.variantLabel, ...(part.optionLabels || []), ...(part.mods || [])].filter(Boolean).join(", ");
                    return `${partTitle(part)}${detail ? ` (${detail})` : ""}`;
                  }).join("; ");
                  return `${line.qty}x ${line.name}${parts ? `: ${parts}` : ""}`;
                }
                const detail = [describeLine(line), ...(line.mods || [])].filter(Boolean).join(", ");
                return `${line.qty}x ${line.name}${detail ? ` (${detail})` : ""}`;
              }),
            },
          ]
        : [],
    };

    if (previous) {
      setOrders(prev => prev.map(o => (o.num === previous.num ? order : o)));
    } else {
      setOrders(prev => [order, ...prev]);
    }
    setCart([]);
    return order;
  }

  function advanceStatus(num) {
    setOrders(prev => prev.map(o => o.num === num ? { ...o, status: STATUS_FLOW[o.status] } : o));
  }

  function removeOrder(num) {
    setOrders(prev => prev.filter(o => o.num !== num));
  }

  return { cart, orders, cartTotal, addToCart, updateQty, removeLine, toggleMod, loadCartFromOrder, clearCart, generateTicket, advanceStatus, removeOrder };
}