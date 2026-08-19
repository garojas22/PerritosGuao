export default function MenuGrid({ items, onAdd }) {
  return (
    <div className="menu-grid">
      {items.map(item => (
        <div key={item.id} className="item-card" onClick={() => onAdd(item)}>
          <div className="row-top">
            <h3>{item.name}</h3>
            <span className="price">${item.price.toFixed(2)}</span>
          </div>
          <p>{item.desc}</p>
          <div className="add-hint">+ Agregar al pedido</div>
        </div>
      ))}
    </div>
  );
}
