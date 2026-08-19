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
  return (
    <aside className="cart">
      <h2>Pedido actual</h2>

      <div className="field">
        <label>Cliente</label>
        <input
          type="text"
          value={customer}
          onChange={e => setCustomer(e.target.value)}
          placeholder="Nombre del cliente"
        />
      </div>

      <div className="field">
        <label>Tipo de pedido</label>
        <div className="segmented">
          {["Local", "Para llevar", "Delivery"].map(opt => (
            <button key={opt} className={orderType === opt ? "active" : ""} onClick={() => setOrderType(opt)}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Forma de pago</label>
        <div className="segmented">
          {["Efectivo", "Pago móvil"].map(opt => (
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
        <span className="label">Total</span>
        <span className="amount">${cartTotal.toFixed(2)}</span>
      </div>

      <button className="btn-primary" disabled={cart.length === 0} onClick={onGenerate}>
        Generar comprobante →
      </button>
    </aside>
  );
}
