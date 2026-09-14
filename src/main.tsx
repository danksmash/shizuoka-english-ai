import { StrictMode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { BookOpen, MessageCircle } from 'lucide-react';
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
import './app-switcher.css';

const normalizedPath = window.location.pathname.replace(/\/+$/, '');
const isReflectionTeacherPath = normalizedPath.endsWith('/reflection/teacher');
const isReflectionPath = normalizedPath.endsWith('/reflection');
const RootApp = isReflectionTeacherPath ? ReflectionTeacherApp : isReflectionPath ? ReflectionApp : App;

const deploymentBase = import.meta.env.BASE_URL.replace(/\/+$/, '');
const dialogueHref = `${deploymentBase || ''}/`;
const reflectionHref = `${deploymentBase || ''}/reflection`;

function AppSwitchLink() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isReflectionTeacherPath) {
      setHost(null);
      return;
    }

    const root = document.getElementById('root');
    if (!root) return;

    const resolveHost = () => {
      const nextHost = isReflectionPath
        ? document.querySelector<HTMLElement>('.meg-nav')
        : document.querySelector<HTMLElement>('.setup-v2-learning-id-wrap')
          ?? document.querySelector<HTMLElement>('.setup-v2-header');
      setHost((current) => current === nextHost ? current : nextHost);
    };

    resolveHost();
    const observer = new MutationObserver(resolveHost);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!host || isReflectionTeacherPath) return null;

  const href = isReflectionPath ? dialogueHref : reflectionHref;
  const label = isReflectionPath ? 'AI対話へ' : 'ふりかえりへ';
  const Icon = isReflectionPath ? MessageCircle : BookOpen;

  return createPortal(
    <a
      className={`app-switch-link ${isReflectionPath ? 'app-switch-link-reflection' : 'app-switch-link-dialogue'}`}
      href={href}
      aria-label={label}
    >
      <Icon aria-hidden="true" />
      <span className="app-switch-link-label">{label}</span>
      <span className="app-switch-link-arrow" aria-hidden="true">→</span>
    </a>,
    host,
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
    <AppSwitchLink />
  </StrictMode>,
);
