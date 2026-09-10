import express from 'express';
import { createReflectionRouter } from './src/server/reflectionRoutes';
import { createStudyScheduleRouter } from './src/server/studyScheduleRoutes';

const application = express.application as any;
const originalListen = application.listen;

application.listen = function reflectionAwareListen(this: any, ...args: any[]) {
  if (!this.__reflectionRoutesMounted) {
    this.use('/api/reflection', createReflectionRouter());
    this.__reflectionRoutesMounted = true;
  }
  if (!this.__studyScheduleRoutesMounted) {
    this.use('/api/management', createStudyScheduleRouter());
    this.__studyScheduleRoutesMounted = true;
  }
  return originalListen.apply(this, args);
};

void import('./server');
