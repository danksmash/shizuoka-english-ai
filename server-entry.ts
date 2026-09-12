import express from 'express';
import { createReflectionRouter } from './src/server/reflectionRoutes';
import { createStudyScheduleRouter } from './src/server/studyScheduleRoutes';
import { createQuestionnaireRouter } from './src/server/questionnaireRoutes';
import { createQuestionnaireAutoSyncRouter } from './src/server/questionnaireAutoSyncRoutes';
import { phaseAwareGetHandler } from './src/server/researchPhaseRuntime';
import { withPersonaCountryDashboardLabels } from './src/server/personaCountryDashboardLabels';
import { withQuestionnaireResearchRuntime } from './src/server/questionnaireDashboardRuntime';

const application = express.application as any;
const originalGet = application.get;
const originalListen = application.listen;

application.get = function researchPhaseAwareGet(this: any, path: any, ...handlers: any[]) {
  if (typeof path === 'string' && handlers.length > 0) {
    const replacement = phaseAwareGetHandler(path);
    if (replacement) handlers[handlers.length - 1] = replacement;
    handlers[handlers.length - 1] = withPersonaCountryDashboardLabels(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withQuestionnaireResearchRuntime(path, handlers[handlers.length - 1]);
  }
  return originalGet.call(this, path, ...handlers);
};

application.listen = function reflectionAwareListen(this: any, ...args: any[]) {
  if (!this.__reflectionRoutesMounted) {
    this.use('/api/reflection', createReflectionRouter());
    this.__reflectionRoutesMounted = true;
  }
  if (!this.__studyScheduleRoutesMounted) {
    this.use('/api/management', createStudyScheduleRouter());
    this.__studyScheduleRoutesMounted = true;
  }
  if (!this.__questionnaireRoutesMounted) {
    this.use('/api/management', createQuestionnaireRouter());
    this.__questionnaireRoutesMounted = true;
  }
  if (!this.__questionnaireAutoSyncRoutesMounted) {
    this.use('/api/questionnaire-auto', createQuestionnaireAutoSyncRouter());
    this.__questionnaireAutoSyncRoutesMounted = true;
  }
  return originalListen.apply(this, args);
};

void import('./server');