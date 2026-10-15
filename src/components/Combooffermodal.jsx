import { useEffect, useMemo, useRef, useState } from "react";
import { getInventoryName } from "../data/inventory";

function unique(values) {
return [...new Set(values.filter(Boolean))];
}

/**
 * Opciones que una oferta puede permitir para una elección de un producto:
 * las del propio producto más las que el menú reserva para ofertas
 * (`comboChoiceOptions`, ej. el pan de promo). Solo las de ESE producto:
 * antes se mezclaban las de todos los productos y, por ejemplo, un refresco
 * de 1 Lt podía ofrecer las marcas de los demás refrescos.
 */
function getChoiceOptions(product, choice) {
return unique([...(choice.options || []), ...(product.comboChoiceOptions?.[choice.id] || [])]);
}

function initialPart(product, existing = {}) {
return {
ref: product.id,
label: existing.label || product.name,
variantIds: existing.variantIds || product.variants?.map(variant => variant.id) || [],
choiceOptions: Object.fromEntries((product.choices || []).map(choice => {
    const allowed = getChoiceOptions(product, choice);
    // Si la oferta guardada trae opciones que el producto ya no tiene, se descartan.
    const saved = (existing.choiceOptions?.[choice.id] || []).filter(option => allowed.includes(option));
    const defaults = product.comboChoiceDefaults?.[choice.id] || choice.options;
    return [choice.id, saved.length > 0 ? saved : defaults];
})),
};
}

/** Lo que cuenta como "cambios sin guardar": nombre, precio y partes. */
function snapshot(name, price, parts) {
return JSON.stringify([name.trim(), String(price).trim(), parts]);
}

const PRODUCT_CATEGORIES = [
{ label: "Hamburguesas", category: "Hamburguesas" },
{ label: "Perros", category: "Perros calientes" },
{ label: "Refrescos", category: "Bebidas" },
];

