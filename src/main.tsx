import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0f0f12] flex items-center justify-center font-mono text-zinc-500">
            Loading 3D engine...
          </div>
        }
      >
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
