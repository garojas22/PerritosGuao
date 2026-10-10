import { useEffect, useState } from 'react';
import { getInventoryName } from '../data/inventory';
import {
askableChoices,
getDefaultSelection,
hasVariants,
resolveSelection,
} from '../utils/lineOptions';

/**
 * Ventana que aparece al tocar un producto con tamaños (1 carne / 2 carnes)
 * o con elecciones (tipo de pan, tipo de carne). Arranca con lo más común ya
 * marcado, así el cajero solo toca lo que cambia y confirma.
 */
export default function ProductOptionsModal({ product, onConfirm, onClose }) {
const [selection, setSelection] = useState(() => getDefaultSelection(product));

useEffect(() => {
function handleKey(event) {
    if (event.key === 'Escape') onClose();
}
window.addEventListener('keydown', handleKey);
return () => window.removeEventListener('keydown', handleKey);
}, [onClose]);

const choices = askableChoices(product);
const resolved = resolveSelection(product, selection);

function pickVariant(variantId) {
setSelection(prev => ({ ...prev, variantId }));
}

function pickChoice(choiceId, itemId) {
setSelection(prev => ({ ...prev, choices: { ...prev.choices, [choiceId]: itemId } }));
}

return (
<div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="product-modal options-modal" role="dialog" aria-modal="true" aria-labelledby="options-title">
    <div className="modal-heading">
        <div>
        <span className="modal-kicker">Armar pedido</span>
        <h2 id="options-title">{product.name}</h2>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ventana">×</button>
    </div>

    {hasVariants(product) && product.variants.length > 1 && (
        <div className="opt-group">
        <div className="opt-label">Tamaño</div>
        <div className="opt-choices">
            {product.variants.map(variant => (
            <button
                key={variant.id}
                type="button"
                className={`opt-btn ${selection.variantId === variant.id ? 'on' : ''}`}
                onClick={() => pickVariant(variant.id)}
            >
                <span>{variant.label}</span>
                <strong>${Number(variant.price).toFixed(2)}</strong>
            </button>
            ))}
        </div>
        </div>
    )}

    {choices.map(choice => (
        <div className="opt-group" key={choice.id}>
        <div className="opt-label">{choice.label}</div>
        <div className="opt-choices">
            {choice.options.map(itemId => (
            <button
                key={itemId}
                type="button"
                className={`opt-btn ${selection.choices[choice.id] === itemId ? 'on' : ''}`}
                onClick={() => pickChoice(choice.id, itemId)}
            >
                <span>{getInventoryName(itemId)}</span>
            </button>
            ))}
        </div>
        </div>
    ))}

    <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => onConfirm(selection)}>
        Agregar · ${resolved.price.toFixed(2)}
        </button>
    </div>
    </section>
</div>
);
}