import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './setup-avatar-adjust.css';
import './setup-screen-v2.css';
import './setup-screen-v2-polish.css';
import './dialogue-viewport.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
