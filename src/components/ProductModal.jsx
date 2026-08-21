import { useEffect, useState } from "react";

const EMPTY_FORM = {
  name: "",
  category: "",
  price: "",
  ingredients: "",
  desc: "",
};

/**
 * Un ingrediente es un nombre, no un número: "4" o "55" no son insumos.
 * Se exige al menos una letra para que no entren valores basura al panel
 * de cocina.
 */
function isValidIngredient(value) {
  return /[a-záéíóúüñ]/i.test(value);
}

function productToForm(product, category) {
  if (!product) {
    return { ...EMPTY_FORM, category };
  }

  return {
    name: product.name,
    category,
    price: String(product.price),
    ingredients: Array.isArray(product.ingredients) ? product.ingredients.join(", ") : "",
    desc: product.desc ?? "",
  };
}

export default function ProductModal({ categories, activeCategory, product, onClose, onSave }) {
  const [form, setForm] = useState(() => productToForm(product, activeCategory));
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(productToForm(product, activeCategory));
    setError("");
  }, [product, activeCategory]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const price = Number(form.price);
    const ingredients = [...new Set(
      form.ingredients
        .split(",")
        .map(value => value.trim())
        .filter(Boolean),
    )];

    if (!name) {
      setError("Escribe el nombre del producto.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("El precio debe ser un número válido.");
      return;
    }
    if (!form.category) {
      setError("Selecciona una categoría.");
      return;
    }

    const invalidIngredients = ingredients.filter(value => !isValidIngredient(value));
    if (invalidIngredients.length > 0) {
      const listado = invalidIngredients.map(value => `"${value}"`).join(", ");
      setError(
        invalidIngredients.length === 1
          ? `${listado} no es un ingrediente válido. Escribe el nombre del insumo, no un número.`
          : `${listado} no son ingredientes válidos. Escribe el nombre de cada insumo, no números.`
      );
      return;
    }

    onSave({
      id: product?.id,
      name,
      category: form.category,
      price: Number(price.toFixed(2)),
      ingredients,
      desc: form.desc.trim() || ingredients.join(", "),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <div className="modal-heading">
          <div>
            <span className="modal-kicker">Catálogo</span>
            <h2 id="product-modal-title">{product ? "Editar producto" : "Nuevo producto"}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ventana">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-fields">
            <label>
              Nombre del producto
              <input name="name" value={form.name} onChange={updateField} placeholder="Ej. Perro especial" autoFocus />
            </label>
            <label>
              Categoría
              <select name="category" value={form.category} onChange={updateField}>
                {categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Precio USD
              <input name="price" type="number" min="0" step="0.01" value={form.price} onChange={updateField} placeholder="0.00" />
            </label>
            <label className="modal-field-wide">
              Ingredientes
              <input name="ingredients" value={form.ingredients} onChange={updateField} placeholder="carne, queso, tocineta" />
              <small>Sepáralos con comas para agregarlos al panel de cocina.</small>
            </label>
            <label className="modal-field-wide">
              Descripción
              <textarea name="desc" value={form.desc} onChange={updateField} rows="3" placeholder="Describe el producto para la tarjeta del menú" />
            </label>
          </div>

          {error && <div className="modal-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">Guardar producto</button>
          </div>
        </form>
      </section>
    </div>
  );
}