export default function MenuGrid({ items, onAdd, onAddProduct, onEditProduct, onDeleteProduct }) {
  return (
    <div className="menu-grid">
      {items.map(item => (
        <div key={item.id} className="item-card" onClick={() => onAdd(item)} role="button" tabIndex="0">
          <div className="row-top">
            <h3>{item.name}</h3>
            <span className="price">${item.price.toFixed(2)}</span>
          </div>
          <p>{item.desc}</p>
          <div className="add-hint">+ Agregar al pedido</div>
          {item.isCustom && (
            <div className="item-actions">
              <button type="button" className="product-action" onClick={event => { event.stopPropagation(); onEditProduct(item); }} aria-label={`Editar ${item.name}`}>
                <span aria-hidden="true">✎</span> Editar
              </button>
              <button type="button" className="product-action" onClick={event => { event.stopPropagation(); onDeleteProduct(item); }} aria-label={`Eliminar ${item.name}`}>
                <span className="product-action-icon product-action-icon-delete" aria-hidden="true">✕</span> Eliminar
              </button>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="add-product-card" onClick={onAddProduct}>
        <span className="add-product-plus">+</span>
        <span>Agregar producto</span>
      </button>
    </div>
  );
}
