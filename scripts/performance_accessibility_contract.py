from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
main=(ROOT/'src'/'main.tsx').read_text(encoding='utf-8')
runtime=(ROOT/'src'/'styles'/'runtime.css').read_text(encoding='utf-8')
session=(ROOT/'src'/'pages'/'AcademySessionGate.tsx').read_text(encoding='utf-8')
a11y=(ROOT/'src'/'components'/'AccessibilityTools.tsx').read_text(encoding='utf-8')

assert "lazy(() => import('./pages/AcademyWorkspacePage')" in main
assert "lazy(() => import('./pages/PublicPortalPage')" in main
assert '<Suspense fallback={<RouteLoading />}' in main
assert "import { AcademyWorkspacePage }" not in main
assert "import { PublicPortalPage }" not in main
assert '<SkipToContent />' in main

assert ':focus-visible' in runtime
assert 'prefers-reduced-motion: reduce' in runtime
assert '.skipToContent' in runtime
assert '.routeLoading' in runtime

assert "../styles/session.css" in session
assert 'aria-live="polite"' in a11y
assert 'Pular para o conteúdo' in a11y
assert "document.querySelector('main')" in a11y

print('Performance and accessibility contract: PASS')
