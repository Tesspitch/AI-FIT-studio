import { CalendarDays, Dumbbell, House, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/button'

const steps = {
  'open-studio': {
    title: 'เปิดห้องฝึก',
    description: 'กดปุ่มที่ไฮไลต์เพื่อไปยังหน้าเลือกท่า',
    icon: House, group: 1,
  },
  'choose-exercise': {
    title: 'เลือกท่าที่จะฝึก',
    description: 'ลองกดรายการที่ไฮไลต์เพื่อเปิดคลิปและเข้าห้องฝึกของท่านี้',
    icon: Dumbbell, group: 2,
  },
  'start-workout': {
    title: 'เริ่มออกกำลัง',
    description: 'กดปุ่มนี้แล้วอนุญาตใช้กล้อง ระบบจะเริ่มนับเมื่อกล้องและการตรวจจับพร้อม',
    icon: Dumbbell, group: 2,
  },
  'finish-workout': {
    title: 'บันทึกเมื่อฝึกเสร็จ',
    description: 'เมื่อฝึกเสร็จให้กดปุ่มนี้เพื่อหยุดกล้องและบันทึกผลลงประวัติ',
    icon: Dumbbell, group: 2,
  },
  'retry-save': {
    title: 'ลองบันทึกอีกครั้ง',
    description: 'ผลการฝึกยังอยู่ในหน้านี้ กดปุ่มที่ไฮไลต์เพื่อลองบันทึกอีกครั้ง',
    icon: Dumbbell, group: 2,
  },
  'open-result': {
    title: 'เปิดผลที่เพิ่งบันทึก',
    description: 'กดลิงก์นี้เพื่อดูรายละเอียดของการฝึกครั้งล่าสุด',
    icon: CalendarDays, group: 3,
  },
  'choose-history': {
    title: 'เลือกรายการฝึก',
    description: 'กดรายการที่ไฮไลต์เพื่อเปิดรายละเอียดของครั้งนั้น',
    icon: CalendarDays, group: 3,
  },
  'history-empty': {
    title: 'ประวัติการฝึก',
    description: 'เมื่อบันทึกการฝึกครั้งแรก รายการและคะแนนจะปรากฏตรงนี้',
    icon: CalendarDays, group: 3,
  },
  'history-result': {
    title: 'ดูรายละเอียดการฝึก',
    description: 'ตรงนี้แสดงวันที่ จำนวนรอบ คะแนน และผลประเมินของการฝึกครั้งที่เลือก',
    icon: CalendarDays, group: 3,
  },
}

type TipTarget = keyof typeof steps

function readHiddenPreference(key: string, onlyThisTab = false) {
  try {
    return (onlyThisTab ? sessionStorage : localStorage).getItem(key) === '1'
  } catch {
    return false
  }
}

export function useQuickTips(userId: string, pathname: string) {
  const key = `office-reset.quick-tips.v1.${userId}`
  const [hidePermanently, setHidePermanently] = useState(() => readHiddenPreference(key))
  const [status, setStatus] = useState<'pending' | 'open' | 'closed'>(() =>
    hidePermanently || readHiddenPreference(key, true) ? 'closed' : 'pending')
  const visible = status === 'open' || (status === 'pending' && pathname === '/')

  useEffect(() => {
    if (status === 'pending' && pathname === '/') setStatus('open')
  }, [pathname, status])

  function dismiss(remember: boolean, completed = false) {
    const hidden = remember || completed
    setHidePermanently(hidden)
    setStatus('closed')
    try {
      if (hidden) localStorage.setItem(key, '1')
      else localStorage.removeItem(key)
    } catch {
      // The tour can still close when persistent storage is unavailable.
    }
    try {
      sessionStorage.setItem(key, '1')
    } catch {
      // The current view still remembers that the tour was closed.
    }
  }

  return { visible, hidePermanently, open: () => setStatus('open'), dismiss }
}

function positionTip(panel: HTMLElement, target: HTMLElement) {
  const gap = 12
  const rect = target.getBoundingClientRect()
  const nav = document.querySelector<HTMLElement>('.sidebar nav')
  const topbar = document.querySelector('.topbar')
  const top = (topbar?.getBoundingClientRect().bottom ?? 0) + gap
  const bottom = (nav && getComputedStyle(nav).position === 'fixed'
    ? nav.getBoundingClientRect().top : window.innerHeight) - gap
  const width = panel.offsetWidth
  const height = Math.min(panel.scrollHeight + 2, bottom - top)
  const left = Math.max(gap, Math.min(rect.left, window.innerWidth - width - gap))
  const below = bottom - rect.bottom - gap
  const above = rect.top - top - gap
  const sideTop = Math.max(top, Math.min(rect.top, bottom - height))

  if (below >= height) {
    Object.assign(panel.style, { top: `${Math.max(top, rect.bottom + gap)}px`, left: `${left}px`, maxHeight: `${height}px` })
  } else if (above >= height) {
    Object.assign(panel.style, { top: `${Math.min(bottom - height, rect.top - height - gap)}px`, left: `${left}px`, maxHeight: `${height}px` })
  } else if (window.innerWidth - rect.right >= width + 2 * gap) {
    Object.assign(panel.style, { top: `${sideTop}px`, left: `${rect.right + gap}px`, maxHeight: `${height}px` })
  } else if (rect.left >= width + 2 * gap) {
    Object.assign(panel.style, { top: `${sideTop}px`, left: `${rect.left - width - gap}px`, maxHeight: `${height}px` })
  } else {
    const useBelow = below >= above
    Object.assign(panel.style, {
      top: `${useBelow ? Math.max(top, rect.bottom + gap) : top}px`, left: `${left}px`,
      maxHeight: `${Math.min(height, Math.max(below, above))}px`,
    })
  }
}

export function QuickTips({ hidePermanently, onDismiss }: {
  hidePermanently: boolean
  onDismiss: (remember: boolean, completed?: boolean) => void
}) {
  const { key: routeKey } = useLocation()
  const panelRef = useRef<HTMLElement>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [remember, setRemember] = useState(hidePermanently)
  const id = useId()
  const targetName = target?.dataset.quickTipTarget as TipTarget | undefined
  const step = targetName ? steps[targetName] : undefined

  useLayoutEffect(() => {
    const main = document.querySelector('.main-content')
    if (!main) return
    const findTarget = () => setTarget(main.querySelector<HTMLElement>('[data-quick-tip-target]'))
    findTarget()
    const observer = new MutationObserver(findTarget)
    observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-quick-tip-target'] })
    return () => observer.disconnect()
  }, [routeKey])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!target?.isConnected || !panel) return
    const previousDescription = target.getAttribute('aria-describedby')
    const descriptionId = `${id}-description`
    const describedBy = previousDescription ? `${previousDescription} ${descriptionId}` : descriptionId
    target.setAttribute('data-quick-tip-active', '')
    target.setAttribute('aria-describedby', describedBy)
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    target.focus({ preventScroll: true })
    const updatePosition = () => positionTip(panel, target)
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const sizes = new ResizeObserver(updatePosition)
    sizes.observe(target)
    return () => {
      target.removeAttribute('data-quick-tip-active')
      if (target.getAttribute('aria-describedby') === describedBy) {
        if (previousDescription) target.setAttribute('aria-describedby', previousDescription)
        else target.removeAttribute('aria-describedby')
      }
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      sizes.disconnect()
    }
  }, [target, id])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) onDismiss(remember)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [remember, onDismiss])

  if (!step) return null
  const Icon = step.icon
  return <aside ref={panelRef} className="quick-tips-panel" aria-labelledby={`${id}-title`}>
    <div className="quick-tips-top">
      <span className="tile" aria-hidden="true"><Icon size={21} /></span>
      <p>วิธีใช้งาน · ขั้น {step.group} จาก 3</p>
      <Button variant="ghost" className="quick-tips-close" aria-label="ปิดคำแนะนำ" onClick={() => onDismiss(remember)}>
        <X size={20} aria-hidden="true" />
      </Button>
    </div>
    <h2 id={`${id}-title`}>{step.title}</h2>
    <p id={`${id}-description`} className="quick-tips-description">{step.description}</p>
    <label className="quick-tips-preference">
      <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
      ไม่แสดงอีก
    </label>
    {(targetName === 'history-result' || targetName === 'history-empty') && <div className="quick-tips-actions">
      <Button onClick={() => onDismiss(remember, true)}>จบการแนะนำ</Button>
    </div>}
  </aside>
}
