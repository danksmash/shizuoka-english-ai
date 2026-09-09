import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ReflectionApp from './reflection/ReflectionApp';
import ReflectionTeacherApp from './reflection/ReflectionTeacherApp';
import './index.css';
import './setup-avatar-adjust.css';
import './setup-screen-v2.css';
import './setup-screen-v2-polish.css';
import './dialogue-viewport.css';
import './reflection/reflection.css';
import './reflection/reflection-b.css';

const normalizedPath = window.location.pathname.replace(/\/+$/, '');
const isReflectionTeacherPath = normalizedPath.endsWith('/reflection/teacher');
const isReflectionPath = normalizedPath.endsWith('/reflection');
const RootApp = isReflectionTeacherPath ? ReflectionTeacherApp : isReflectionPath ? ReflectionApp : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
