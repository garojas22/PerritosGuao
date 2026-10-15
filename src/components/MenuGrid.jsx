import { getComboIssue, getStartingPrice, hasVariants } from '../utils/lineOptions';

// Texto que reemplaza al precio cuando una oferta no se puede vender, y la ayuda para el administrador.
const COMBO_ISSUES = {
  precio: { label: 'Falta precio', help: 'Esta oferta no tiene un precio válido. Edítala para poder venderla.' },
  incompleta: { label: 'Incompleta', help: 'A esta oferta le falta un producto o una opción. Edítala para poder venderla.' },
};

export default function MenuGrid({ items, isAdmin = false, addProductLabel = 'Agregar producto', productsById = {}, onAdd, onAddProduct, onEditProduct }) {
  return (
    <div className="menu-grid">
      {items.filter(item => !item.hidden).map(item => {
        const issue = getComboIssue(item, productsById);
        const isDisabled = issue !== null;
        const parts = Array.isArray(item.parts) ? item.parts : [];

        return (
          <div
            key={item.id}
            className={`item-card ${isDisabled ? 'item-card-disabled' : ''}`}
            onClick={() => !isDisabled && onAdd(item)}
            onKeyDown={event => {
              // Con teclado (Enter / Espacio) la tarjeta se comporta como un botón.
              if (isDisabled || event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onAdd(item);
              }
            }}
            role="button"
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : 0}
            title={isDisabled ? COMBO_ISSUES[issue].help : undefined}
          >
            <div className="row-top">
              <h3>{item.name}</h3>
              <span className="price">
                {isDisabled
                  ? COMBO_ISSUES[issue].label
                  : <>{hasVariants(item) && item.variants.length > 1 && <span className="price-from">desde</span>}${getStartingPrice(item).toFixed(2)}</>}
              </span>
            </div>
            <p>{item.desc || (item.isCombo ? parts.map(part => part.label).join(' + ') : '')}</p>
            {/* Editar productos (precios incluidos) es solo del administrador. */}
            {isAdmin && (
              <div className="item-actions">
                <button type="button" className="product-action" onClick={event => { event.stopPropagation(); onEditProduct(item); }} aria-label={`Editar ${item.name}`}>
                  <span aria-hidden="true">✎</span> Editar
                </button>
              </div>
            )}
          </div>
        );
      })}
      {isAdmin && (
        <button type="button" className="add-product-card" onClick={onAddProduct}>
          <span className="add-product-plus">+</span>
          <span>{addProductLabel}</span>
        </button>
      )}
    </div>
  );
}