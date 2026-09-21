import express from 'express';
import { createReflectionRouter } from './src/server/reflectionRoutes';
import { createStudyScheduleRouter } from './src/server/studyScheduleRoutes';
import { createStudyParticipantRouter } from './src/server/studyParticipantRoutes';
import { createQuestionnaireRouter } from './src/server/questionnaireRoutes';
import { createQuestionnaireAutoSyncRouter } from './src/server/questionnaireAutoSyncRoutes';
import { phaseAwareGetHandler } from './src/server/researchPhaseRuntime';
import { withPersonaCountryDashboardLabels } from './src/server/personaCountryDashboardLabels';
import { withQuestionnaireResearchRuntime } from './src/server/questionnaireDashboardRuntime';
import { withResearchPhaseAnalyticsRuntime } from './src/server/researchPhaseAnalyticsRuntime';
import { withResearchPhaseDashboardRecovery } from './src/server/researchPhaseDashboardRecovery';
import { withResearchPhaseDashboardConsistency } from './src/server/researchPhaseDashboardConsistency';
import {
  resilientResearchDashboardGetHandler,
  withResilientResearchPhaseDashboard,
} from './src/server/researchDashboardResilientRuntime';
import { withResearchSessionAuditManagementPage } from './src/server/researchSessionAuditManagementRuntime';
import { withResearchReflectionChartPolish } from './src/server/researchReflectionChartPolishRuntime';
import {
  createResearchSessionHistoryRouter,
  withResearchSessionHistoryManagementPage,
} from './src/server/researchSessionHistoryRuntime';
import { createResearchSessionAuditRouter } from './src/server/researchSessionAuditRoutes';
import { createResearchRq2Router } from './src/server/researchRq2Routes';
import { manualResearchExclusionGetHandler } from './src/server/researchManualExclusionRuntime';

const application = express.application as any;
const originalGet = application.get;
const originalListen = application.listen;

application.get = function researchPhaseAwareGet(this: any, path: any, ...handlers: any[]) {
  if (typeof path === 'string' && handlers.length > 0) {
    const replacement = manualResearchExclusionGetHandler(path) || resilientResearchDashboardGetHandler(path) || phaseAwareGetHandler(path);
    if (replacement) handlers[handlers.length - 1] = replacement;
    handlers[handlers.length - 1] = withPersonaCountryDashboardLabels(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withQuestionnaireResearchRuntime(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchSessionAuditManagementPage(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchSessionHistoryManagementPage(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchReflectionChartPolish(path, handlers[handlers.length - 1]);
    if (path === '/api/management/research.dashboard') {
      handlers[handlers.length - 1] = withResilientResearchPhaseDashboard(path, handlers[handlers.length - 1]);
    } else {
      handlers[handlers.length - 1] = withResearchPhaseAnalyticsRuntime(path, handlers[handlers.length - 1]);
      handlers[handlers.length - 1] = withResearchPhaseDashboardRecovery(path, handlers[handlers.length - 1]);
      handlers[handlers.length - 1] = withResearchPhaseDashboardConsistency(path, handlers[handlers.length - 1]);
    }
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
  if (!this.__studyParticipantRoutesMounted) {
    this.use('/api/management', createStudyParticipantRouter());
    this.__studyParticipantRoutesMounted = true;
  }
  if (!this.__questionnaireRoutesMounted) {
    this.use('/api/management', createQuestionnaireRouter());
    this.__questionnaireRoutesMounted = true;
  }
  if (!this.__questionnaireAutoSyncRoutesMounted) {
    this.use('/api/questionnaire-auto', createQuestionnaireAutoSyncRouter());
    this.__questionnaireAutoSyncRoutesMounted = true;
  }
  if (!this.__researchSessionHistoryRoutesMounted) {
    this.use('/api/management', createResearchSessionHistoryRouter());
    this.__researchSessionHistoryRoutesMounted = true;
  }
  if (!this.__researchSessionAuditRoutesMounted) {
    this.use('/api/management', createResearchSessionAuditRouter());
    this.__researchSessionAuditRoutesMounted = true;
  }
  if (!this.__researchRq2RoutesMounted) {
    this.use('/api/management', createResearchRq2Router());
    this.__researchRq2RoutesMounted = true;
  }
  return originalListen.apply(this, args);
};

void import('./server');
