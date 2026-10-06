import * as React from 'react'
import { createPortal } from 'react-dom'

type TestBlockProps = {
  id?: string | null
  caption: string
  folded?: boolean
  children?: React.ReactNode
}

const addressedTo = (id: string | null | undefined): boolean => {
  if (!id || typeof window === 'undefined') return false
  try {
    return decodeURIComponent(window.location.hash.slice(1)) === id
  } catch {
    return window.location.hash.slice(1) === id
  }
}

// A test the address points at is shown whole, with every folded section above it.
const reveal = (details: HTMLDetailsElement): void => {
  details.open = true
  let outer = details.parentElement?.closest('details')
  while (outer) {
    outer.open = true
    outer = outer.parentElement?.closest('details')
  }
  details.querySelector('summary')?.scrollIntoView({ block: 'start' })
}

/*
=begin pod :kind<export>

=head2 revealTest

Opens the test with that C<:id> on the page, with every folded section above it,
and brings its line into view; false when no test on the page has that id. A
link to the address the page is already at changes nothing a test can hear, so a
site calls this on such a click.

=end pod
*/
export const revealTest = (id: string): boolean => {
  if (typeof document === 'undefined') return false
  const element = document.getElementById(id)
  if (!(element instanceof HTMLDetailsElement) || !element.classList.contains('test')) return false
  reveal(element)
  return true
}

type CardPlace = { top: number; left: number }

export const TestBlock = ({ id, caption, folded, children }: TestBlockProps) => {
  const details = React.useRef<HTMLDetailsElement>(null)
  const [card, setCard] = React.useState<CardPlace | null>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // The server and the first render in the browser agree: open, unless the author
  // folded the test. Folding for the reader happens after that, once.
  React.useEffect(() => {
    const element = details.current
    if (!element) return
    if (addressedTo(id)) reveal(element)
    else if (folded !== false) element.open = false
    const onAddress = () => {
      if (addressedTo(id)) reveal(element)
    }
    window.addEventListener('hashchange', onAddress)
    return () => window.removeEventListener('hashchange', onAddress)
  }, [id, folded])

  React.useEffect(() => () => clearTimeout(hideTimer.current), [])

  const showCard = (event: React.SyntheticEvent<HTMLElement>) => {
    if (details.current?.open) return
    clearTimeout(hideTimer.current)
    const box = event.currentTarget.getBoundingClientRect()
    setCard({ top: window.scrollY + box.bottom + 6, left: Math.max(8, window.scrollX + box.left) })
  }
  const hideCard = () => {
    hideTimer.current = setTimeout(() => setCard(null), 150)
  }

  return (
    <>
      <details
        className="test"
        id={id || undefined}
        open={folded === true ? undefined : true}
        ref={details}
        onToggle={() => setCard(null)}
      >
        <summary
          className="test-summary"
          onMouseEnter={showCard}
          onFocus={showCard}
          onMouseLeave={hideCard}
          onBlur={hideCard}
        >
          <span className="test-label">test</span> <span className="test-caption">{caption}</span>
        </summary>
        <div className="test-body">{children}</div>
      </details>
      {card &&
        createPortal(
          <div
            className="test-card"
            role="tooltip"
            style={{ top: card.top, left: card.left }}
            onMouseEnter={() => clearTimeout(hideTimer.current)}
            onMouseLeave={hideCard}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
