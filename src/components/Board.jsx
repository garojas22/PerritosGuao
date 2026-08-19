const COLUMNS = [
  { status: "Pendiente", label: "Pendiente", colClass: "col-pend" },
  { status: "Preparando", label: "En preparación", colClass: "col-prep" },
  { status: "Listo", label: "Listo", colClass: "col-listo" },
];

function OrderCard({ order, onClick }) {
  return (
    <div className="order-card" onClick={() => onClick(order.num)}>
      <div className="oc-top"><span>#{order.num}</span><span>{order.time}</span></div>
      <div className="oc-name">{order.customer}</div>
      <div className="oc-items">{order.items.map(l => `${l.qty}x ${l.name}`).join(", ")}</div>
      <div className="oc-foot">
        <span>{order.type} · {order.pay}</span>
        <span>${order.total.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function Board({ orders, onAdvance }) {
  return (
    <>
      <div className="hint-bar">
        💡 Simulación: al generar un comprobante, el pedido entra aquí en "Pendiente".
        Haz clic en una tarjeta para avanzar su estado.
      </div>
      <div className="board">
        {COLUMNS.map(col => {
          const items = orders.filter(o => o.status === col.status);
          return (
            <div className={`col ${col.colClass}`} key={col.status}>
              <h3><span className="dot"></span>{col.label}</h3>
              <div className="col-body">
                {items.length === 0 ? (
                  <div className="board-empty">Sin pedidos</div>
                ) : (
                  items.map(o => <OrderCard key={o.num} order={o} onClick={onAdvance} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
