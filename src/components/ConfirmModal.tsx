import { useEffect } from 'react'
import { Trash2, RefreshCw } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = 'Confirm Delete',
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onCancel()
      }}
    >
      <div
        className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <Trash2 className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-xs text-text-muted leading-relaxed mb-3">{message}</p>

        {detail && (
          <div className="mb-5 px-3 py-2 rounded-xl bg-background border border-border/80 text-xs font-medium text-white truncate">
            {detail}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-card-hover text-text-muted hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
