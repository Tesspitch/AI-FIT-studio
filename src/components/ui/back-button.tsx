import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from './button'

type BackButtonProps = { label: string } & (
  | { to: string }
  | { onClick: () => void; disabled?: boolean }
)

export function BackButton({ label, ...action }: BackButtonProps) {
  const icon = <ChevronLeft size={22} aria-hidden="true" />
  if ('to' in action) {
    return <Button className="page-back-button" variant="ghost" asChild>
      <Link to={action.to} aria-label={label} title={label}>{icon}</Link>
    </Button>
  }
  return <Button className="page-back-button" variant="ghost" aria-label={label} title={label} {...action}>
    {icon}
  </Button>
}
