import { useRef, useState } from 'react';
import { useBcvRate } from '../hooks/useBcvRate';
import {
  PAY_MOBILE, PAY_CARD, PAY_METHODS, MAX_SPLIT_PARTS, PAY_REF_LENGTH,
  needsPayRef, sanitizePayRef, isValidPayRef,
  createPayPart, parseAmount, roundMoney, getSplitRemaining, validateSplit,
} from '../utils/payment';
import { describeLine } from '../utils/lineOptions';

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
  "salsa bk": "salsa BK",
  "salsa x": "salsa X",
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
      {describeLine(line) && <div className="line-detail">{describeLine(line)}</div>}
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
  splitPay, setSplitPay, payParts, setPayParts,
  ingredientAvailability, toggleIngredientAvailability,
  onGenerate, editingOrder = null, onCancelEdit,
}) {
  const inputRef = useRef(null);
  const payRefInputRef = useRef(null);
  const [showCustomerError, setShowCustomerError] = useState(false);
  const [showPayRefError, setShowPayRefError] = useState(false);
  const [showEmptyCartError, setShowEmptyCartError] = useState(false);
  const [showSplitError, setShowSplitError] = useState(false);
  const [showKitchenSettings, setShowKitchenSettings] = useState(false);
  const bcvRate = useBcvRate();
  const totalBs = bcvRate !== null && bcvRate !== undefined ? cartTotal * bcvRate : null;
  const isCustomerValid = customer.trim().length > 0;
  const refRequired = needsPayRef(payType);
  const isPayRefValid = isValidPayRef(payRef);

  // Pago dividido: lo que falta (+) o sobra (−) para igualar el total del pedido.
  const splitRemaining = getSplitRemaining(payParts, cartTotal);
  const splitError = splitPay ? validateSplit(payParts, cartTotal) : null;

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

    if (splitPay) {
      if (splitError) {
        setShowSplitError(true);
        return;
      }
    } else if (refRequired && !isPayRefValid) {
      setShowPayRefError(true);
      payRefInputRef.current?.focus();
      return;
    }

    setShowSplitError(false);
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

  /* ---------- Pago dividido ---------- */

  function nextFreeMethod(parts) {
    return PAY_METHODS.find(method => !parts.some(part => part.method === method)) ?? PAY_METHODS[0];
  }

  function toggleSplit() {
    setShowSplitError(false);
    if (splitPay) {
      // Se vuelve a un solo método: se conserva el primero que se había elegido.
      const first = payParts[0];
      if (first) {
        setPayType(first.method);
        setPayRef(first.ref);
      }
      setSplitPay(false);
      return;
    }

    const firstPart = createPayPart(payType, '', payRef);
    const secondPart = createPayPart(nextFreeMethod([firstPart]));
    setPayParts([firstPart, secondPart]);
    setSplitPay(true);
  }

  function updatePart(id, patch) {
    setPayParts(parts => parts.map(part => (part.id === id ? { ...part, ...patch } : part)));
  }

  function handlePartAmountChange(id, value) {
    // Solo números con un decimal (coma o punto).
    const clean = value.replace(/[^0-9.,]/g, '');
    setPayParts(parts => {
      const next = parts.map(part => (part.id === id ? { ...part, amount: clean } : part));
      // Con dos métodos, al escribir el primero el segundo se completa solo con el resto.
      if (next.length === 2 && next[0].id === id) {
        const rest = roundMoney(cartTotal - parseAmount(clean));
        next[1] = { ...next[1], amount: parseAmount(clean) > 0 && rest > 0 ? rest.toFixed(2) : '' };
      }
      return next;
    });
  }

  function handlePartRefChange(id, value) {
    updatePart(id, { ref: sanitizePayRef(value) });
  }

  function fillRemainder(id) {
    setPayParts(parts => parts.map(part => {
      if (part.id !== id) return part;
      const rest = roundMoney(cartTotal - parts.reduce((sum, other) => (
        other.id === id ? sum : sum + parseAmount(other.amount)
      ), 0));
      return { ...part, amount: rest > 0 ? rest.toFixed(2) : '' };
    }));
  }

  function addPart() {
    if (payParts.length >= MAX_SPLIT_PARTS) return;
    const rest = getSplitRemaining(payParts, cartTotal);
    setPayParts([...payParts, createPayPart(nextFreeMethod(payParts), rest > 0 ? rest.toFixed(2) : '')]);
  }

  function removePart(id) {
    if (payParts.length <= 2) return;
    setPayParts(payParts.filter(part => part.id !== id));
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

      {editingOrder && (
        <div className="edit-banner">
          <span>Corrigiendo el pedido <strong>#{editingOrder.num}</strong></span>
          <button type="button" onClick={onCancelEdit}>Cancelar corrección</button>
        </div>
      )}

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
        {!splitPay && (
          <div className="segmented">
            {PAY_METHODS.map(opt => (
              <button key={opt} className={payType === opt ? "active" : ""} onClick={() => setPayType(opt)}>
                {opt}
              </button>
            ))}
          </div>
        )}

        <button type="button" className="split-toggle" onClick={toggleSplit}>
          {splitPay ? '← Pagar con un solo método' : '+ Dividir el pago en varios métodos'}
        </button>
      </div>

      {splitPay && (
        <div className="split-pay">
          {payParts.map((part, index) => {
            const partRefRequired = needsPayRef(part.method);
            const partBs = bcvRate && part.method === PAY_MOBILE ? parseAmount(part.amount) * bcvRate : null;
            const refInvalid = showSplitError && partRefRequired && !isValidPayRef(part.ref);
            const amountInvalid = showSplitError && parseAmount(part.amount) <= 0;

            return (
              <div className="split-row" key={part.id}>
                <div className="split-row-main">
                  <select
                    className="split-method"
                    value={part.method}
                    onChange={e => updatePart(part.id, { method: e.target.value, ref: '' })}
                    aria-label={`Método de pago ${index + 1}`}
                  >
                    {PAY_METHODS.map(method => (
                      <option
                        key={method}
                        value={method}
                        disabled={method !== part.method && payParts.some(other => other.method === method)}
                      >
                        {method}
                      </option>
                    ))}
                  </select>

                  <div className={`split-amount ${amountInvalid ? 'invalid' : ''}`}>
                    <span aria-hidden="true">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={part.amount}
                      onChange={e => handlePartAmountChange(part.id, e.target.value)}
                      placeholder="0.00"
                      aria-label={`Monto en dólares del método ${index + 1}`}
                    />
                  </div>

                  {payParts.length > 2 && (
                    <button
                      type="button"
                      className="split-remove"
                      onClick={() => removePart(part.id)}
                      aria-label={`Quitar ${part.method}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {partRefRequired && (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={PAY_REF_LENGTH}
                    className={`split-ref ${refInvalid ? 'invalid' : ''}`}
                    value={part.ref}
                    onChange={e => handlePartRefChange(part.id, e.target.value)}
                    placeholder={`Referencia (últimos ${PAY_REF_LENGTH} dígitos)`}
                    aria-label={`Referencia de ${part.method}`}
                  />
                )}

                <div className="split-row-foot">
                  {partBs !== null && partBs > 0 && (
                    <span className="split-bs">
                      ≈ Bs. {partBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                  {splitRemaining > 0 && (
                    <button type="button" className="split-fill" onClick={() => fillRemainder(part.id)}>
                      Poner lo que falta
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {payParts.length < MAX_SPLIT_PARTS && (
            <button type="button" className="split-add" onClick={addPart}>+ Agregar otro método</button>
          )}

          <div className={`split-status ${splitRemaining === 0 && cartTotal > 0 ? 'ok' : splitRemaining < 0 ? 'over' : ''}`}>
            {cartTotal === 0 && 'Agrega productos para repartir el pago.'}
            {cartTotal > 0 && splitRemaining === 0 && '✓ El pago cubre el total'}
            {cartTotal > 0 && splitRemaining > 0 && `Faltan $${splitRemaining.toFixed(2)}`}
            {cartTotal > 0 && splitRemaining < 0 && `Se pasa por $${Math.abs(splitRemaining).toFixed(2)}`}
          </div>

          {showSplitError && splitError && <div className="field-error">{splitError}</div>}
        </div>
      )}

      {!splitPay && refRequired && (
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
        {editingOrder ? 'Actualizar comprobante →' : 'Generar comprobante →'}
      </button>
    </aside>
  );
}