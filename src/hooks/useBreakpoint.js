import { useState, useEffect } from 'react'

/**
 * useBreakpoint — Returns the current responsive breakpoint.
 *
 * PHONE   : width < 768px
 * TABLET  : 768px ≤ width < 1024px
 * DESKTOP : width ≥ 1024px
 */

export function useBreakpoint() {
  const getBreakpoint = () => {
    const w = window.innerWidth
    if (w < 768) return 'phone'
    if (w < 1024) return 'tablet'
    return 'desktop'
  }

  const [bp, setBp] = useState(getBreakpoint)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const mqlT = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')

    const update = () => setBp(getBreakpoint())
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  return bp
}

/** useIsMobile — true when width < 768px */
export function useIsMobile() {
  return useBreakpoint() === 'phone'
}

/** useIsTablet — true when 768 ≤ width < 1024 */
export function useIsTablet() {
  return useBreakpoint() === 'tablet'
}

/** useIsMobileOrTablet — true when width < 1024px */
export function useIsMobileOrTablet() {
  const bp = useBreakpoint()
  return bp === 'phone' || bp === 'tablet'
}


