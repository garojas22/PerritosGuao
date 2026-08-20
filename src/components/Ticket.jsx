import { useBcvRate } from '../hooks/useBcvRate';

export default function Ticket({ order, onNewOrder }) {
  const bcvRate = useBcvRate();
  const totalBs = bcvRate !== null && bcvRate !== undefined ? order.total * bcvRate : null;

  if (!order) {
    return (
      <div className="ticket-wrap">
        <div className="ticket-placeholder">
          Genera un pedido desde "Tomar pedido" para ver aquí el comprobante.
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-wrap">
      <div className="ticket" id="printArea">
        <div className="tcenter">
          <h3>PUNTO PEDIDO</h3>
          <div className="sub">Comanda de cocina · #{order.num}</div>
        </div>
        <hr />
        <div className="meta">
          <div><span>Cliente</span><b>{order.customer}</b></div>
          <div><span>Hora</span><b>{order.time}</b></div>
        </div>
        <div className="badge-row">
          <span className="badge">{order.type}</span>
          <span className="badge">{order.pay}</span>
        </div>
        <hr />
        {order.items.map(l => (
          <div className="litem" key={l.uid}>
            <div className="lhead">
              <span>{l.qty}x {l.name}</span>
              <span>${(l.price * l.qty).toFixed(2)}</span>
            </div>
            {l.mods.length > 0 && (
              <div className="lmods">
                {l.mods.map((m, i) => (
                  <span key={m}>» {m}{i < l.mods.length - 1 && <br />}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        <hr />
        <div className="ttotal"><span>TOTAL USD</span><span>${order.total.toFixed(2)}</span></div>
        {totalBs !== null && (
          <div className="ttotal ttotal-bs"><span>TOTAL BS</span><span>Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        )}
        <div className="tcenter" style={{ marginTop: 14, fontSize: 10, color: "var(--ink-soft)" }}>
          ¡Gracias por su pedido!
        </div>
      </div>
      <div className="ticket-actions">
        <button className="btn-secondary" onClick={() => window.print()}>🖨️ Imprimir comprobante</button>
        <button className="btn-secondary" onClick={onNewOrder}>← Nuevo pedido</button>
      </div>
    </div>
  );
}
