import { useState } from 'react';
import {
  summarizeSales,
  downloadSalesCsv,
  formatDayLabel,
  formatUsd,
  formatBs,
  getBusinessDayKey,
} from '../utils/salesReport';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`cc-stat ${accent ? 'cc-stat-accent' : ''}`}>
      <span className="cc-stat-label">{label}</span>
      <strong className="cc-stat-value">{value}</strong>
      {sub && <span className="cc-stat-sub">{sub}</span>}
    </div>
  );
}

export default function CashClose({ salesByDay, availableDays, today, onRemoveSale, onClearDay }) {
  const [selectedDay, setSelectedDay] = useState(today);

  // Si el día seleccionado ya no tiene ventas (se borró), se cae a hoy.
  const dayKey = salesByDay[selectedDay] ? selectedDay : today;
  const sales = salesByDay[dayKey] || [];
  const summary = summarizeSales(sales);
  const isToday = dayKey === getBusinessDayKey();

  const dayOptions = availableDays.includes(today) ? availableDays : [today, ...availableDays];

  return (
    <div className="cash-close">
      <div className="cc-head">
        <div>
          <h2>Cierre de caja</h2>
          <p className="cc-day">{formatDayLabel(dayKey)}{isToday && <span className="cc-live">· en curso</span>}</p>
        </div>

        <div className="cc-head-actions">
          {dayOptions.length > 1 && (
            <select
              className="cc-select"
              value={dayKey}
              onChange={event => setSelectedDay(event.target.value)}
              aria-label="Seleccionar día"
            >
              {dayOptions.map(day => (
                <option key={day} value={day}>
                  {day === getBusinessDayKey() ? 'Hoy' : formatDayLabel(day)}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="cc-btn cc-btn-primary"
            onClick={() => downloadSalesCsv(sales, dayKey)}
            disabled={sales.length === 0}
          >
            ⬇ Exportar a Excel
          </button>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="cc-empty">
          Todavía no hay ventas cobradas en este día.
          <span>Los pedidos entran aquí cuando los cobras desde "Pedidos activos".</span>
        </div>
      ) : (
        <>
          <div className="cc-stats">
            <StatCard
              label="Total vendido"
              value={formatUsd(summary.totalUsd)}
              sub={summary.hasBsData ? formatBs(summary.totalBs) : null}
              accent
            />
            <StatCard label="Pedidos cobrados" value={summary.count} />
            <StatCard label="Ticket promedio" value={formatUsd(summary.averageTicket)} />
            <StatCard label="Unidades vendidas" value={summary.itemsSold} />
          </div>

          <div className="cc-grid">
            <section className="cc-panel">
              <h3>Por método de pago</h3>
              <p className="cc-panel-hint">Usa esto para cuadrar el efectivo en caja.</p>
              <table className="cc-mini-table">
                <thead>
                  <tr><th>Método</th><th>Pedidos</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {Object.entries(summary.byPayment).map(([method, data]) => (
                    <tr key={method}>
                      <td>{method}</td>
                      <td>{data.count}</td>
                      <td className="cc-num">
                        {formatUsd(data.totalUsd)}
                        {data.totalBs > 0 && <span className="cc-sub-bs">{formatBs(data.totalBs)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="cc-panel">
              <h3>Por tipo de pedido</h3>
              <p className="cc-panel-hint">Local vs. delivery del día.</p>
              <table className="cc-mini-table">
                <thead>
                  <tr><th>Tipo</th><th>Pedidos</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {Object.entries(summary.byType).map(([type, data]) => (
                    <tr key={type}>
                      <td>{type}</td>
                      <td>{data.count}</td>
                      <td className="cc-num">{formatUsd(data.totalUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="cc-panel">
              <h3>Productos más vendidos</h3>
              <p className="cc-panel-hint">Qué reponer y qué se mueve.</p>
              <table className="cc-mini-table">
                <thead>
                  <tr><th>Producto</th><th>Unid.</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {summary.products.slice(0, 8).map(product => (
                    <tr key={product.name}>
                      <td>{product.name}</td>
                      <td>{product.qty}</td>
                      <td className="cc-num">{formatUsd(product.totalUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="cc-panel cc-panel-wide">
            <h3>Detalle de pedidos</h3>
            <div className="cc-table-scroll">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cobro</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Pago</th>
                    <th>Productos</th>
                    <th className="cc-num">Total</th>
                    <th aria-label="Acciones"></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.saleId}>
                      <td className="cc-strong">#{sale.num}</td>
                      <td>{sale.closedTime}</td>
                      <td>{sale.customer}</td>
                      <td>{sale.type}</td>
                      <td>{sale.pay}</td>
                      <td className="cc-products">
                        {(sale.items || []).map(item => (
                          <span key={item.uid ?? item.name} className="cc-product-line">
                            {item.qty}x {item.name}
                            {Array.isArray(item.mods) && item.mods.length > 0 && (
                              <em> ({item.mods.join(', ')})</em>
                            )}
                          </span>
                        ))}
                      </td>
                      <td className="cc-num cc-strong">
                        {formatUsd(sale.total)}
                        {Number.isFinite(Number(sale.totalBs)) && (
                          <span className="cc-sub-bs">{formatBs(sale.totalBs)}</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cc-remove"
                          onClick={() => onRemoveSale(dayKey, sale.saleId)}
                          title="Anular este cobro"
                          aria-label={`Anular cobro del pedido ${sale.num}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>TOTAL DEL DÍA</td>
                    <td className="cc-num cc-strong">
                      {formatUsd(summary.totalUsd)}
                      {summary.hasBsData && <span className="cc-sub-bs">{formatBs(summary.totalBs)}</span>}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="cc-footer-actions">
            <button type="button" className="cc-btn cc-btn-danger" onClick={() => onClearDay(dayKey)}>
              Borrar registro de este día
            </button>
          </div>
        </>
      )}
    </div>
  );
}
