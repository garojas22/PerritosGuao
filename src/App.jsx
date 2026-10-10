import { useEffect, useState } from "react";
import { MENU, MENU_VERSION } from "./data/menu.js";
import { useOrders } from "./hooks/useOrders.js";
import { useSales } from "./hooks/useSales.js";
import { useRole } from "./hooks/useRole.js";
import Header from "./components/Header.jsx";
import CategoryTabs from "./components/CategoryTabs.jsx";
import MenuGrid from "./components/MenuGrid.jsx";
import Cart from "./components/Cart.jsx";
import Ticket from "./components/Ticket.jsx";
import Board from "./components/Board.jsx";
import CashClose from "./components/CashClose.jsx";
import ProductModal from "./components/ProductModal.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import AdminLoginDialog from "./components/AdminLoginDialog.jsx";
import ProductOptionsModal from "./components/ProductOptionsModal.jsx";
import { needsPayRef, isValidPayRef } from "./utils/payment.js";
import { needsOptions } from "./utils/lineOptions.js";

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

/**
 * Un ingrediente tiene que ser un nombre, no un número.
 * Escribir "4" o "55" en el campo de ingredientes creaba una entrada basura
 * que después aparecía en el panel de cocina como si fuera un insumo real.
 * Se exige al menos una letra, se quitan espacios sobrantes y se descartan
 * duplicados (comparando por la clave normalizada, para que "Maíz" y "maiz"
 * no entren dos veces).
 */
function sanitizeIngredients(list) {
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  return list.reduce((valid, raw) => {
    const name = String(raw).trim();
    if (!name) return valid;
    if (!/[a-záéíóúüñ]/i.test(name)) return valid; // sin letras => no es un ingrediente

    const key = normalizeIngredientKey(name);
    if (!key || seen.has(key)) return valid;

    seen.add(key);
    valid.push(name);
    return valid;
  }, []);
}

function normalizeMenu(menu) {
  return Object.fromEntries(Object.entries(menu).map(([category, items]) => [
    category,
    items.map(item => ({
      ...item,
      price: Number(item.price) || 0,
      ...(Array.isArray(item.variants)
        ? { variants: item.variants.map(variant => ({ ...variant, price: Number(variant.price) || 0 })) }
        : {}),
      // Se sanea también al cargar: así los ingredientes basura que ya
      // quedaron guardados en localStorage se limpian solos.
      ingredients: sanitizeIngredients(item.ingredients),
      desc: item.desc ?? "",
      isCustom: Boolean(item.isCustom) || !BASE_PRODUCT_IDS.has(item.id),
    })),
  ]));
}

/**
 * Cuando sube MENU_VERSION se recarga el menú del código, pero los productos
 * que el administrador creó desde la app (isCustom) se conservan: si no, cada
 * actualización del menú borraría lo que el dueño agregó a mano.
 * Se lee la marca tal como se guardó, sin recalcularla: un producto del menú
 * viejo que ya no existe en el nuevo no debe pasar por "propio".
 */
function keepCustomProducts(baseMenu, storedMenu) {
  const merged = Object.fromEntries(Object.entries(baseMenu).map(([category, items]) => [category, [...items]]));
  if (!storedMenu || typeof storedMenu !== "object") return merged;

  Object.entries(storedMenu).forEach(([category, items]) => {
    if (!Array.isArray(items)) return;
    items
      .filter(item => item?.isCustom === true)
      .forEach(item => {
        merged[category] = [...(merged[category] ?? []), item];
      });
  });
  return merged;
}

