import { useEffect } from "react";

export default function OfferTypeModal({ onChooseProduct, onChooseCombo, onClose }) {
  // Escape cierra la ventana, igual que en los demás modales del sistema.
  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="product-modal offer-type-modal" role="dialog" aria-modal="true" aria-labelledby="offer-type-title">
        <div className="modal-heading">
          <div>
            <span className="modal-kicker">Catálogo de ofertas</span>
            <h2 id="offer-type-title">¿Qué quieres crear?</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ventana">×</button>
        </div>
        <div className="offer-type-options">
          <button type="button" className="offer-type-option" onClick={onChooseProduct}>
            <strong>Producto individual</strong>
            <span>Crear un producto como en las demás categorías.</span>
          </button>
          <button type="button" className="offer-type-option" onClick={onChooseCombo}>
            <strong>Combinar productos</strong>
            <span>Armar una oferta con productos existentes, opciones permitidas y un precio fijo.</span>
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </section>
    </div>
  );
}