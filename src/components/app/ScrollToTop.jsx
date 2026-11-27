import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset scroll and move focus to <main> on route change so keyboard and screen-reader users land on new content. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    const main = document.getElementById('main')
    if (main && document.activeElement && document.activeElement !== document.body && !main.contains(document.activeElement)) {
      main.focus({ preventScroll: true })
    }
  }, [pathname])
  return null
}
