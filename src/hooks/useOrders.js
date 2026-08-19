import { useState, useRef } from "react";

// STATUS_FLOW define a qué estado salta un pedido al hacer clic en su tarjeta.
const STATUS_FLOW = { Pendiente: "Preparando", Preparando: "Listo", Listo: "Pendiente" };

/**
 * Encapsula todo el estado del sistema: el carrito en construcción,
 * la lista de pedidos generados, y las acciones que los modifican.
 * En un sistema real, generateTicket() haría un POST a la API en
 * lugar de solo empujar al array en memoria.
 */
export function useOrders() {
  const [cart, setCart] = useState([]); // [{ uid, id, name, price, qty, availMods, mods }]
  const [orders, setOrders] = useState([]);
  const orderCounter = useRef(1);

  function addToCart(item) {
    setCart(prev => [
      ...prev,
      { uid: Date.now() + Math.random(), id: item.id, name: item.name, price: item.price, qty: 1, availMods: item.mods, mods: [] },
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

  function generateTicket({ customer, orderType, payType }) {
    const order = {
      num: String(orderCounter.current++).padStart(3, "0"),
      customer: customer.trim() || "Cliente sin nombre",
      type: orderType,
      pay: payType,
      items: cart,
      total: cartTotal,
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

  return { cart, orders, cartTotal, addToCart, updateQty, removeLine, toggleMod, generateTicket, advanceStatus };
}
