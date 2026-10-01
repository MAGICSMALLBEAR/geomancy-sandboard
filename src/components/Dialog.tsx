import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal dialog: focus is trapped while open and returns to the trigger on close. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title"
      onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
      {open && <>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </>}
    </dialog>
  );
}
