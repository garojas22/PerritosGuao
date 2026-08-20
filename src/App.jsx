import { useEffect, useState } from "react";
import { MENU } from "./data/menu.js";
import { useOrders } from "./hooks/useOrders.js";
import Header from "./components/Header.jsx";
import CategoryTabs from "./components/CategoryTabs.jsx";
import MenuGrid from "./components/MenuGrid.jsx";
import Cart from "./components/Cart.jsx";
import Ticket from "./components/Ticket.jsx";
import Board from "./components/Board.jsx";

const INGREDIENT_STOCK_KEY = "kitchen_ingredient_stock";

function normalizeIngredientKey(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildIngredientAvailability() {
  const availability = {};
  Object.values(MENU).forEach(items => {
    items.forEach(item => {
      if (!Array.isArray(item.ingredients)) return;
      item.ingredients.forEach(ingredient => {
        availability[normalizeIngredientKey(ingredient)] = true;
      });
    });
  });
  return availability;
}

function loadIngredientAvailability() {
  try {
    const stored = localStorage.getItem(INGREDIENT_STOCK_KEY);
    if (!stored) {
      return buildIngredientAvailability();
    }

    const parsed = JSON.parse(stored);
    return { ...buildIngredientAvailability(), ...parsed };
  } catch (error) {
    console.warn("No se pudo cargar el stock de cocina:", error);
    return buildIngredientAvailability();
  }
}

export default function App() {
  const [view, setView] = useState("order"); // "order" | "ticket" | "board"
  const [activeCat, setActiveCat] = useState(Object.keys(MENU)[0]);
  const [customer, setCustomer] = useState("");
  const [orderType, setOrderType] = useState("Local");
  const [payType, setPayType] = useState("Efectivo");
  const [lastOrder, setLastOrder] = useState(null);
  const [ingredientAvailability, setIngredientAvailability] = useState(loadIngredientAvailability);

  useEffect(() => {
    localStorage.setItem(INGREDIENT_STOCK_KEY, JSON.stringify(ingredientAvailability));
  }, [ingredientAvailability]);

  const {
    cart, orders, cartTotal,
    addToCart, updateQty, removeLine, toggleMod,
    generateTicket, advanceStatus,
  } = useOrders();

  function toggleIngredientAvailability(ingredient) {
    const ingredientKey = normalizeIngredientKey(ingredient);
    setIngredientAvailability(prev => ({
      ...prev,
      [ingredientKey]: !(prev[ingredientKey] ?? true),
    }));
  }

  function handleGenerate() {
    const trimmedCustomer = customer.trim();
    if (!trimmedCustomer) {
      return;
    }

    const order = generateTicket({ customer: trimmedCustomer, orderType, payType, ingredientAvailability });
    if (!order) {
      return;
    }

    setLastOrder(order);
    setCustomer("");
    setView("ticket");
  }

  const pendingCount = orders.filter(o => o.status !== "Listo").length;

  return (
    <>
      <Header view={view === "ticket" ? "order" : view} setView={setView} pendingCount={pendingCount} />

      <main>
        {view === "order" && (
          <div className="order-layout">
            <div>
              <CategoryTabs categories={Object.keys(MENU)} activeCat={activeCat} setActiveCat={setActiveCat} />
              <MenuGrid items={MENU[activeCat]} onAdd={addToCart} />
            </div>

            <Cart
              cart={cart}
              cartTotal={cartTotal}
              onQty={updateQty}
              onRemove={removeLine}
              onToggleMod={toggleMod}
              customer={customer} setCustomer={setCustomer}
              orderType={orderType} setOrderType={setOrderType}
              payType={payType} setPayType={setPayType}
              ingredientAvailability={ingredientAvailability}
              toggleIngredientAvailability={toggleIngredientAvailability}
              onGenerate={handleGenerate}
            />
          </div>
        )}

        {view === "ticket" && (
          <Ticket order={lastOrder} onNewOrder={() => setView("order")} />
        )}

        {view === "board" && (
          <Board orders={orders} onAdvance={advanceStatus} />
        )}
      </main>
    </>
  );
}
