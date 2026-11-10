import { useEffect, useRef } from 'react';
import styles from './AdminConfirmationDialog.module.css';

export default function AdminConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open || !dialogRef.current) return undefined;
    const dialog = dialogRef.current;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    cancelButtonRef.current?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    };
  }, [open]);

  if (!open) return null;

  function cancel() {
    if (!busy) onCancel();
  }

  return (
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="admin-confirmation-title"
      aria-describedby="admin-confirmation-message"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div className={styles.content}>
        <h2 id="admin-confirmation-title">{title}</h2>
        <p id="admin-confirmation-message">{message}</p>
        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            className={styles.cancel}
            type="button"
            disabled={busy}
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            className={styles.confirm}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
