import { useRef, useState } from 'react';
import { useBcvRate } from '../hooks/useBcvRate';
import { PAY_MOBILE, PAY_REF_LENGTH, isMobilePay, sanitizePayRef, isValidPayRef } from '../utils/payment';

function normalizeIngredientKey(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getModIngredientKey(mod = "") {
  const withoutPrefix = mod
    .replace(/^sin\s+/i, "")
    .replace(/^extra\s+/i, "")
    .replace(/^sabor\s+/i, "");

  return normalizeIngredientKey(withoutPrefix);
}

const INGREDIENT_LABELS = {
  "queso de ano": "queso de año",
  "maiz": "maíz",
  "limon": "limón",
};

function getIngredientLabel(ingredient) {
  return INGREDIENT_LABELS[ingredient] ?? ingredient;
}

function CartLine({ line, onQty, onRemove, onToggleMod, ingredientAvailability }) {
  return (
    <div className="cart-line">
      <div className="top">
        <span className="name">{line.name}</span>
        <span className="price">${(line.price * line.qty).toFixed(2)}</span>
      </div>
      <div className="qty-ctrl">
        <button onClick={() => onQty(line.uid, -1)}>−</button>
        <span>{line.qty}</span>
        <button onClick={() => onQty(line.uid, 1)}>+</button>
        <span className="remove-x" onClick={() => onRemove(line.uid)}>Quitar</span>
      </div>
      {line.availMods.length > 0 && (
        <div className="chips">
          {line.availMods.map(mod => {
            const ingredientKey = getModIngredientKey(mod);
            const isAvailable = ingredientKey ? (ingredientAvailability[ingredientKey] ?? true) : true;
            const isSelected = line.mods.includes(mod);

            return (
              <button
                key={mod}
                type="button"
                className={`chip ${isSelected ? 'on' : ''} ${!isAvailable ? 'disabled' : ''}`}
                onClick={() => isAvailable && onToggleMod(line.uid, mod)}
                disabled={!isAvailable}
                title={!isAvailable ? 'Ingrediente agotado' : mod}
              >
                {!isAvailable ? `${mod} · Agotado` : mod}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Cart({
  cart, cartTotal, onQty, onRemove, onToggleMod,
  customer, setCustomer, orderType, setOrderType, payType, setPayType, payRef, setPayRef,
  ingredientAvailability, toggleIngredientAvailability,
  onGenerate,
}) {
  const inputRef = useRef(null);
  const payRefInputRef = useRef(null);
  const [showCustomerError, setShowCustomerError] = useState(false);
  const [showPayRefError, setShowPayRefError] = useState(false);
  const [showEmptyCartError, setShowEmptyCartError] = useState(false);
  const [showKitchenSettings, setShowKitchenSettings] = useState(false);
  const bcvRate = useBcvRate();
  const totalBs = bcvRate !== null && bcvRate !== undefined ? cartTotal * bcvRate : null;
  const isCustomerValid = customer.trim().length > 0;
  const needsPayRef = isMobilePay(payType);
  const isPayRefValid = isValidPayRef(payRef);

  function handleGenerateClick() {
    if (cart.length === 0) {
      setShowEmptyCartError(true);
      setShowCustomerError(false);
      return;
    }

    if (!isCustomerValid) {
      setShowEmptyCartError(false);
      setShowCustomerError(true);
      inputRef.current?.focus();
      return;
    }

    if (needsPayRef && !isPayRefValid) {
      setShowPayRefError(true);
      payRefInputRef.current?.focus();
      return;
    }

    setShowCustomerError(false);
    setShowPayRefError(false);
    setShowEmptyCartError(false);
    onGenerate();
  }

  function handlePayRefChange(value) {
    // Solo dígitos y máximo PAY_REF_LENGTH: no hace falta validar texto libre después.
    const clean = sanitizePayRef(value);
    setPayRef(clean);
    if (showPayRefError && isValidPayRef(clean)) {
      setShowPayRefError(false);
    }
  }

  function handleCustomerChange(value) {
    setCustomer(value);
    if (showCustomerError && value.trim().length > 0) {
      setShowCustomerError(false);
    }
  }

  const ingredientList = Object.entries(ingredientAvailability || {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <aside className="cart">
      <h2>Pedido actual</h2>

      <div className="field">
        <label>Cliente</label>
        <input
          ref={inputRef}
          type="text"
          value={customer}
          onChange={e => handleCustomerChange(e.target.value)}
          placeholder="Nombre del cliente"
          required
          aria-invalid={!isCustomerValid}
          className={showCustomerError && !isCustomerValid ? 'invalid' : ''}
        />
        {showCustomerError && !isCustomerValid && (
          <div className="field-error">Falta el nombre del cliente para continuar.</div>
        )}
      </div>

      <div className="field">
        <label>Tipo de pedido</label>
        <div className="segmented">
          {["Local", "Delivery"].map(opt => (
            <button key={opt} className={orderType === opt ? "active" : ""} onClick={() => setOrderType(opt)}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Forma de pago</label>
        <div className="segmented">
          {["Efectivo", PAY_MOBILE, "Tarjeta"].map(opt => (
            <button key={opt} className={payType === opt ? "active" : ""} onClick={() => setPayType(opt)}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      {needsPayRef && (
        <div className="field">
          <label>Referencia (últimos {PAY_REF_LENGTH} dígitos)</label>
          {/* type="text" a propósito: así toma exactamente el mismo estilo que
              el campo Cliente (.field input[type=text]). inputMode="numeric"
              abre el teclado numérico en celular y tablet. */}
          <input
            ref={payRefInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PAY_REF_LENGTH}
            value={payRef}
            onChange={e => handlePayRefChange(e.target.value)}
            placeholder="Ej. 1234"
            aria-invalid={showPayRefError && !isPayRefValid}
            className={showPayRefError && !isPayRefValid ? 'invalid' : ''}
          />
          {showPayRefError && !isPayRefValid && (
            <div className="field-error">Escribe los {PAY_REF_LENGTH} últimos dígitos de la referencia.</div>
          )}
        </div>
      )}

      <div className="kitchen-panel">
        <button type="button" className="kitchen-toggle" onClick={() => setShowKitchenSettings(open => !open)}>
          {showKitchenSettings ? 'Ocultar ajustes de cocina' : 'Ajustes de cocina'}
        </button>

        {showKitchenSettings && (
          <div className="ingredient-stock-grid">
            {ingredientList.map(([ingredient, available]) => (
              <button
                key={ingredient}
                type="button"
                className={`stock-toggle ${available ? 'on' : 'off'}`}
                onClick={() => toggleIngredientAvailability(ingredient)}
              >
                <span className="stock-dot" aria-hidden="true" />
                <span className="stock-name">{getIngredientLabel(ingredient)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cart-items">
        {cart.length === 0 ? (
          <div className="cart-empty">Toca un producto del menú para agregarlo.</div>
        ) : (
          cart.map(line => (
            <CartLine
              key={line.uid}
              line={line}
              onQty={onQty}
              onRemove={onRemove}
              onToggleMod={onToggleMod}
              ingredientAvailability={ingredientAvailability}
            />
          ))
        )}
      </div>

      <div className="total-row">
        <div className="total-summary">
          <div className="total-line">
            <span className="total-label">Total USD</span>
            <span className="amount">${cartTotal.toFixed(2)}</span>
          </div>

          {totalBs !== null && (
            <div className="total-line">
              <span className="total-label">Total Bs</span>
              <span className="amount-bs">
                Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {showEmptyCartError && (
        <div className="cart-warning">Agrega al menos un producto antes de generar el comprobante.</div>
      )}

      <button className="btn-primary" onClick={handleGenerateClick}>
        Generar comprobante →
      </button>
    </aside>
  );
}