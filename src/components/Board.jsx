import { useState } from "react";
import { describeLine, partTitle } from "../utils/lineOptions.js";
import { formatUsd } from "../utils/salesReport.js";
import { isCreditSale } from "../utils/payment.js";

const COLUMNS = [
  { status: "Pendiente", label: "Pendiente", colClass: "col-pend" },
  { status: "Preparando", label: "En preparación", colClass: "col-prep" },
  { status: "Listo", label: "Listo", colClass: "col-listo" },
];

function OrderCard({ order, onClick, onDelete, onCharge, onEdit, canDelete }) {
  const totalBs = typeof order.totalBs === 'number' ? order.totalBs : null;
  const isReady = order.status === "Listo";

  return (
    <div className="order-card" onClick={() => onClick(order.num)}>
      <div className="oc-top">
        <div className="oc-top-info">
          <span>#{order.num}</span>
          <span>{order.time}</span>
        </div>
        {/* Eliminar un pedido activo borra su rastro, por eso es solo del administrador. */}
        {canDelete && (
          <button
            type="button"
            className="order-delete"
            onClick={event => { event.stopPropagation(); onDelete(order); }}
            aria-label={`Eliminar pedido #${order.num}`}
          >
            ✕
          </button>
        )}
      </div>
      <div className="oc-name">{order.customer}</div>
      <div className="oc-items">{order.items.map((l, index) => {
        const separator = index > 0 ? <span className="oc-item-separator">, </span> : null;
        if (l.isCombo) {
          return (
            <div className="oc-item-combo" key={l.uid ?? `${l.name}-${index}`}>
              {separator}
              <span>{l.qty}x {l.name} · ${ (l.price * l.qty).toFixed(2)}</span>
              {l.parts.map((part, partIndex) => {
                const detail = [describeLine(part), ...(part.mods || [])].filter(Boolean).join(", ");
                return (
                  <span className="oc-item-part" key={part.id || `${part.name}-${partIndex}`}>
                    ↳ {l.qty}x {partTitle(part)}{detail ? ` (${detail})` : ""}
                  </span>
                );
              })}
            </div>
          );
        }
        const detail = describeLine(l);
        return <span key={l.uid ?? `${l.name}-${index}`}>{separator}{l.qty}x {l.name}{detail ? ` (${detail})` : ""}</span>;
      })}</div>
      {order.revision > 0 && <div className="oc-corrected">Corregido</div>}
      <div className="oc-foot">
        <span>{order.type} · {order.pay}{order.payRef ? ` · Ref. ${order.payRef}` : ''}</span>
        <div className="oc-total">
          <span>${order.total.toFixed(2)}</span>
          {totalBs !== null && (
            <span className="oc-total-bs">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
        </div>
      </div>

      {/* Un pedido listo ya se cocinó: solo se puede cobrar, no corregir. */}
      {!isReady && (
        <button
          type="button"
          className="oc-edit"
          onClick={event => { event.stopPropagation(); onEdit(order); }}
        >
          ✎ Corregir
        </button>
      )}

      {isReady && (
        <button
          type="button"
          className="oc-charge"
          onClick={event => { event.stopPropagation(); onCharge(order); }}
        >
          💵 Cobrar y cerrar
        </button>
      )}
    </div>
  );
}

/**
 * Cobros del día con opción de anular, para el trabajador.
 *
 * El trabajador no ve el cierre de caja, así que hasta ahora un cobro
 * equivocado solo lo podía deshacer el dueño: había que llamarlo por
 * teléfono en plena hora pico.
 *
 * Anular NO borra: la venta queda en el registro, tachada, con el motivo y
 * la hora. Eso es lo que permite que el dueño vea al cierre que hubo tres
 * anulaciones de $8 del mismo turno. El motivo es obligatorio justamente
 * porque sin él la anulación no dice nada.
 */
function RecentCharges({ sales, onVoid }) {
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState("");

  if (!Array.isArray(sales) || sales.length === 0) return null;

  // Los últimos primero: un cobro que hay que deshacer casi siempre es reciente.
  const recent = [...sales].sort((a, b) => Number(b.num) - Number(a.num)).slice(0, 8);

  function confirm(sale) {
    if (reason.trim().length < 3) return;
    onVoid(sale.dateKey, sale.saleId, reason.trim());
    setVoiding(null);
    setReason("");
  }

  return (
    <section className="charges">
      <h3>Cobros de hoy</h3>
      <p className="charges-hint">
        Si cobraste un pedido por error o el cliente se arrepintió, anúlalo aquí.
        Queda registrado con el motivo y los insumos vuelven al inventario.
      </p>

      <ul className="charges-list">
        {recent.map(sale => (
          <li key={sale.saleId} className={`charge ${sale.voided ? "charge-voided" : ""}`}>
            <div className="charge-main">
              <span className="charge-num">#{sale.num}</span>
              <span className="charge-name">{sale.customer}</span>
              <span className="charge-total">{formatUsd(sale.total)}</span>
              <span className="charge-pay">
                {sale.pay}
                {isCreditSale(sale) && !sale.creditPaid && " · sin pagar"}
              </span>
            </div>

            {sale.voided ? (
              <span className="charge-void-note">Anulado · {sale.voided.reason}</span>
            ) : voiding === sale.saleId ? (
              <div className="charge-void-form">
                <input
                  autoFocus
                  value={reason}
                  onChange={event => setReason(event.target.value)}
                  placeholder="¿Por qué se anula? (obligatorio)"
                  maxLength={80}
                  onKeyDown={event => { if (event.key === "Enter") confirm(sale); }}
                />
                <button type="button" className="charge-confirm" disabled={reason.trim().length < 3} onClick={() => confirm(sale)}>
                  Anular
                </button>
                <button type="button" className="charge-cancel" onClick={() => { setVoiding(null); setReason(""); }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" className="charge-void-btn" onClick={() => { setVoiding(sale.saleId); setReason(""); }}>
                Anular cobro
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Board({ orders, onAdvance, onDelete, onCharge, onEdit, canDelete = false, todaySales = [], onVoidSale }) {
  return (
    <>
      <div className="hint-bar">
        💡 Al generar un comprobante, el pedido entra aquí en "Pendiente".
        Haz clic en una tarjeta para avanzar su estado. Al llegar a "Listo", cóbralo para que entre al cierre de caja.
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
                  items.map(o => <OrderCard key={o.num} order={o} onClick={onAdvance} onDelete={onDelete} onCharge={onCharge} onEdit={onEdit} canDelete={canDelete} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {onVoidSale && <RecentCharges sales={todaySales} onVoid={onVoidSale} />}
    </>
  );
}