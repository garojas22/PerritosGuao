import { getStartingPrice, hasValidComboPrice, hasVariants } from '../utils/lineOptions';

export default function MenuGrid({ items, isAdmin = false, addProductLabel = 'Agregar producto', onAdd, onAddProduct, onEditProduct }) {
  return (
    <div className="menu-grid">
      {items.filter(item => !item.hidden).map(item => {
        const isDisabled = item.isCombo && !hasValidComboPrice(item);
        return (
        <div
          key={item.id}
          className={`item-card ${isDisabled ? 'item-card-disabled' : ''}`}
          onClick={() => !isDisabled && onAdd(item)}
          role="button"
          aria-disabled={isDisabled}
          tabIndex={isDisabled ? -1 : 0}
        >
          <div className="row-top">
            <h3>{item.name}</h3>
            <span className="price">
              {isDisabled
                ? 'Falta precio'
                : <>{hasVariants(item) && item.variants.length > 1 && <span className="price-from">desde</span>}${getStartingPrice(item).toFixed(2)}</>}
            </span>
          </div>
          <p>{item.desc || (item.isCombo ? item.parts.map(part => part.label).join(' + ') : '')}</p>
          {/* Editar productos (precios incluidos) es solo del administrador. */}
          {isAdmin && (
            <div className="item-actions">
              <button type="button" className="product-action" onClick={event => { event.stopPropagation(); onEditProduct(item); }} aria-label={`Editar ${item.name}`}>
                <span aria-hidden="true">✎</span> Editar
              </button>
            </div>
          )}
        </div>
      )})}
      {isAdmin && (
        <button type="button" className="add-product-card" onClick={onAddProduct}>
          <span className="add-product-plus">+</span>
          <span>{addProductLabel}</span>
        </button>
      )}
    </div>
  );
}