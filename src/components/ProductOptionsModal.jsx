import { useEffect, useState } from 'react';
import { getInventoryName, getInventoryNote } from '../data/inventory';
import {
askableChoices,
describeFixedSelection,
getComboPartProduct,
getDefaultSelection,
hasVariants,
resolveSelection,
} from '../utils/lineOptions';

function SelectionFields({ product, selection, onChange, showVariantPrice = true }) {
const choices = askableChoices(product);
const resolved = resolveSelection(product, selection);

function pickVariant(variantId) {
onChange({ ...selection, variantId });
}

function pickChoice(choiceId, itemId) {
onChange({ ...selection, choices: { ...selection.choices, [choiceId]: itemId } });
}

return (
    <>
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
                {showVariantPrice && <strong>${Number(variant.price).toFixed(2)}</strong>}
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
                <span>
                    {getInventoryName(itemId)}
                    {getInventoryNote(itemId) && <small className="opt-choice-note">{getInventoryNote(itemId)}</small>}
                </span>
            </button>
            ))}
        </div>
        </div>
    ))}
    </>
);
}

export default function ProductOptionsModal({ product, productsById = {}, onConfirm, onClose }) {
const [selection, setSelection] = useState(() => product.isCombo
    ? product.parts.map(part => {
        const partProduct = getComboPartProduct(productsById[part.ref], part);
        return getDefaultSelection(partProduct);
    })
    : getDefaultSelection(product));

useEffect(() => {
setSelection(product.isCombo
    ? product.parts.map(part => getDefaultSelection(getComboPartProduct(productsById[part.ref], part)))
    : getDefaultSelection(product));
}, [product, productsById]);

useEffect(() => {
function handleKey(event) {
    if (event.key === 'Escape') onClose();
}
window.addEventListener('keydown', handleKey);
return () => window.removeEventListener('keydown', handleKey);
}, [onClose]);

const resolved = product.isCombo
    ? null
    : resolveSelection(product, selection);

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

    {product.isCombo ? product.parts.map((part, index) => {
        const partProduct = getComboPartProduct(productsById[part.ref], part);
        if (!partProduct) return null;
        // Lo que esa parte ya trae fijo: si no se muestra, el cajero ve un
        // título suelto sin nada debajo y no sabe qué lleva la hamburguesa.
        const fixed = describeFixedSelection(partProduct, selection[index]);
        return (
            <section className="combo-option-part" key={`${part.ref}-${index}`}>
                <h3>{part.label || partProduct.name}</h3>
                {fixed.length > 0 && <p className="combo-part-fixed">{fixed.join(' · ')}</p>}
                <SelectionFields
                    product={partProduct}
                    selection={selection[index]}
                    onChange={next => setSelection(current => current.map((value, partIndex) => partIndex === index ? next : value))}
                    showVariantPrice={false}
                />
            </section>
        );
    }) : (
        <SelectionFields product={product} selection={selection} onChange={setSelection} />
    )}

    <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => onConfirm(selection)}>
        Agregar · ${Number(product.isCombo ? product.price : resolved.price).toFixed(2)}
        </button>
    </div>
    </section>
</div>
);
}
