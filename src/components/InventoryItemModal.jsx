import { useEffect, useState } from 'react';

const GROUPS = ['Panes', 'Proteínas', 'Bebidas', 'Extras', 'Otros'];

/**
 * Crear o editar un insumo del inventario (modo admin).
 *
 * Usa el mismo esqueleto que ProductModal (.product-modal, .modal-fields,
 * .modal-danger-zone) a propósito: son las clases que products.css ya
 * define. Inventar clases nuevas aquí fue lo que dejó esta ventana sin
 * estilo en producción.
 *
 * Reglas que no se negocian:
 *  - Los insumos de data/inventory.js NO se editan ni se borran desde aquí.
 *    Son los que el menú referencia por id; tocarlos rompe el histórico.
 *  - Un insumo creado por el usuario solo se borra si nunca se movió. Si ya
 *    tiene ventas o conteos no se borra: los registros guardados lo nombran
 *    por id y quedarían mostrando el id crudo en el Excel del histórico.
 *  - El id se genera una vez y nunca cambia, aunque se renombre el insumo.
 */
export default function InventoryItemModal({
  item,
  usedInventoryIds,
  hasHistory = false,
  onSave,
  onDelete,
  onClose,
}) {
  const isNew = !item;
  // Un insumo del código llega sin isCustom: se puede mirar, no editar.
  const isCustom = item?.isCustom === true;
  const isReadOnly = !isNew && !isCustom;

  const [name, setName]         = useState(item?.name ?? '');
  const [group, setGroup]       = useState(item?.group ?? 'Bebidas');
  const [subgroup, setSubgroup] = useState(item?.subgroup ?? '');
  const [note, setNote]         = useState(item?.note ?? '');
  const [error, setError]       = useState('');

  useEffect(() => {
    function handleKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isLinkedToMenu = usedInventoryIds instanceof Set && usedInventoryIds.has(item?.id);

  function handleSubmit(event) {
    event.preventDefault();
    if (isReadOnly) return onClose();

    const trimmedName = name.trim();
    if (!trimmedName) return setError('Escribe el nombre del insumo.');
    if (!group) return setError('Selecciona un grupo.');

    // Slug solo para que el id sea legible al depurar; la unicidad la da el
    // timestamp, no el nombre. Por eso renombrar después no genera otro id.
    const slug = trimmedName
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    onSave({
      id: item?.id ?? `custom-${slug}-${Date.now().toString(36)}`,
      name: trimmedName,
      group,
      subgroup: subgroup.trim() || undefined,
      note: note.trim() || undefined,
      isCustom: true,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      {/* .product-modal trae el esqueleto de products.css; .inv-item-modal
          es solo el gancho para lo propio de esta ventana. */}
      <section className="product-modal inv-item-modal" role="dialog" aria-modal="true" aria-labelledby="inv-modal-title">
        <div className="modal-heading">
          <div>
            <span className="modal-kicker">Inventario</span>
            <h2 id="inv-modal-title">
              {isNew ? 'Nuevo insumo' : isReadOnly ? 'Insumo del sistema' : 'Editar insumo'}
            </h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ventana">×</button>
        </div>

        {isNew && (
          <div className="inv-note">
            Este insumo se va a contar a mano hasta que se asocie a un producto del menú.
          </div>
        )}

        {isReadOnly && (
          <div className="inv-note">
            Viene con el sistema y hay productos del menú que lo usan por su nombre interno.
            Para cambiarlo o quitarlo hay que tocar el código, si no se rompe el historial de ventas.
          </div>
        )}

        {!isNew && isCustom && !isLinkedToMenu && (
          <div className="inv-note">
            No está asociado a ningún producto del menú, así que no baja solo:
            se lleva a mano desde "Sobrante de ayer".
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-fields">
            <label className="modal-field-wide">
              Nombre del insumo
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Ej. Tocineta ahumada"
                maxLength={60}
                disabled={isReadOnly}
                autoFocus={!isReadOnly}
              />
            </label>

            <label>
              Grupo
              <select value={group} onChange={event => setGroup(event.target.value)} disabled={isReadOnly}>
                {GROUPS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>

            <label>
              Presentación
              <input
                value={subgroup}
                onChange={event => setSubgroup(event.target.value)}
                placeholder="Ej. Refresco de lata"
                maxLength={40}
                disabled={isReadOnly}
              />
              <small>Opcional. Agrupa marcas de una misma presentación.</small>
            </label>

            <label className="modal-field-wide">
              Nota de uso
              <input
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="Ej. Solo para Mr. Amarillo"
                maxLength={80}
                disabled={isReadOnly}
              />
              <small>Opcional. Sale bajo el nombre en la tabla del cierre.</small>
            </label>
          </div>

          {error && <div className="modal-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!isReadOnly && (
              <button type="submit" className="btn-primary">
                {isNew ? 'Crear insumo' : 'Guardar cambios'}
              </button>
            )}
          </div>
        </form>

        {/* Borrar solo lo creado por el usuario, y solo si nunca se movió. */}
        {!isNew && isCustom && (
          <div className="modal-danger-zone">
            {hasHistory ? (
              <span className="inv-delete-blocked">
                Ya tiene ventas o conteos registrados. No se puede borrar sin
                romper el historial de esos días; se puede renombrar.
              </span>
            ) : (
              <button type="button" className="modal-delete-product" onClick={() => onDelete(item)}>
                <span className="product-action-icon product-action-icon-delete" aria-hidden="true">✕</span> Eliminar insumo
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}