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
import {
  PAY_MOBILE, PAY_METHODS, getOrderPayments, isSplitPayment, paymentBs,
  isCreditSale, isCreditPending,
} from '../utils/payment';
import { summarizeOpenCredits, describeAge } from '../utils/credits';
import { useBcvRateInfo, setManualRate, clearManualRate } from '../hooks/useBcvRate';
import { describeLine, partTitle } from '../utils/lineOptions';

// Clave localStorage para el estado abierto/cerrado de los subgrupos.
const COLLAPSED_KEY = 'perritos_inv_collapsed';

function loadCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY)) || []);
  } catch { return new Set(); }
}

const COLLAPSED_GROUPS_KEY = 'perritos_inv_groups_collapsed';

/**
 * Devuelve `null` cuando nunca se ha tocado nada: eso significa "todas las
 * categorÃ­as cerradas", que es como debe abrir la tabla. No se puede
 * representar con un Set lleno porque los nombres de las categorÃ­as no se
 * conocen hasta que el inventario estÃ¡ calculado.
 */
function loadCollapsedGroups() {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (raw === null) return null;
    return new Set(JSON.parse(raw) || []);
  } catch { return null; }
}

function computeGroupAlerts(rows, subgroups) {
  let out = 0, low = 0;
  for (const r of rows) { if (r.status === 'out') out++; else if (r.status === 'low') low++; }
  for (const sg of subgroups) for (const r of sg.rows) { if (r.status === 'out') out++; else if (r.status === 'low') low++; }
  return { out, low };
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
 * Campo numÃ©rico del inventario. Guarda lo escrito mientras se teclea, para
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
/** "= 4 paquetes" bajo la casilla, para insumos que llegan empacados. */
function PackHint({ pack, value }) {
  if (!pack) return null;
  const units = Number(value);
  if (!Number.isFinite(units) || units <= 0) {
    return <span className="inv-pack-hint">1 paq. = {pack}</span>;
  }
  const packs = units / pack;
  const label = Number.isInteger(packs)
    ? `= ${packs} paq.`
    : `= ${Math.floor(packs)} paq. + ${units % pack}`;
  return <span className="inv-pack-hint">{label}</span>;
}

function InvRow({ row, dayKey, onSetStock, onSetStart, onSetWaste, isSubgroupItem, isAdmin, onEditItem }) {
  return (
    <tr key={row.id} className={row.status ? `inv-row-${row.status}` : ''}>
      {/* El insumo es el nivel MÃS ligero: sin cc-strong, que lo dejaba
          mÃ¡s pesado que el subgrupo que lo contiene. */}
      <td className={isSubgroupItem ? 'inv-indent-2' : 'inv-indent-1'}>
        <span className="inv-item-name">
          {row.name}
          {row.manualOnly && <span className="inv-manual-tag">solo conteo manual</span>}
          {/* Solo los insumos creados desde la app se editan. Los del cÃ³digo
              los referencia el menÃº por id: cambiarlos rompe el histÃ³rico. */}
          {isAdmin && row.isCustom && (
            <button
              type="button"
              className="product-action inv-edit-btn"
              onClick={() => onEditItem(row)}
              title={`Editar ${row.name}`}
              aria-label={`Editar ${row.name}`}
            >
              â
            </button>
          )}
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
              title="Volver al cÃ¡lculo automÃ¡tico"
              aria-label={`Volver al cÃ¡lculo automÃ¡tico: ${row.name}`}
            >
              âº
            </button>
          )}
        </span>
      </td>
      <td className="cc-num">
        <StockInput
          value={row.entered}
          onCommit={value => onSetStock(dayKey, row.id, value)}
          label={`IngresÃ³: ${row.name}`}
        />
        <PackHint pack={row.pack} value={row.entered} />
      </td>
      <td className="cc-num">
        <StockInput
          className="inv-input inv-input-waste"
          value={row.wasted || null}
          onCommit={value => onSetWaste(dayKey, row.id, value)}
          label={`DaÃ±ado: ${row.name}`}
        />
      </td>
      <td className="cc-num">
        <span className={`inv-fig ${row.available === null ? 'inv-muted' : ''}`}>
          {row.available !== null ? row.available : 'â'}
        </span>
      </td>
      <td className="cc-num">
        <span className={`inv-fig ${row.sold === 0 ? 'inv-muted' : ''}`}>{row.sold}</span>
      </td>
      <td className="cc-num">
        {row.remaining !== null ? (
          <span className={`inv-remaining ${row.status ? `inv-${row.status}` : ''}`}>
            {row.remaining}
            {row.status && <em>{INV_STATUS_LABEL[row.status]}</em>}
          </span>
        ) : <span className="inv-fig inv-muted">â</span>}
      </td>
    </tr>
  );
}

