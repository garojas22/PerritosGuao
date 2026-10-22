import React, { useEffect, useMemo, useState } from 'react';
import {
  summarizeSales,
  formatDayLabel,
  formatUsd,
  formatBs,
  getBusinessDayKey,
  hasAmount,
} from '../utils/salesReport';
import { downloadSalesExcel } from '../utils/salesExcel';
import { summarizeInventory } from '../utils/inventoryReport';
import { PAY_MOBILE, getOrderPayments, isSplitPayment, paymentBs } from '../utils/payment';
import { describeLine, partTitle } from '../utils/lineOptions';

// Clave localStorage para el estado abierto/cerrado de los subgrupos.
const COLLAPSED_KEY = 'perritos_inv_collapsed';

function loadCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY)) || []);
  } catch { return new Set(); }
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`cc-stat ${accent ? 'cc-stat-accent' : ''}`}>
      <span className="cc-stat-label">{label}</span>
      <strong className="cc-stat-value">{value}</strong>
      {sub && <span className="cc-stat-sub">{sub}</span>}
    </div>
  );
}

/**
 * Campo numérico del inventario. Guarda lo escrito mientras se teclea, para
 * poder escribir un "-" (ajuste negativo por merma) sin que el campo se borre.
 */
function StockInput({ value, onCommit, label, className = 'inv-input' }) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  function handleChange(event) {
    const text = event.target.value;
    if (!/^-?\d{0,6}$/.test(text)) return; // solo enteros, con "-" opcional
    setDraft(text);
    if (text === '') onCommit(null);
    else if (text !== '-') onCommit(Number(text));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={draft}
      onChange={handleChange}
      onBlur={() => setDraft(value ?? '')}
      placeholder="0"
      aria-label={label}
    />
  );
}

const INV_STATUS_LABEL = { out: 'Agotado', low: 'Poco' };

/** Fila de datos del inventario (insumo individual). */
function InvRow({ row, dayKey, onSetStock, onSetStart }) {
  return (
    <tr key={row.id} className={row.status ? `inv-row-${row.status}` : ''}>
      <td className="cc-strong">
        <span className="inv-item-name">
          {row.name}
          {row.manualOnly && <span className="inv-manual-tag">solo conteo manual</span>}
        </span>
        {row.note && <span className="inv-item-note">{row.note}</span>}
      </td>
      <td className="cc-num">
        <span className="inv-carry">
          <StockInput
            className={`inv-input inv-input-carry ${row.carryAdjusted ? 'inv-adjusted' : ''}`}
            value={row.carry}
            onCommit={value => value !== null && onSetStart(dayKey, row.id, value)}
            label={`Sobrante de ayer: ${row.name}`}
          />
          {row.carryAdjusted && (
            <button
              type="button"
              className="inv-reset"
              onClick={() => onSetStart(dayKey, row.id, null)}
              title="Volver al cálculo automático"
              aria-label={`Volver al cálculo automático: ${row.name}`}
            >
              ↺
            </button>
          )}
        </span>
      </td>
      <td className="cc-num">
        <StockInput
          value={row.entered}
          onCommit={value => onSetStock(dayKey, row.id, value)}
          label={`Ingresó: ${row.name}`}
        />
      </td>
      <td className="cc-num">{row.available !== null ? row.available : '—'}</td>
      <td className="cc-num">{row.sold}</td>
      <td className="cc-num">
        {row.remaining !== null ? (
          <span className={`inv-remaining ${row.status ? `inv-${row.status}` : ''}`}>
            {row.remaining}
            {row.status && <em>{INV_STATUS_LABEL[row.status]}</em>}
          </span>
        ) : '—'}
      </td>
    </tr>
  );
}

