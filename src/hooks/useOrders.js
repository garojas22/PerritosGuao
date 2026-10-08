import { useState } from "react";
import { nextOrderNumber } from "../utils/orderCounter.js";

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

export function useOrders() {
  const [cart, setCart] = useState([]); // [{ uid, id, name, price, qty, availMods, mods }]
  const [orders, setOrders] = useState([]);

  function addToCart(item) {
    const availableMods = Array.isArray(item.ingredients) && item.ingredients.length > 0
      ? item.ingredients.map(ingredient => `Sin ${ingredient}`)
      : Array.isArray(item.mods) ? item.mods : [];

    setCart(prev => [
      ...prev,
      {
        uid: Date.now() + Math.random(),
        id: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        ingredients: item.ingredients ?? [],
        availMods: availableMods,
        mods: [],
      },
    ]);
  }

  function updateQty(uid, delta) {
    setCart(prev => prev.map(l => l.uid === uid ? { ...l, qty: Math.max(1, l.qty + delta) } : l));
  }

  function removeLine(uid) {
    setCart(prev => prev.filter(l => l.uid !== uid));
  }

  function toggleMod(uid, mod) {
    setCart(prev => prev.map(l => {
      if (l.uid !== uid) return l;
      const has = l.mods.includes(mod);
      return { ...l, mods: has ? l.mods.filter(m => m !== mod) : [...l.mods, mod] };
    }));
  }

  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);

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
    setCart(order.items.map(line => ({ ...line, mods: [...line.mods] })));
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
  function generateTicket({ customer, orderType, payType, payRef = "", ingredientAvailability = {}, replaceNum = null }) {
    const trimmedCustomer = customer.trim();
    if (!trimmedCustomer) {
      return null;
    }

    const rate = getStoredBcvRate();
    const totalBs = rate !== null ? cartTotal * rate : null;
    const stockWarnings = new Set();

    cart.forEach(item => {
      item.mods.forEach(mod => {
        const ingredientKey = getIngredientKeyFromMod(mod);
        if (!ingredientKey) return;
        if (ingredientAvailability[ingredientKey] === false) {
          stockWarnings.add(ingredientKey);
        }
      });
    });

    // Solo se puede corregir un pedido que sigue activo y que aún no está listo.
    const previous = replaceNum
      ? orders.find(o => o.num === replaceNum && o.status !== "Listo")
      : null;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

    const order = {
      num: previous ? previous.num : nextOrderNumber(), // persistente: no se reinicia al refrescar (ver orderCounter.js)
      customer: trimmedCustomer,
      type: orderType,
      pay: payType,
      payRef, // últimos 4 dígitos de la referencia; "" si no fue pago móvil
      items: cart,
      total: cartTotal,
      totalBs,
      bcvRate: rate, // se guarda la tasa usada, para poder auditar el cierre de caja
      stockWarnings: Array.from(stockWarnings),
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
              prevItems: previous.items.map(line =>
                `${line.qty}x ${line.name}${line.mods.length ? ` (${line.mods.join(", ")})` : ""}`
              ),
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