export default function ComboOfferModal({ menu, offer, onClose, onSave, onDelete }) {
// Todos los productos que una oferta puede usar. Incluye los ocultos del menú
// (ej. "Hamburguesa de promo", que no se vende sola): si no estuvieran aquí,
// al editar una oferta que los usa sus partes desaparecerían.
const catalog = useMemo(
() => Object.entries(menu).flatMap(([category, products]) =>
    products.filter(product => !product.isCombo).map(product => ({ ...product, category }))
),
[menu],
);
const productsById = useMemo(() => Object.fromEntries(catalog.map(product => [product.id, product])), [catalog]);

const [name, setName] = useState(offer?.name || "");
const [price, setPrice] = useState(offer ? String(offer.price) : "");
const [parts, setParts] = useState(() => (offer?.parts || []).map(part => {
const product = productsById[part.ref];
return product ? initialPart(product, part) : null;
}).filter(Boolean));
const [activeProductCategory, setActiveProductCategory] = useState("Hamburguesas");
const [error, setError] = useState("");

// Partes de la oferta guardada cuyo producto ya no existe: se avisa en vez de perderlas en silencio.
const missingParts = (offer?.parts || []).filter(part => !productsById[part.ref]);

const initialSnapshot = useRef(snapshot(name, price, parts));
const isDirty = snapshot(name, price, parts) !== initialSnapshot.current;

useEffect(() => {
function handleKey(event) {
    if (event.key === "Escape") onClose();
}
window.addEventListener("keydown", handleKey);
return () => window.removeEventListener("keydown", handleKey);
}, [onClose]);

const visibleProducts = catalog.filter(product => product.category === activeProductCategory);

function addPart(product) {
if (!product) return;
setParts(current => {
    // Dos veces el mismo producto (ej. dos hamburguesas): "La Clásica", "La Clásica 2",
    // para que la cocina los distinga en el comprobante.
    const repeated = current.filter(part => part.ref === product.id).length;
    const part = initialPart(product);
    return [...current, repeated > 0 ? { ...part, label: `${product.name} ${repeated + 1}` } : part];
});
setError("");
}

function updatePart(index, update) {
setParts(current => current.map((part, partIndex) => partIndex === index ? { ...part, ...update } : part));
}

function toggleOption(index, choiceId, option) {
setParts(current => current.map((part, partIndex) => {
    if (partIndex !== index) return part;
    const selected = part.choiceOptions[choiceId] || [];
    const next = selected.includes(option)
    ? selected.filter(value => value !== option)
    : [...selected, option];
    return { ...part, choiceOptions: { ...part.choiceOptions, [choiceId]: next } };
}));
setError("");
}

function toggleVariant(index, variantId) {
setParts(current => current.map((part, partIndex) => {
    if (partIndex !== index) return part;
    const selected = part.variantIds || [];
    const next = selected.includes(variantId)
    ? selected.filter(value => value !== variantId)
    : [...selected, variantId];
    return { ...part, variantIds: next };
}));
setError("");
}

function handleSubmit(event) {
event.preventDefault();
const trimmedName = name.trim();
const numericPrice = Number(price);
if (!trimmedName) return setError("Escribe el nombre de la oferta.");
if (!Number.isFinite(numericPrice) || numericPrice <= 0) return setError("El precio de la oferta debe ser mayor que cero.");
if (parts.length < 2) return setError("Agrega al menos dos productos a la oferta.");
if (!parts.some(part => productsById[part.ref]?.category === "Bebidas")) {
    return setError("Agrega al menos una bebida a la oferta.");
}
for (const part of parts) {
    const product = productsById[part.ref];
    if (!product) return setError("Uno de los productos seleccionados ya no está disponible.");
    if (product.variants?.length && !part.variantIds?.length) return setError(`Selecciona al menos una variante de ${product.name}.`);
    const emptyChoice = (product.choices || []).find(choice => !(part.choiceOptions?.[choice.id] || []).length);
    if (emptyChoice) return setError(`Selecciona al menos una opción de ${emptyChoice.label} para ${product.name}.`);
}
onSave({
    id: offer?.id,
    name: trimmedName,
    category: "Ofertas",
    price: Number(numericPrice.toFixed(2)),
    isCombo: true,
    parts: parts.map(part => ({
    ref: part.ref,
    label: part.label.trim() || productsById[part.ref].name,
    ...(part.variantIds?.length ? { variantIds: part.variantIds } : {}),
    choiceOptions: part.choiceOptions,
    })),
});
}

return (
<div
    className="modal-backdrop"
    role="presentation"
    // Con cambios sin guardar, un clic suelto fuera de la ventana no la cierra.
    onMouseDown={event => event.target === event.currentTarget && !isDirty && onClose()}
>
    <section className="product-modal combo-offer-modal" role="dialog" aria-modal="true" aria-labelledby="combo-offer-title">
    <div className="modal-heading">
        <div>
        <span className="modal-kicker">Oferta compuesta</span>
        <h2 id="combo-offer-title">{offer ? "Editar oferta" : "Crear oferta"}</h2>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ventana">×</button>
    </div>

    <form onSubmit={handleSubmit}>
        <div className="modal-fields">
        <label>
            Nombre de la oferta
            <input value={name} onChange={event => { setName(event.target.value); setError(""); }} placeholder="Ej. Cheese Bacon + Junior + 7up" autoFocus />
        </label>
        <label>
            Precio fijo USD
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={price} onChange={event => { setPrice(event.target.value); setError(""); }} placeholder="15.00" />
        </label>
        </div>

        {missingParts.length > 0 && (
        <div className="modal-error" role="status">
            {missingParts.length === 1
            ? `Un producto de esta oferta ya no existe en el menú (${missingParts[0].label || missingParts[0].ref}) y se quitó.`
            : `${missingParts.length} productos de esta oferta ya no existen en el menú y se quitaron.`}
            {" "}Agrega los que correspondan y guarda.
        </div>
        )}

        <div className="combo-offer-add">
        <div className="combo-product-picker">
            <span className="combo-product-picker-label">Agregar productos existentes</span>
            <div className="combo-product-categories" role="group" aria-label="Categorías de productos">
            {PRODUCT_CATEGORIES.map(({ label, category }) => (
                <button
                key={category}
                type="button"
                className={`combo-product-category-button ${activeProductCategory === category ? "active" : ""}`}
                aria-pressed={activeProductCategory === category}
                onClick={() => setActiveProductCategory(category)}
                >
                {label}
                </button>
            ))}
            </div>
            <div className="combo-product-options" aria-label={`${PRODUCT_CATEGORIES.find(item => item.category === activeProductCategory)?.label || "Productos"} disponibles`}>
            {visibleProducts.length === 0 ? (
                <p className="combo-product-picker-empty">No hay productos disponibles en esta categoría.</p>
            ) : visibleProducts.map(product => (
                <button
                key={product.id}
                type="button"
                className="combo-product-option-button"
                onClick={() => addPart(product)}
                >
                <span>
                    {product.name}
                    {product.hidden && <small className="combo-product-option-note">Solo para ofertas</small>}
                </span>
                <span className="combo-product-option-add" aria-hidden="true">+</span>
                </button>
            ))}
            </div>
        </div>
        </div>
        <p className="combo-offer-hint">Toca un producto para sumarlo a la oferta. Incluye al menos una bebida y marca las opciones que el cajero podrá elegir al venderla.</p>

        <div className="combo-offer-parts">
        {parts.map((part, index) => {
            const product = productsById[part.ref];
            if (!product) return null;
            return (
            <section className="combo-offer-part" key={`${part.ref}-${index}`}>
                <div className="combo-offer-part-heading">
                <strong>{index + 1}. {product.name}</strong>
                <button
                    type="button"
                    className="product-action"
                    onClick={() => setParts(current => current.filter((_, partIndex) => partIndex !== index))}
                    aria-label={`Quitar ${product.name} de la oferta`}
                >
                    Quitar
                </button>
                </div>
                <label className="combo-offer-label">
                Nombre en cocina
                <input value={part.label} onChange={event => updatePart(index, { label: event.target.value })} />
                </label>
                {product.variants?.length > 0 && (
                <fieldset className="combo-offer-choice">
                    <legend>Variantes permitidas</legend>
                    <div className="combo-offer-checks">
                    {product.variants.map(variant => (
                        <label key={variant.id}>
                        <input type="checkbox" checked={part.variantIds.includes(variant.id)} onChange={() => toggleVariant(index, variant.id)} />
                        {variant.label}
                        </label>
                    ))}
                    </div>
                </fieldset>
                )}
                {(product.choices || []).map(choice => (
                <fieldset className="combo-offer-choice" key={choice.id}>
                    <legend>{choice.label} permitidos</legend>
                    <div className="combo-offer-checks">
                    {getChoiceOptions(product, choice).map(option => (
                        <label key={option}>
                        <input
                            type="checkbox"
                            checked={(part.choiceOptions[choice.id] || []).includes(option)}
                            onChange={() => toggleOption(index, choice.id, option)}
                        />
                        {/* Los insumos se guardan con un id ("pan-batata"); se muestra su nombre. */}
                        {getInventoryName(option)}
                        </label>
                    ))}
                    </div>
                </fieldset>
                ))}
            </section>
            );
        })}
        </div>

        {error && <div className="modal-error" role="alert">{error}</div>}
        <div className="modal-actions">
        {offer?.isCustom && <button type="button" className="modal-delete-product" onClick={() => onDelete(offer)}>Eliminar oferta</button>}
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary">Guardar oferta</button>
        </div>
    </form>
    </section>
</div>
);
}