/** Fila de cabecera de un subgrupo (plegable). Muestra la suma de sus marcas. */
function SubgroupRow({ subgroup, summary, isOpen, onToggle }) {
  const { alerts } = summary;
  const hasAlerts = alerts.out > 0 || alerts.low > 0;

  return (
    <tr className="inv-subgroup" onClick={onToggle} role="button" aria-expanded={isOpen}>
      <td colSpan={6}>
        <span className="inv-subgroup-toggle">{isOpen ? '▾' : '▸'}</span>
        <span className="inv-subgroup-name">{subgroup}</span>
        {!isOpen && hasAlerts && (
          <span className="inv-subgroup-alerts">
            {alerts.out > 0 && (
              <span className="inv-alert-badge inv-alert-out">
                {alerts.out} agotad{alerts.out === 1 ? 'a' : 'as'}
              </span>
            )}
            {alerts.low > 0 && (
              <span className="inv-alert-badge inv-alert-low">
                {alerts.low} por acabarse
              </span>
            )}
          </span>
        )}
        {isOpen && (
          <span className="inv-subgroup-summary">
            {summary.available !== null && <span>Disp. {summary.available}</span>}
            <span>Vend. {summary.sold}</span>
            {summary.remaining !== null && (
              <span className={alerts.out > 0 ? 'inv-text-out' : alerts.low > 0 ? 'inv-text-low' : ''}>
                Quedan {summary.remaining}
              </span>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function CashClose({
  salesByDay, availableDays, today, stockByDay = {}, startByDay = {},
  onSetStock, onSetStart, onClearStock, onRemoveSale, onClearDay,
  isAdmin = false,
  inventoryItems,
  usedInventoryIds,
  onOpenNewItem,
}) {
  const [selectedDay, setSelectedDay] = useState(today);
  const [isExporting, setIsExporting] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  // Persistir estado plegado en localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch { /* localStorage lleno */ }
  }, [collapsed]);

  function toggleSubgroup(key) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Se puede abrir cualquier día con ventas o con inventario cargado.
  const dayOptions = [...new Set([
    today,
    ...availableDays,
    ...Object.keys(stockByDay),
    ...Object.keys(startByDay),
  ])].sort((a, b) => b.localeCompare(a));

  const dayKey = dayOptions.includes(selectedDay) ? selectedDay : today;
  const daySales = salesByDay[dayKey];
  const sales = useMemo(
    () => [...(daySales || [])].sort((a, b) => Number(a.num) - Number(b.num)),
    [daySales],
  );
  const summary = useMemo(() => summarizeSales(sales), [sales]);
  const isToday = dayKey === getBusinessDayKey();
  const inventory = useMemo(
    () => summarizeInventory({ dayKey, sales, stockByDay, salesByDay, startByDay, inventoryItems, usedInventoryIds }),
    [dayKey, sales, stockByDay, salesByDay, startByDay, inventoryItems, usedInventoryIds],
  );
  const hasEntries = Object.keys(stockByDay[dayKey] || {}).length > 0
    || Object.keys(startByDay[dayKey] || {}).length > 0;

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadSalesExcel(sales, dayKey, inventory);
    } catch (error) {
      console.error('No se pudo generar el Excel:', error);
      window.alert('No se pudo generar el archivo de Excel. Intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  }

  const inventoryPanel = (
    <section className="cc-panel cc-panel-wide">
      <div className="inv-head">
        <div>
          <h3>Inventario del día</h3>
          <p className="cc-panel-hint">
            Escribe cuántas unidades ingresaron de cada insumo. Lo vendido se descuenta solo de los pedidos cobrados.
            Si te equivocaste, corrige el número: en "Ingresó" lo de este día, en "Sobrante de ayer" el conteo real con que empezó el día.
            Para corregir otro día, elígelo arriba.
          </p>
        </div>
        <div className="inv-head-actions">
          {isAdmin && (
            <button type="button" className="cc-btn cc-btn-secondary" onClick={onOpenNewItem}>
              + Nuevo insumo
            </button>
          )}
          {hasEntries && (
            <button type="button" className="cc-btn cc-btn-danger" onClick={() => onClearStock(dayKey)}>
              Limpiar inventario del día
            </button>
          )}
        </div>
      </div>

      {inventory.salesWithoutDetail > 0 && (
        <div className="inv-note">
          {inventory.salesWithoutDetail === 1
            ? '1 venta de este día se cobró antes de activar el inventario y no descuenta insumos.'
            : `${inventory.salesWithoutDetail} ventas de este día se cobraron antes de activar el inventario y no descuentan insumos.`}
        </div>
      )}

      <div className="cc-table-scroll">
        <table className="cc-table inv-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="cc-num">Sobrante de ayer</th>
              <th className="cc-num">Ingresó</th>
              <th className="cc-num">Disponible</th>
              <th className="cc-num">Vendido</th>
              <th className="cc-num">Quedan</th>
            </tr>
          </thead>
          {inventory.groups.map(({ group, rows, subgroups }) => (
            <tbody key={group}>
              {/* Fila de categoría principal (Panes, Proteínas, Bebidas, Extras) */}
              <tr className="inv-group"><td colSpan={6}>{group}</td></tr>

              {/* Ítems sin subgrupo: se muestran directamente */}
              {rows.map(row => (
                <InvRow key={row.id} row={row} dayKey={dayKey} onSetStock={onSetStock} onSetStart={onSetStart} />
              ))}

              {/* Subgrupos plegables (ej. "Refresco de lata", "Carnes") */}
              {subgroups.map(({ subgroup, rows: subRows, summary: subSum }) => {
                const key = `${group}__${subgroup}`;
                const isOpen = !collapsed.has(key); // abierto por defecto
                return (
                  <React.Fragment key={key}>
                    <SubgroupRow
                      subgroup={subgroup}
                      summary={subSum}
                      isOpen={isOpen}
                      onToggle={() => toggleSubgroup(key)}
                    />
                    {isOpen && subRows.map(row => (
                      <InvRow key={row.id} row={row} dayKey={dayKey} onSetStock={onSetStock} onSetStart={onSetStart} />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );

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
            className="cc-btn cc-btn-excel"
            onClick={handleExport}
            disabled={(sales.length === 0 && !inventory.hasStock) || isExporting}
          >
            {isExporting ? 'Generando…' : '⬇ Exportar a Excel'}
          </button>
        </div>
      </div>

      {sales.length === 0 ? (
        <>
          <div className="cc-empty">
            Todavía no hay ventas cobradas en este día.
            <span>Los pedidos entran aquí cuando los cobras desde "Pedidos activos".</span>
          </div>
          {inventoryPanel}
        </>
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
              <p className="cc-panel-hint">
                Usa esto para cuadrar el efectivo en caja.
                {summary.splitCount > 0 && ` ${summary.splitCount} ${summary.splitCount === 1 ? 'pedido se pagó' : 'pedidos se pagaron'} con más de un método: cada uno suma solo su parte.`}
              </p>
              <table className="cc-mini-table">
                <thead>
                  <tr><th>Método</th><th>Pagos</th><th>Total</th></tr>
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
                      <td className="cc-num">{product.totalUsd === null ? 'Incluido' : formatUsd(product.totalUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {inventoryPanel}

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
                      <td>
                        {sale.customer}
                        {sale.revision > 0 && (
                          <span className="cc-sub-bs">
                            Corregido{sale.revision > 1 ? ` ×${sale.revision}` : ''}
                            {Number.isFinite(Number(sale.edits?.[0]?.prevTotal)) &&
                              ` · total original ${formatUsd(sale.edits[0].prevTotal)}`}
                          </span>
                        )}
                      </td>
                      <td>{sale.type}</td>
                      <td>
                        {isSplitPayment(sale) ? (
                          <>
                            <span className="cc-split-tag">Pago dividido</span>
                            {getOrderPayments(sale).map((part, index) => (
                              <span key={`${part.method}-${index}`} className="cc-pay-part">
                                {part.method} · {formatUsd(part.amount)}
                                {paymentBs(sale, part) !== null && part.method === PAY_MOBILE && (
                                  <span className="cc-sub-bs">{formatBs(paymentBs(sale, part))}</span>
                                )}
                                {part.ref && <span className="cc-sub-bs">Ref. {part.ref}</span>}
                              </span>
                            ))}
                          </>
                        ) : (
                          <>
                            {sale.pay}
                            {sale.payRef && <span className="cc-sub-bs">Ref. {sale.payRef}</span>}
                          </>
                        )}
                      </td>
                      <td className="cc-products">
                        {(sale.items || []).map(item => {
                          if (item.isCombo) {
                            return (
                              <span key={item.uid ?? item.name} className="cc-product-line cc-combo-line">
                                {item.qty}x {item.name} · {formatUsd(item.price * item.qty)}
                                {(item.parts || []).map((part, index) => {
                                  const details = [describeLine(part), ...(part.mods || [])].filter(Boolean);
                                  return (
                                    <span className="cc-combo-part" key={part.id || `${part.name}-${index}`}>
                                      ↳ {item.qty}x {partTitle(part)}
                                      {details.length > 0 && <em> ({details.join(', ')})</em>}
                                    </span>
                                  );
                                })}
                              </span>
                            );
                          }
                          const details = [describeLine(item), ...(item.mods || [])].filter(Boolean);
                          return (
                            <span key={item.uid ?? item.name} className="cc-product-line">
                              {item.qty}x {item.name}
                              {details.length > 0 && <em> ({details.join(', ')})</em>}
                            </span>
                          );
                        })}
                      </td>
                      <td className="cc-num cc-strong">
                        {formatUsd(sale.total)}
                        {sale.deliveryFee > 0 && (
                          <span className="cc-sub-bs">Incluye delivery {formatUsd(sale.deliveryFee)}</span>
                        )}
                        {hasAmount(sale.totalBs) && (
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
