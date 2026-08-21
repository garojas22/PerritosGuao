    import { useEffect } from "react";

    /**
     * Diálogo de confirmación reutilizable, para reemplazar window.confirm().
     * Genérico a propósito: sirve para cualquier acción destructiva futura
     * (cancelar un pedido, borrar un ingrediente, etc.), no solo para productos.
     */
    export default function ConfirmDialog({
    title,
    message,
    confirmLabel = "Eliminar",
    cancelLabel = "Cancelar",
    onConfirm,
    onCancel,
    }) {
    // Escape cierra el diálogo, igual que cualquier modal del sistema.
    useEffect(() => {
        function handleKey(event) {
        if (event.key === "Escape") onCancel();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onCancel]);

    return (
        <div className="confirm-backdrop" onClick={onCancel}>
        <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            onClick={event => event.stopPropagation()}
        >
            <h3>{title}</h3>
            {message && <p>{message}</p>}
            <div className="confirm-actions">
            <button type="button" className="confirm-btn-cancel" onClick={onCancel}>
                {cancelLabel}
            </button>
            <button type="button" className="confirm-btn-danger" onClick={onConfirm}>
                {confirmLabel}
            </button>
            </div>
        </div>
        </div>
    );
    }