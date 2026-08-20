import { useEffect, useState } from "react";
import { MENU } from "./data/menu.js";
import { useOrders } from "./hooks/useOrders.js";
import Header from "./components/Header.jsx";
import CategoryTabs from "./components/CategoryTabs.jsx";
import MenuGrid from "./components/MenuGrid.jsx";
import Cart from "./components/Cart.jsx";
import Ticket from "./components/Ticket.jsx";
import Board from "./components/Board.jsx";
import ProductModal from "./components/ProductModal.jsx";

const INGREDIENT_STOCK_KEY = "kitchen_ingredient_stock";
const MENU_STORAGE_KEY = "perritos_guao_menu";
const BASE_PRODUCT_IDS = new Set(Object.values(MENU).flat().map(item => item.id));

function normalizeIngredientKey(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeMenu(menu) {
  return Object.fromEntries(Object.entries(menu).map(([category, items]) => [
    category,
    items.map(item => ({
      ...item,
      price: Number(item.price) || 0,
      ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      desc: item.desc ?? "",
      isCustom: Boolean(item.isCustom) || !BASE_PRODUCT_IDS.has(item.id),
    })),
  ]));
}

function loadMenu() {
  try {
    const stored = localStorage.getItem(MENU_STORAGE_KEY);
    return stored ? normalizeMenu(JSON.parse(stored)) : normalizeMenu(MENU);
  } catch (error) {
    console.warn("No se pudo cargar el menú guardado:", error);
    return normalizeMenu(MENU);
  }
}

function buildIngredientAvailability(menu) {
  const availability = {};
  Object.values(menu).forEach(items => {
    items.forEach(item => {
      if (!Array.isArray(item.ingredients)) return;
      item.ingredients.forEach(ingredient => {
        availability[normalizeIngredientKey(ingredient)] = true;
      });
    });
  });
  return availability;
}

function loadIngredientAvailability(menu) {
  try {
    const stored = localStorage.getItem(INGREDIENT_STOCK_KEY);
    if (!stored) {
      return buildIngredientAvailability(menu);
    }

    const parsed = JSON.parse(stored);
    return { ...buildIngredientAvailability(menu), ...parsed };
  } catch (error) {
    console.warn("No se pudo cargar el stock de cocina:", error);
    return buildIngredientAvailability(menu);
  }
}

export default function App() {
  const [view, setView] = useState("order"); // "order" | "ticket" | "board"
  const [menu, setMenu] = useState(loadMenu);
  const [activeCat, setActiveCat] = useState(Object.keys(MENU)[0]);
  const [customer, setCustomer] = useState("");
  const [orderType, setOrderType] = useState("Local");
  const [payType, setPayType] = useState("Efectivo");
  const [lastOrder, setLastOrder] = useState(null);
  const [ingredientAvailability, setIngredientAvailability] = useState(() => loadIngredientAvailability(loadMenu()));
  const [productModal, setProductModal] = useState(null);

  const categories = Object.keys(menu);

  useEffect(() => {
    localStorage.setItem(INGREDIENT_STOCK_KEY, JSON.stringify(ingredientAvailability));
  }, [ingredientAvailability]);

  useEffect(() => {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menu));
    setIngredientAvailability(prev => ({ ...buildIngredientAvailability(menu), ...prev }));
    if (!menu[activeCat]) setActiveCat(categories[0]);
  }, [menu]);

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

  function saveProduct(product) {
    setMenu(prev => {
      const next = { ...prev };
      const item = {
        id: product.id || `product-${Date.now()}`,
        name: product.name,
        price: product.price,
        desc: product.desc,
        ingredients: product.ingredients,
        isCustom: true,
      };

      Object.keys(next).forEach(category => {
        next[category] = next[category].filter(existing => existing.id !== product.id);
      });
      next[product.category] = [...(next[product.category] || []), item];
      return next;
    });
    setActiveCat(product.category);
    setProductModal(null);
  }

  function deleteProduct(product) {
    if (!window.confirm(`¿Eliminar "${product.name}" del menú?`)) return;
    setMenu(prev => ({
      ...prev,
      [activeCat]: prev[activeCat].filter(item => item.id !== product.id),
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
              <CategoryTabs categories={categories} activeCat={activeCat} setActiveCat={setActiveCat} />
              <MenuGrid
                items={menu[activeCat] || []}
                onAdd={addToCart}
                onAddProduct={() => setProductModal({ product: null, category: activeCat })}
                onEditProduct={product => setProductModal({ product, category: activeCat })}
                onDeleteProduct={deleteProduct}
              />
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

      {productModal && (
        <ProductModal
          categories={categories}
          activeCategory={productModal.category}
          product={productModal.product}
          onClose={() => setProductModal(null)}
          onSave={saveProduct}
        />
      )}
    </>
  );
}