function loadMenu() {
  try {
    const stored = localStorage.getItem(MENU_STORAGE_KEY);
    if (!stored) return normalizeMenu(MENU);

    const parsed = JSON.parse(stored);
    // Formato viejo: el objeto de categorías se guardaba pelado, sin
    // envoltorio { version, menu }. Se trata como version 0.
    const version = typeof parsed?.version === "number" ? parsed.version : 0;
    if (version < MENU_VERSION) {
      return normalizeMenu(keepCustomProducts(MENU, version === 0 ? parsed : parsed?.menu));
    }

    return normalizeMenu(parsed.menu);
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

/**
 * El menú vigente es la ÚNICA fuente de verdad sobre QUÉ ingredientes existen.
 * Lo guardado (localStorage o estado previo) solo aporta el VALOR de cada uno
 * (disponible / agotado), nunca claves nuevas.
 *
 * Esto evita el bug de ingredientes huérfanos: antes el merge era
 * `{ ...buildIngredientAvailability(menu), ...guardado }`, y como lo guardado
 * iba último, sobrescribía y conservaba para siempre claves de productos que
 * ya habían sido eliminados. Nada podía borrarlas nunca.
 */
function syncIngredientAvailability(saved, menu) {
  const fromMenu = buildIngredientAvailability(menu);
  return Object.fromEntries(
    Object.keys(fromMenu).map(key => [key, saved?.[key] ?? true])
  );
}

function loadIngredientAvailability(menu) {
  try {
    const stored = localStorage.getItem(INGREDIENT_STOCK_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return syncIngredientAvailability(parsed, menu);
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
  const [payRef, setPayRef] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [ingredientAvailability, setIngredientAvailability] = useState(() => loadIngredientAvailability(menu));
  const [productModal, setProductModal] = useState(null);
  const [optionsProduct, setOptionsProduct] = useState(null); // producto con tamaños/elecciones por configurar
  const [productToDelete, setProductToDelete] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [dayToClear, setDayToClear] = useState(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [editingNum, setEditingNum] = useState(null); // número del pedido que se está corrigiendo
  const [pendingEdit, setPendingEdit] = useState(null); // pedido a corregir, a la espera de confirmar

  const categories = Object.keys(menu);

  useEffect(() => {
    localStorage.setItem(INGREDIENT_STOCK_KEY, JSON.stringify(ingredientAvailability));
  }, [ingredientAvailability]);

  useEffect(() => {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify({ version: MENU_VERSION, menu }));
    // Al cambiar el menú, el stock se resincroniza: entran los ingredientes
    // nuevos y salen los que ya no usa ningún producto, conservando el estado
    // (disponible / agotado) de los que siguen vigentes.
    setIngredientAvailability(prev => syncIngredientAvailability(prev, menu));
    if (!menu[activeCat]) setActiveCat(categories[0]);
  }, [menu]);

  // Rol actual: trabajador (por defecto) o administrador (con PIN). Ver useRole.js.
  const { isAdmin, hasPin, tryUnlock, setupPin, lock } = useRole();

  // Al salir del modo admin (manual o por inactividad) se cierra todo lo que
  // fuera exclusivo de admin, para que no quede nada abierto a la vista.
  useEffect(() => {
    if (isAdmin) return;
    setProductModal(null);
    setProductToDelete(null);
    setOrderToDelete(null);
    setDayToClear(null);
    setView(current => (current === "cash" ? "order" : current));
  }, [isAdmin]);

  function handleAdminClick() {
    if (isAdmin) {
      lock();
    } else {
      setShowAdminDialog(true);
    }
  }

  const {
    cart, orders, cartTotal,
    addToCart, updateQty, removeLine, toggleMod, loadCartFromOrder, clearCart,
    generateTicket, advanceStatus, removeOrder,
  } = useOrders();

  const {
    salesByDay, today, availableDays,
    recordSale, removeSale, clearDay,
  } = useSales();

  /**
   * Cobrar un pedido: queda asentado en el registro de ventas (persistido)
   * y sale del tablero de pedidos activos. Es el único camino por el que
   * un pedido entra al cierre de caja.
   */
  function handleChargeOrder(order) {
    recordSale(order);
    removeOrder(order.num);
  }

  // Pedido que se está corrigiendo. Se deriva de `orders` en vez de guardarlo
  // aparte: si el pedido desaparece o pasa a "Listo" mientras se corrige,
  // el aviso se apaga solo y lo que quedó en el carrito se trata como pedido nuevo.
  const editingOrder = editingNum
    ? orders.find(o => o.num === editingNum && o.status !== "Listo") ?? null
    : null;

  /** Vuelve a cargar un pedido activo en la pantalla de pedido para corregirlo. */
  function applyEdit(order) {
    loadCartFromOrder(order);
    setCustomer(order.customer);
    setOrderType(order.type);
    setPayType(order.pay);
    setPayRef(order.payRef || "");
    setEditingNum(order.num);
    setPendingEdit(null);
    setView("order");
  }

  function startEditOrder(order) {
    if (!order || order.status === "Listo") return;
    // Si ya hay otro pedido a medio armar, se pide confirmación antes de reemplazarlo.
    if (cart.length > 0 && editingNum !== order.num) {
      setPendingEdit(order);
      return;
    }
    applyEdit(order);
  }

  /** Cancela la corrección: el pedido original sigue intacto en el tablero. */
  function cancelEdit() {
    clearCart();
    setEditingNum(null);
    setCustomer("");
    setOrderType("Local");
    setPayType("Efectivo");
    setPayRef("");
  }

  /** Tocar un producto: si hay que elegir tamaño o pan se abre la ventana; si no, entra directo. */
  function handleAddProduct(item) {
    if (needsOptions(item)) {
      setOptionsProduct(item);
    } else {
      addToCart(item);
    }
  }

  function confirmOptions(selection) {
    if (!optionsProduct) return;
    addToCart(optionsProduct, selection);
    setOptionsProduct(null);
  }

  function toggleIngredientAvailability(ingredient) {
    const ingredientKey = normalizeIngredientKey(ingredient);
    setIngredientAvailability(prev => ({
      ...prev,
      [ingredientKey]: !(prev[ingredientKey] ?? true),
    }));
  }

  function saveProduct(product) {
    if (!isAdmin) return;
    setMenu(prev => {
      const next = { ...prev };
      const id = product.id || `product-${Date.now()}`;
      // Se parte del producto existente para no perder sus tamaños y elecciones
      // (pan, carne) al guardar: el formulario solo edita nombre, precios y textos.
      const existing = Object.values(prev).flat().find(candidate => candidate.id === product.id);
      const item = {
        ...(existing ?? {}),
        id,
        name: product.name,
        price: product.price,
        desc: product.desc,
        ingredients: sanitizeIngredients(product.ingredients),
        isCustom: !BASE_PRODUCT_IDS.has(id),
        ...(product.variants ? { variants: product.variants } : {}),
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

  function confirmDeleteProduct() {
    if (!isAdmin || !productToDelete) return;

    const { id } = productToDelete;
    // Se elimina por id en todas las categorías en lugar de asumir que el
    // producto está en `activeCat`: si la categoría activa cambia entre el
    // clic y la confirmación, el borrado fallaba en silencio.
    setMenu(prev => Object.fromEntries(
      Object.entries(prev).map(([category, items]) => [
        category,
        items.filter(item => item.id !== id),
      ])
    ));
    setProductToDelete(null);
  }

  function confirmDeleteOrder() {
    if (!isAdmin || !orderToDelete) return;
    removeOrder(orderToDelete.num);
    setOrderToDelete(null);
  }

  function handleGenerate() {
    const trimmedCustomer = customer.trim();
    if (!trimmedCustomer) {
      return;
    }

    // Con pago móvil o tarjeta la referencia es obligatoria. Cart ya avisa al
    // cajero; esta guarda evita que un pedido sin referencia entre por otro camino.
    const refRequired = needsPayRef(payType);
    if (refRequired && !isValidPayRef(payRef)) {
      return;
    }

    const order = generateTicket({
      customer: trimmedCustomer,
      orderType,
      payType,
      // Si el pago no lleva referencia (efectivo) se descarta cualquiera que
      // haya quedado escrita antes de cambiar de método.
      payRef: refRequired ? payRef : "",
      ingredientAvailability,
      replaceNum: editingOrder ? editingOrder.num : null,
    });
    if (!order) {
      return;
    }

    setLastOrder(order);
    setEditingNum(null);
    setCustomer("");
    setPayRef("");
    setView("ticket");
  }

  const pendingCount = orders.filter(o => o.status !== "Listo").length;

  // El botón "Corregir" del comprobante solo se ofrece si ese pedido sigue activo y no está listo.
  const lastOrderLive = lastOrder
    ? orders.find(o => o.num === lastOrder.num && o.status !== "Listo") ?? null
    : null;

  return (
    <>
      <Header
        view={view === "ticket" ? "order" : view}
        setView={setView}
        pendingCount={pendingCount}
        isAdmin={isAdmin}
        onAdminClick={handleAdminClick}
      />

      <main>
        {view === "order" && (
          <div className="order-layout">
            <div>
              <CategoryTabs categories={categories} activeCat={activeCat} setActiveCat={setActiveCat} />
              <MenuGrid
                items={menu[activeCat] || []}
                isAdmin={isAdmin}
                onAdd={handleAddProduct}
                onAddProduct={() => setProductModal({ product: null, category: activeCat })}
                onEditProduct={product => setProductModal({ product, category: activeCat })}
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
              payRef={payRef} setPayRef={setPayRef}
              ingredientAvailability={ingredientAvailability}
              toggleIngredientAvailability={toggleIngredientAvailability}
              onGenerate={handleGenerate}
              editingOrder={editingOrder}
              onCancelEdit={cancelEdit}
            />
          </div>
        )}

        {view === "ticket" && (
          <Ticket
            order={lastOrder}
            onNewOrder={() => setView("order")}
            onEdit={lastOrderLive ? () => startEditOrder(lastOrderLive) : undefined}
          />
        )}

        {view === "board" && (
          <Board
            orders={orders}
            onAdvance={advanceStatus}
            onDelete={order => setOrderToDelete(order)}
            onCharge={handleChargeOrder}
            onEdit={startEditOrder}
            canDelete={isAdmin}
          />
        )}

        {view === "cash" && isAdmin && (
          <CashClose
            salesByDay={salesByDay}
            availableDays={availableDays}
            today={today}
            onRemoveSale={removeSale}
            onClearDay={dateKey => setDayToClear(dateKey)}
          />
        )}
      </main>

      {showAdminDialog && (
        <AdminLoginDialog
          hasPin={hasPin}
          onUnlock={tryUnlock}
          onSetup={setupPin}
          onClose={() => setShowAdminDialog(false)}
        />
      )}

      {optionsProduct && (
        <ProductOptionsModal
          product={optionsProduct}
          onConfirm={confirmOptions}
          onClose={() => setOptionsProduct(null)}
        />
      )}

      {productModal && isAdmin && (
        <ProductModal
          categories={categories}
          activeCategory={productModal.category}
          product={productModal.product}
          onClose={() => setProductModal(null)}
          onSave={saveProduct}
          onDeleteProduct={product => setProductToDelete(product)}
        />
      )}

      {pendingEdit && (
        <ConfirmDialog
          title={`¿Corregir el pedido #${pendingEdit.num}?`}
          message="Tienes un pedido a medio armar en pantalla. Si continúas, se reemplazará por el pedido que vas a corregir."
          confirmLabel="Continuar"
          onConfirm={() => applyEdit(pendingEdit)}
          onCancel={() => setPendingEdit(null)}
        />
      )}

      {productToDelete && (
        <ConfirmDialog
          title={`¿Eliminar "${productToDelete.name}"?`}
          message="El producto se quitará del menú. Esta acción no se puede deshacer."
          confirmLabel="Eliminar producto"
          onConfirm={confirmDeleteProduct}
          onCancel={() => setProductToDelete(null)}
        />
      )}

      {dayToClear && (
        <ConfirmDialog
          title="¿Borrar el registro de este día?"
          message="Se eliminarán todas las ventas cobradas de ese día. Exporta el Excel antes si necesitas conservarlas. Esta acción no se puede deshacer."
          confirmLabel="Borrar registro"
          onConfirm={() => { clearDay(dayToClear); setDayToClear(null); }}
          onCancel={() => setDayToClear(null)}
        />
      )}

      {orderToDelete && (
        <ConfirmDialog
          title={`¿Eliminar pedido #${orderToDelete.num}?`}
          message={`El pedido de ${orderToDelete.customer} se eliminará de "Pedidos activos". Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar pedido"
          onConfirm={confirmDeleteOrder}
          onCancel={() => setOrderToDelete(null)}
        />
      )}
    </>
  );
}