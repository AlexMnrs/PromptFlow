import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  active?: boolean
  variant?: 'glass' | 'solid' | 'danger'
}

export function IconButton({ icon: Icon, label, active = false, variant = 'glass', className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button icon-button--${variant} ${active ? 'is-active' : ''} ${className}`}
      {...props}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
    </button>
  )
}