/**
 * SeÃ±ales de agotado / por acabarse de un conjunto de insumos.
 * Se muestran SIEMPRE, no solo al plegar: el dueÃ±o tiene que ver que se
 * acabÃ³ el Chinotto sin tener que abrir los cuatro grupos de bebidas.
 */
function AlertBadges({ alerts }) {
  if (alerts.out === 0 && alerts.low === 0) return null;
  return (
    <span className="inv-alerts">
      {alerts.out > 0 && (
        <span className="inv-alert-badge inv-alert-out">
          {alerts.out} agotad{alerts.out === 1 ? 'o' : 'os'}
        </span>
      )}
      {alerts.low > 0 && (
        <span className="inv-alert-badge inv-alert-low">{alerts.low} por acabarse</span>
      )}
    </span>
  );
}

/** Celda numÃ©rica de una fila de subgrupo: el total, o "â" si nadie ingresÃ³ nada. */
function SgNum({ value }) {
  return (
    <td className="cc-num">
      <span className={`inv-sg-num ${value === null ? 'inv-muted' : ''}`}>
        {value !== null ? value : 'â'}
      </span>
    </td>
  );
}

/** Fila de cabecera de un subgrupo (plegable). Totales alineados en las mismas columnas que los Ã­tems. */
function SubgroupRow({ subgroup, summary, isOpen, onToggle }) {
  const { alerts } = summary;
  return (
    <tr className="inv-subgroup" onClick={onToggle} role="button" aria-expanded={isOpen}>
      <td>
        <span className="inv-sub-chevron">{isOpen ? 'â¾' : 'â¸'}</span>
        <span className="inv-subgroup-name">{subgroup}</span>
        <AlertBadges alerts={alerts} />
      </td>
      <SgNum value={summary.carry} />
      <SgNum value={summary.entered} />
      <SgNum value={summary.wasted || null} />
      <SgNum value={summary.available} />
      <SgNum value={summary.sold} />
      {/* El total del subgrupo NO lleva etiqueta "Agotado": decÃ­a
          "58 Agotado" en Salchichas porque UNA de las tres estaba en cero.
          CuÃ¡les se acabaron ya lo dicen los badges de la izquierda. */}
      <SgNum value={summary.remaining} />
    </tr>
  );
}

/**
 * Deudas abiertas de todos los dÃ­as, agrupadas por cliente.
 *
 * Cruza TODO el registro, no solo el dÃ­a del cierre: una deuda del martes se
 * cobra el sÃ¡bado, y si solo se mirara el dÃ­a seleccionado desaparecerÃ­a de
 * la vista al dÃ­a siguiente de hacerla.
 */
