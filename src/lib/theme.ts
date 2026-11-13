export type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'rateit-theme'
/** Read the pre-rename key too, so nobody loses their choice. */
const LEGACY_KEY = 'simple-theme'

export function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'dark'
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY)
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'dark'
  } catch {
    return 'dark'
  }
}

/** Resolve a choice to the theme actually painted. */
export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(resolved: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', resolved)
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice)
    window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* private modes can refuse storage; the choice just won't persist */
  }
}

/**
 * Runs before first paint, inline in <head>, so there is no flash of the wrong
 * theme. Defaults to dark — this interface is designed dark-first.
 */
export const THEME_SCRIPT = `(function(){try{
var s=localStorage.getItem('rateit-theme')||localStorage.getItem('simple-theme');
var t=(s==='light'||s==='dark')?s:(s==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):'dark');
document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`
