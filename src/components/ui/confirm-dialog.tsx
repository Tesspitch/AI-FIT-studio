import { useId, useLayoutEffect, useRef } from 'react'
import { Button } from './button'

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  pendingLabel: string
  pending: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ title, description, confirmLabel, pendingLabel, pending, error,
  onCancel, onConfirm }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement
    dialog.showModal()
    cancelRef.current?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  return <dialog ref={dialogRef} className="confirm-dialog" role="alertdialog"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={(event) => {
      event.preventDefault()
      if (!pending) onCancel()
    }}>
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-description`}>{description}</p>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions">
      <Button ref={cancelRef} variant="outline" disabled={pending} onClick={onCancel}>ยกเลิก</Button>
      <Button disabled={pending} aria-busy={pending} onClick={onConfirm}>{pending ? pendingLabel : confirmLabel}</Button>
    </div>
  </dialog>
}
