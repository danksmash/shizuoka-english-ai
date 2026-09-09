import express from 'express';
import { createReflectionRouter } from './src/server/reflectionRoutes';

const application = express.application as any;
const originalListen = application.listen;

application.listen = function reflectionAwareListen(this: any, ...args: any[]) {
  if (!this.__reflectionRoutesMounted) {
    this.use('/api/reflection', createReflectionRouter());
    this.__reflectionRoutesMounted = true;
  }
  return originalListen.apply(this, args);
};

await import('./server');
