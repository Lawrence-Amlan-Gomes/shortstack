// This is the main.tsx file. What this file does is the very first thing that runs in the
// browser: it finds the empty <div id="root"> in the HTML page and tells React to render
// the App component into it. This is the entry point Vite starts from.

import { StrictMode } from 'react' // Bring in React's 'StrictMode', a wrapper that helps catch mistakes during development
import { createRoot } from 'react-dom/client' // Bring in the tool that connects React to a real spot in the HTML page
import './index.css' // Load the app's styling so it applies to everything rendered
import App from './App.tsx' // Bring in our main App component

createRoot(document.getElementById('root')!).render( // Find the <div id="root"> in index.html and start rendering React into it
  <StrictMode> {/* Wrap the app in StrictMode, which helps surface bugs during development (no effect in production) */}
    <App /> {/* Render our actual application */}
  </StrictMode>,
) // End of the render call
