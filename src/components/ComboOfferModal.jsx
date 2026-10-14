import { useMemo, useState } from "react";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getChoiceOptions(choice, catalog) {
  return unique(catalog.flatMap(candidate => [
    ...(candidate.choices || [])
      .filter(candidateChoice => candidateChoice.id === choice.id)
      .flatMap(candidateChoice => candidateChoice.options),
    ...(candidate.comboChoiceOptions?.[choice.id] || []),
  ]));
}

function initialPart(product, existing = {}) {
  return {
    ref: product.id,
    label: existing.label || product.name,
    variantIds: existing.variantIds || product.variants?.map(variant => variant.id) || [],
    choiceOptions: Object.fromEntries((product.choices || []).map(choice => [
      choice.id,
      existing.choiceOptions?.[choice.id] ||
        product.comboChoiceDefaults?.[choice.id] ||
        choice.options,
    ])),
  };
}

function ExistingProductPicker({ catalog, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedProduct = catalog.find(product => product.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredProducts = catalog.filter(product =>
    product.name.toLocaleLowerCase().includes(normalizedQuery) ||
    product.category.toLocaleLowerCase().includes(normalizedQuery)
  );
  const groupedProducts = Object.entries(
    filteredProducts.reduce((groups, product) => {
      (groups[product.category] ||= []).push(product);
      return groups;
    }, {}),
  );
  const listboxId = "combo-offer-product-list";

  function choose(product) {
    onChange(product.id);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      if (filteredProducts.length > 0) {
        setActiveIndex(index => index < 0 ? 0 : Math.min(index + 1, filteredProducts.length - 1));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      if (filteredProducts.length > 0) {
        setActiveIndex(index => index < 0 ? filteredProducts.length - 1 : Math.max(index - 1, 0));
      }
    } else if (event.key === "Enter" && isOpen && filteredProducts[activeIndex]) {
      event.preventDefault();
      choose(filteredProducts[activeIndex]);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setQuery("");
      setActiveIndex(-1);
    }
  }

  let optionIndex = -1;

  return (
    <div
      className="combo-product-picker"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
          setQuery("");
        }
      }}
    >
      <label htmlFor="combo-offer-product-search">Producto existente</label>
      <input
        id="combo-offer-product-search"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && filteredProducts[activeIndex] ? `combo-product-option-${filteredProducts[activeIndex].id}` : undefined}
        value={isOpen ? query : selectedProduct?.name || ""}
        placeholder="Busca un producto..."
        onFocus={() => {
          if (!isOpen) {
            setQuery("");
            setActiveIndex(-1);
          }
          setIsOpen(true);
        }}
        onChange={event => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setIsOpen(true);
          onChange("");
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <div className="combo-product-picker-menu" id={listboxId} role="listbox" aria-label="Productos existentes">
          {groupedProducts.length === 0 ? (
            <p className="combo-product-picker-empty">No hay productos que coincidan.</p>
          ) : groupedProducts.map(([category, products]) => (
            <div className="combo-product-picker-group" role="group" aria-label={category} key={category}>
              <div className="combo-product-picker-category">{category}</div>
              {products.map(product => {
                optionIndex += 1;
                const currentIndex = optionIndex;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={product.id === value}
                    id={`combo-product-option-${product.id}`}
                    className={`combo-product-picker-option ${currentIndex === activeIndex ? "is-active" : ""}`}
                    key={product.id}
                    onMouseDown={event => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(currentIndex)}
                    onClick={() => choose(product)}
                  >
                    {product.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComboOfferModal({ menu, offer, onClose, onSave, onDelete }) {
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
  const [selectedProductId, setSelectedProductId] = useState(catalog[0]?.id || "");
  const [error, setError] = useState("");

  function addPart() {
    const product = productsById[selectedProductId];
    if (!product) return;
    setParts(current => [...current, initialPart(product)]);
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
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
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
              <input value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Cheese Bacon + Junior + 7up" autoFocus />
            </label>
            <label>
              Precio fijo USD
              <input type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="15.00" />
            </label>
          </div>

          <div className="combo-offer-add">
            <ExistingProductPicker
              catalog={catalog}
              value={selectedProductId}
              onChange={setSelectedProductId}
            />
            <button type="button" className="btn-secondary" onClick={addPart} disabled={!selectedProductId}>Agregar producto</button>
          </div>
          <p className="combo-offer-hint">Incluye al menos una bebida y marca todas las variantes y opciones que el cajero podrá elegir al vender la oferta.</p>

          <div className="combo-offer-parts">
            {parts.map((part, index) => {
              const product = productsById[part.ref];
              if (!product) return null;
              return (
                <section className="combo-offer-part" key={`${part.ref}-${index}`}>
                  <div className="combo-offer-part-heading">
                    <strong>{index + 1}. {product.name}</strong>
                    <button type="button" className="product-action" onClick={() => setParts(current => current.filter((_, partIndex) => partIndex !== index))}>
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
                        {getChoiceOptions(choice, catalog).map(option => (
                          <label key={option}>
                            <input
                              type="checkbox"
                              checked={(part.choiceOptions[choice.id] || []).includes(option)}
                              onChange={() => toggleOption(index, choice.id, option)}
                            />
                            {option}
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
