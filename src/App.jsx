import { useState } from "react";
import { MENU } from "./data/menu.js";
import { useOrders } from "./hooks/useOrders.js";
import Header from "./components/Header.jsx";
import CategoryTabs from "./components/CategoryTabs.jsx";
import MenuGrid from "./components/MenuGrid.jsx";
import Cart from "./components/Cart.jsx";
import Ticket from "./components/Ticket.jsx";
import Board from "./components/Board.jsx";

export default function App() {
  const [view, setView] = useState("order"); // "order" | "ticket" | "board"
  const [activeCat, setActiveCat] = useState(Object.keys(MENU)[0]);
  const [customer, setCustomer] = useState("");
  const [orderType, setOrderType] = useState("Local");
  const [payType, setPayType] = useState("Efectivo");
  const [lastOrder, setLastOrder] = useState(null);

  const {
    cart, orders, cartTotal,
    addToCart, updateQty, removeLine, toggleMod,
    generateTicket, advanceStatus,
  } = useOrders();

  function handleGenerate() {
    const order = generateTicket({ customer, orderType, payType });
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