function CreditsPanel({ salesByDay, today, isAdmin, onSettleCredit }) {
  const [settling, setSettling] = useState(null); // saleId que se estÃ¡ cerrando
  const credits = useMemo(() => summarizeOpenCredits(salesByDay, today), [salesByDay, today]);

  if (credits.count === 0) return null;

  return (
    <section className="cc-panel cc-panel-wide credits-panel">
      <div className="inv-head">
        <div>
          <h3>Por cobrar</h3>
          <p className="cc-panel-hint">
            Pedidos que salieron a crÃ©dito y siguen sin pagarse. No suman a la caja de ningÃºn dÃ­a
            hasta que se marquen como pagados.
          </p>
        </div>
        <div className="credits-total">
          <span className="cc-stat-label">En la calle</span>
          <strong className="credits-total-value">{formatUsd(credits.totalUsd)}</strong>
          <span className="cc-stat-sub">{credits.count} {credits.count === 1 ? 'pedido' : 'pedidos'}</span>
        </div>
      </div>

      <ul className="credits-list">
        {credits.customers.map(customer => (
          <li key={customer.key} className={`credit-card ${customer.oldestDays >= 7 ? 'credit-old' : ''}`}>
            <div className="credit-head">
              <div>
                <strong className="credit-name">{customer.name}</strong>
                <span className="credit-age">{describeAge(customer.oldestDays)}</span>
              </div>
              <strong className="credit-amount">{formatUsd(customer.totalUsd)}</strong>
            </div>

            <ul className="credit-sales">
              {customer.sales.map(sale => (
                <li key={sale.saleId}>
                  <span className="credit-sale-main">
                    #{sale.num} Â· {formatDayLabel(sale.dayKey)} Â· {formatUsd(sale.total)}
                    <span className="credit-sale-age">{describeAge(sale.days)}</span>
                  </span>

                  {isAdmin && (
                    settling === sale.saleId ? (
                      <span className="credit-settle">
                        <span className="credit-settle-label">PagÃ³ con:</span>
                        {PAY_METHODS.map(method => (
                          <button
                            key={method}
                            type="button"
                            className="cc-btn cc-btn-secondary credit-settle-btn"
                            onClick={() => { onSettleCredit(sale.dayKey, sale.saleId, method); setSettling(null); }}
                          >
                            {method}
                          </button>
                        ))}
                        <button type="button" className="credit-cancel" onClick={() => setSettling(null)}>
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="cc-btn cc-btn-secondary credit-pay-btn"
                        onClick={() => setSettling(sale.saleId)}
                      >
                        Marcar pagada
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Tasa del dÃ­a. Solo el administrador la toca: si el trabajador pudiera
 * cambiarla, el dÃ­a que falte plata en la caja la sospecha cae sobre Ã©l
 * aunque no haya hecho nada.
 *
 * La tasa con la que se cobrÃ³ cada pedido ya queda guardada en la venta
 * (`bcvRate`), asÃ­ que cambiarla hoy no altera el histÃ³rico.
 */
function RatePanel() {
  const { rate, autoRate, isManual, ageHours } = useBcvRateInfo();
  const [draft, setDraft] = useState('');

  function apply(event) {
    event.preventDefault();
    const value = Number(String(draft).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    setManualRate(value);
    setDraft('');
  }

  // MÃ¡s de un dÃ­a con la misma tasa manual casi siempre es un olvido, no una
  // decisiÃ³n: el riesgo real no es ponerla mal, es dejarla puesta.
  const isStale = isManual && ageHours !== null && ageHours >= 24;

  return (
    <section className="cc-panel cc-panel-wide rate-panel">
      <div className="inv-head">
        <div>
          <h3>Tasa del dÃ­a</h3>
          <p className="cc-panel-hint">
            Los bolÃ­vares de cada cobro salen de aquÃ­. Normalmente se toma sola del dÃ³lar oficial;
            fÃ­jala a mano solo cuando la del dÃ­a no refleje lo que se estÃ¡ cobrando en el local.
          </p>
        </div>
      </div>

      <div className="rate-row">
        <div className="rate-current">
          <span className="cc-stat-label">En uso ahora</span>
          <strong className="rate-value">
            {rate !== null && rate !== undefined ? `Bs. ${Number(rate).toFixed(2)}` : 'Sin tasa'}
          </strong>
          <span className={`rate-tag ${isManual ? 'rate-tag-manual' : 'rate-tag-auto'}`}>
            {isManual ? 'Fijada a mano' : 'AutomÃ¡tica'}
          </span>
        </div>

        {isManual && (
          <div className="rate-current">
            <span className="cc-stat-label">AutomÃ¡tica hoy</span>
            <strong className="rate-value rate-value-soft">
              {autoRate !== null ? `Bs. ${Number(autoRate).toFixed(2)}` : 'â'}
            </strong>
          </div>
        )}

        <form className="rate-form" onSubmit={apply}>
          <input
            className="inv-input rate-input"
            inputMode="decimal"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="900"
            aria-label="Nueva tasa en bolÃ­vares"
          />
          <button type="submit" className="cc-btn cc-btn-secondary" disabled={draft.trim() === ''}>
            Fijar tasa
          </button>
          {isManual && (
            <button type="button" className="cc-btn cc-btn-danger" onClick={clearManualRate}>
              Volver a la automÃ¡tica
            </button>
          )}
        </form>
      </div>

      {isManual && (
        <div className={`inv-note ${isStale ? 'rate-note-stale' : ''}`}>
          {isStale
            ? `Esta tasa lleva ${Math.floor(ageHours / 24)} dÃ­a(s) puesta a mano. RevÃ­sala o vuelve a la automÃ¡tica: el sistema no la estÃ¡ actualizando solo.`
            : 'Mientras estÃ© fijada a mano, el sistema no usa la tasa del dÃ³lar oficial.'}
        </div>
      )}
    </section>
  );
}

export default function CashClose({
  salesByDay, availableDays, today, stockByDay = {}, startByDay = {}, wasteByDay = {},
  onSetStock, onSetStart, onSetWaste, onClearStock, onRemoveSale, onClearDay,
  onUnvoidSale, onSettleCredit,
  isAdmin = false,
  inventoryItems,
  usedInventoryIds,
  onOpenNewItem,
  onEditItem,
}) {
  const [selectedDay, setSelectedDay] = useState(today);
  const [isExporting, setIsExporting] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);

  // Persistir estado plegado en localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch { /* localStorage lleno */ }
  }, [collapsed]);

  useEffect(() => {
    // null = nunca se tocÃ³. Guardarlo como [] harÃ­a que la prÃ³xima visita
    // abriera con todas las categorÃ­as desplegadas.
    if (collapsedGroups === null) return;
    try {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups]));
    } catch { /* localStorage lleno */ }
  }, [collapsedGroups]);

  function toggleSubgroup(key) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(group) {
    setCollapsedGroups(prev => {
      // Primer clic de la sesiÃ³n: estaba todo cerrado, se abre solo este.
      if (prev === null) {
        return new Set(inventory.groups.map(g => g.group).filter(g => g !== group));
      }
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  // Se puede abrir cualquier dÃ­a con ventas o con inventario cargado.
  const dayOptions = [...new Set([
    today,
    ...availableDays,
    ...Object.keys(stockByDay),
    ...Object.keys(startByDay),
    ...Object.keys(wasteByDay),
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
    () => summarizeInventory({ dayKey, sales, stockByDay, salesByDay, startByDay, wasteByDay, inventoryItems, usedInventoryIds }),
    [dayKey, sales, stockByDay, salesByDay, startByDay, wasteByDay, inventoryItems, usedInventoryIds],
  );
  const hasEntries = Object.keys(stockByDay[dayKey] || {}).length > 0
    || Object.keys(startByDay[dayKey] || {}).length > 0
    || Object.keys(wasteByDay[dayKey] || {}).length > 0;

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadSalesExcel(sales, dayKey, inventory, salesByDay);
    } catch (error) {
      console.error('No se pudo generar el Excel:', error);
      window.alert('No se pudo generar el archivo de Excel. Intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  }

  const ratePanel = isAdmin ? <RatePanel /> : null;

  const creditsPanel = (
    <CreditsPanel
      salesByDay={salesByDay}
      today={today}
      isAdmin={isAdmin}
      onSettleCredit={onSettleCredit}
    />
  );

  const inventoryPanel = (
    <section className="cc-panel cc-panel-wide">
      <div className="inv-head">
        <div>
          <h3>Inventario del dÃ­a</h3>
          <p className="cc-panel-hint">
            Escribe cuÃ¡ntas unidades ingresaron de cada insumo. Lo vendido se descuenta solo de los pedidos cobrados.
            Si te equivocaste, corrige el nÃºmero: en "IngresÃ³" lo de este dÃ­a, en "Sobrante de ayer" el conteo real con que empezÃ³ el dÃ­a.
            Para corregir otro dÃ­a, elÃ­gelo arriba.
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
              Limpiar inventario del dÃ­a
            </button>
          )}
        </div>
      </div>

      {inventory.salesWithoutDetail > 0 && (
        <div className="inv-note">
          {inventory.salesWithoutDetail === 1
            ? '1 venta de este dÃ­a se cobrÃ³ antes de activar el inventario y no descuenta insumos.'
            : `${inventory.salesWithoutDetail} ventas de este dÃ­a se cobraron antes de activar el inventario y no descuentan insumos.`}
        </div>
      )}

      <div className="cc-table-scroll">
        <table className="cc-table inv-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="cc-num">Sobrante de ayer</th>
              <th className="cc-num">IngresÃ³</th>
              <th className="cc-num">DaÃ±ado</th>
              <th className="cc-num">Disponible</th>
              <th className="cc-num">Vendido</th>
              <th className="cc-num">Quedan</th>
            </tr>
          </thead>
          {inventory.groups.map(({ group, rows, subgroups }) => {
            const isGroupOpen = collapsedGroups !== null && !collapsedGroups.has(group);
            const groupAlerts = computeGroupAlerts(rows, subgroups);
            return (
              <tbody key={group}>
                {/* Fila de categorÃ­a principal â plegable */}
                <tr className={`inv-group ${isGroupOpen ? 'is-open' : ''}`}>
                  <td colSpan={7}>
                    {/* La pÃ­ldora va dentro de la celda y no en el <tr>:
                        una fila de tabla no acepta border-radius. */}
                    <div
                      className="inv-group-bar"
                      onClick={() => toggleGroup(group)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isGroupOpen}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleGroup(group);
                        }
                      }}
                    >
                      <span className="inv-chevron">{isGroupOpen ? 'â¾' : 'â¸'}</span>
                      <span className="inv-group-name">{group}</span>
                      <AlertBadges alerts={groupAlerts} />
                    </div>
                  </td>
                </tr>

                {/* Ãtems sin subgrupo: se muestran directamente */}
                {isGroupOpen && rows.map(row => (
                  <InvRow key={row.id} row={row} dayKey={dayKey} onSetStock={onSetStock} onSetStart={onSetStart} onSetWaste={onSetWaste} isAdmin={isAdmin} onEditItem={onEditItem} />
                ))}

                {/* Subgrupos plegables */}
                {isGroupOpen && subgroups.map(({ subgroup, rows: subRows, summary: subSum }) => {
                  const key = `${group}__${subgroup}`;
                  const isOpen = !collapsed.has(key);
                  return (
                    <React.Fragment key={key}>
                      <SubgroupRow
                        subgroup={subgroup}
                        summary={subSum}
                        isOpen={isOpen}
                        onToggle={() => toggleSubgroup(key)}
                      />
                      {isOpen && subRows.map(row => (
                        <InvRow key={row.id} row={row} dayKey={dayKey} onSetStock={onSetStock} onSetStart={onSetStart} onSetWaste={onSetWaste} isSubgroupItem isAdmin={isAdmin} onEditItem={onEditItem} />
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );

  return (
    <div className="cash-close">
      <div className="cc-head">
        <div>
          <h2>Cierre de caja</h2>
          <p className="cc-day">{formatDayLabel(dayKey)}{isToday && <span className="cc-live">Â· en curso</span>}</p>
        </div>

        <div className="cc-head-actions">
          {dayOptions.length > 1 && (
            <select
              className="cc-select"
              value={dayKey}
              onChange={event => setSelectedDay(event.target.value)}
              aria-label="Seleccionar dÃ­a"
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
            {isExporting ? 'Generandoâ¦' : 'â¬ Exportar a Excel'}
          </button>
        </div>
      </div>

      {sales.length === 0 ? (
        <>
          <div className="cc-empty">
            TodavÃ­a no hay ventas cobradas en este dÃ­a.
            <span>Los pedidos entran aquÃ­ cuando los cobras desde "Pedidos activos".</span>
          </div>
          {creditsPanel}
          {ratePanel}
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
            {/* Con crÃ©dito, vendido y cobrado dejan de ser el mismo nÃºmero. */}
            {summary.creditOpenUsd > 0 && (
              <StatCard
                label="EntrÃ³ a la caja"
                value={formatUsd(summary.collectedUsd)}
                sub={`${formatUsd(summary.creditOpenUsd)} quedÃ³ a crÃ©dito`}
              />
            )}
            <StatCard label="Pedidos cobrados" value={summary.count} />
            <StatCard label="Ticket promedio" value={formatUsd(summary.averageTicket)} />
            <StatCard label="Unidades vendidas" value={summary.itemsSold} />
            {summary.voidedCount > 0 && (
              <StatCard
                label="Anulados"
                value={summary.voidedCount}
                sub={`${formatUsd(summary.voidedUsd)} que no entraron`}
              />
            )}
          </div>

          <div className="cc-grid">
            <section className="cc-panel">
              <h3>Por mÃ©todo de pago</h3>
              <p className="cc-panel-hint">
                Usa esto para cuadrar el efectivo en caja.
                {summary.splitCount > 0 && ` ${summary.splitCount} ${summary.splitCount === 1 ? 'pedido se pagÃ³' : 'pedidos se pagaron'} con mÃ¡s de un mÃ©todo: cada uno suma solo su parte.`}
              </p>
              <table className="cc-mini-table">
                <thead>
                  <tr><th>MÃ©todo</th><th>Pagos</th><th>Total</th></tr>
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
              <p className="cc-panel-hint">Local vs. delivery del dÃ­a.</p>
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
              <h3>Productos mÃ¡s vendidos</h3>
              <p className="cc-panel-hint">QuÃ© reponer y quÃ© se mueve.</p>
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

          {creditsPanel}
          {ratePanel}
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
                    <tr key={sale.saleId} className={sale.voided ? 'cc-row-voided' : ''}>
                      <td className="cc-strong">#{sale.num}</td>
                      <td>{sale.closedTime}</td>
                      <td>
                        {sale.customer}
                        {sale.voided && (
                          <span className="cc-void-tag">
                            Anulado Â· {sale.voided.reason}
                          </span>
                        )}
                        {sale.revision > 0 && (
                          <span className="cc-sub-bs">
                            Corregido{sale.revision > 1 ? ` Ã${sale.revision}` : ''}
                            {Number.isFinite(Number(sale.edits?.[0]?.prevTotal)) &&
                              ` Â· total original ${formatUsd(sale.edits[0].prevTotal)}`}
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
                                {part.method} Â· {formatUsd(part.amount)}
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
                            {isCreditSale(sale) && (
                              sale.creditPaid ? (
                                <span className="cc-credit-tag cc-credit-paid">
                                  Pagado con {sale.creditPaid.method}
                                </span>
                              ) : (
                                <span className="cc-credit-tag">Sin pagar</span>
                              )
                            )}
                          </>
                        )}
                      </td>
                      <td className="cc-products">
                        {(sale.items || []).map(item => {
                          if (item.isCombo) {
                            return (
                              <span key={item.uid ?? item.name} className="cc-product-line cc-combo-line">
                                {item.qty}x {item.name} Â· {formatUsd(item.price * item.qty)}
                                {(item.parts || []).map((part, index) => {
                                  const details = [describeLine(part), ...(part.mods || [])].filter(Boolean);
                                  return (
                                    <span className="cc-combo-part" key={part.id || `${part.name}-${index}`}>
                                      â³ {item.qty}x {partTitle(part)}
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
                        {sale.voided ? (
                          <button
                            type="button"
                            className="cc-undo"
                            onClick={() => onUnvoidSale(dayKey, sale.saleId)}
                            title="Deshacer la anulaciÃ³n"
                          >
                            Reactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="cc-remove"
                            onClick={() => onRemoveSale(dayKey, sale.saleId)}
                            title="Borrar este cobro del registro"
                            aria-label={`Borrar cobro del pedido ${sale.num}`}
                          >
                            â
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>TOTAL DEL DÃA</td>
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
              Borrar registro de este dÃ­a
            </button>
          </div>
        </>
      )}
    </div>
  );
}
