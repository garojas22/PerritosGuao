import { useRef, useState } from 'react';
import { useBcvRate } from '../hooks/useBcvRate';

function CartLine({ line, onQty, onRemove, onToggleMod }) {
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
          {line.availMods.map(m => (
            <span
              key={m}
              className={`chip ${line.mods.includes(m) ? "on" : ""}`}
              onClick={() => onToggleMod(line.uid, m)}
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Cart({
  cart, cartTotal, onQty, onRemove, onToggleMod,
  customer, setCustomer, orderType, setOrderType, payType, setPayType,
  onGenerate,
}) {
  const inputRef = useRef(null);
  const [showCustomerError, setShowCustomerError] = useState(false);
  const [showEmptyCartError, setShowEmptyCartError] = useState(false);
  const bcvRate = useBcvRate();
  const totalBs = bcvRate !== null && bcvRate !== undefined ? cartTotal * bcvRate : null;
  const isCustomerValid = customer.trim().length > 0;

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

    setShowCustomerError(false);
    setShowEmptyCartError(false);
    onGenerate();
  }

  function handleCustomerChange(value) {
    setCustomer(value);
    if (showCustomerError && value.trim().length > 0) {
      setShowCustomerError(false);
    }
  }

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
          {["Efectivo", "Pago móvil", "Tarjeta"].map(opt => (
            <button key={opt} className={payType === opt ? "active" : ""} onClick={() => setPayType(opt)}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="cart-items">
        {cart.length === 0 ? (
          <div className="cart-empty">Toca un producto del menú para agregarlo.</div>
        ) : (
          cart.map(line => (
            <CartLine key={line.uid} line={line} onQty={onQty} onRemove={onRemove} onToggleMod={onToggleMod} />
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
