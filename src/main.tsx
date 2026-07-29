import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import { captureUpstream } from './lib/acttub'

// SPA 라우팅이 location.search를 지우기 전에, 들어온 채널을 세션에 붙잡아 둔다.
captureUpstream()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
