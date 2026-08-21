import { useState, useRef } from "react";

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
  const orderCounter = useRef(1);

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

  function generateTicket({ customer, orderType, payType, ingredientAvailability = {} }) {
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

    const order = {
      num: String(orderCounter.current++).padStart(3, "0"),
      customer: trimmedCustomer,
      type: orderType,
      pay: payType,
      items: cart,
      total: cartTotal,
      totalBs,
      stockWarnings: Array.from(stockWarnings),
      status: "Pendiente",
      time: new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
    };
    setOrders(prev => [order, ...prev]);
    setCart([]);
    return order;
  }

  function advanceStatus(num) {
    setOrders(prev => prev.map(o => o.num === num ? { ...o, status: STATUS_FLOW[o.status] } : o));
  }

  function removeOrder(num) {
    setOrders(prev => prev.filter(o => o.num !== num));
  }

  return { cart, orders, cartTotal, addToCart, updateQty, removeLine, toggleMod, generateTicket, advanceStatus, removeOrder };
}
