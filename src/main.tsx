import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ReflectionApp from './reflection/ReflectionApp';
import './index.css';
import './setup-avatar-adjust.css';
import './setup-screen-v2.css';
import './setup-screen-v2-polish.css';
import './dialogue-viewport.css';
import './reflection/reflection.css';

const normalizedPath = window.location.pathname.replace(/\/+$/, '');
const isReflectionPath = normalizedPath.endsWith('/reflection');
const RootApp = isReflectionPath ? ReflectionApp : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
