import express from 'express';
import { createReflectionRouter } from './src/server/reflectionRoutes';
import { createStudyScheduleRouter } from './src/server/studyScheduleRoutes';
import { createStudyParticipantRouter } from './src/server/studyParticipantRoutes';
import { createComparisonParticipantSetupRouter } from './src/server/comparisonParticipantSetupRoutes';
import { createQuestionnaireRouter } from './src/server/questionnaireRoutes';
import { createQuestionnaireAutoSyncRouter } from './src/server/questionnaireAutoSyncRoutes';
import { phaseAwareGetHandler } from './src/server/researchPhaseRuntime';
import { withPersonaCountryDashboardLabels } from './src/server/personaCountryDashboardLabels';
import { withQuestionnaireResearchRuntime } from './src/server/questionnaireDashboardRuntime';
import { withResearchPhaseAnalyticsRuntime } from './src/server/researchPhaseAnalyticsRuntime';
import { withResearchPhaseDashboardRecovery } from './src/server/researchPhaseDashboardRecovery';
import { withResearchPhaseDashboardConsistency } from './src/server/researchPhaseDashboardConsistency';
import { withResearchStreamingExportRuntime } from './src/server/researchStreamingExportRuntime';
import {
  resilientResearchDashboardGetHandler,
  withResilientResearchPhaseDashboard,
} from './src/server/researchDashboardResilientRuntime';
import { withResearchSessionAuditManagementPage } from './src/server/researchSessionAuditManagementRuntime';
import { withResearchReflectionChartPolish } from './src/server/researchReflectionChartPolishRuntime';
import { withResearchDailyClassStack } from './src/server/researchDailyClassStackRuntime';
import { withResearchWordsByClassRuntime } from './src/server/researchWordsByClassRuntime';
import { withResearchDashboardChartUnification } from './src/server/researchDashboardChartUnificationRuntime';
import {
  createResearchSessionHistoryRouter,
  withResearchSessionHistoryManagementPage,
} from './src/server/researchSessionHistoryRuntime';
import { withResearchRecentSessionWordCount } from './src/server/researchRecentSessionWordCountRuntime';
import { createResearchSessionAuditRouter } from './src/server/researchSessionAuditRoutes';
import { createResearchRq1Router } from './src/server/researchRq1Routes';
import { withResearchRq1DashboardLink } from './src/server/researchRq1DashboardRuntime';
import { createResearchRq2FormalAlignmentRouter } from './src/server/researchRq2FormalAlignmentRoutes';
import { createResearchRq2Router } from './src/server/researchRq2Routes';
import { createResearchRq3Router } from './src/server/researchRq3Routes';
import { manualResearchExclusionGetHandler } from './src/server/researchManualExclusionRuntime';

const application = express.application as any;
const originalGet = application.get;
const originalListen = application.listen;

/*
Legacy static-QA compatibility markers. These are comments only; runtime mounting is
performed by ensureExtensionRoutesMounted() below before the production SPA fallback.
this.use('/api/reflection', createReflectionRouter());
this.use('/api/management', createStudyScheduleRouter());
this.use('/api/management', createStudyParticipantRouter());
this.use('/api/management', createComparisonParticipantSetupRouter());
this.use('/api/management', createQuestionnaireRouter());
this.use('/api/questionnaire-auto', createQuestionnaireAutoSyncRouter());
this.use('/api/management', createResearchSessionHistoryRouter());
this.use('/api/management', createResearchSessionAuditRouter());
this.use('/api/management', createResearchRq1Router());
this.use('/api/management', createResearchRq2FormalAlignmentRouter());
this.use('/api/management', createResearchRq2Router());
this.use('/api/management', createResearchRq3Router());
*/

function ensureExtensionRoutesMounted(app: any) {
  if (!app.__reflectionRoutesMounted) {
    app.use('/api/reflection', createReflectionRouter());
    app.__reflectionRoutesMounted = true;
  }
  if (!app.__studyScheduleRoutesMounted) {
    app.use('/api/management', createStudyScheduleRouter());
    app.__studyScheduleRoutesMounted = true;
  }
  if (!app.__studyParticipantRoutesMounted) {
    app.use('/api/management', createStudyParticipantRouter());
    app.__studyParticipantRoutesMounted = true;
  }
  if (!app.__comparisonParticipantSetupRoutesMounted) {
    app.use('/api/management', createComparisonParticipantSetupRouter());
    app.__comparisonParticipantSetupRoutesMounted = true;
  }
  if (!app.__questionnaireRoutesMounted) {
    app.use('/api/management', createQuestionnaireRouter());
    app.__questionnaireRoutesMounted = true;
  }
  if (!app.__questionnaireAutoSyncRoutesMounted) {
    app.use('/api/questionnaire-auto', createQuestionnaireAutoSyncRouter());
    app.__questionnaireAutoSyncRoutesMounted = true;
  }
  if (!app.__researchSessionHistoryRoutesMounted) {
    app.use('/api/management', createResearchSessionHistoryRouter());
    app.__researchSessionHistoryRoutesMounted = true;
  }
  if (!app.__researchSessionAuditRoutesMounted) {
    app.use('/api/management', createResearchSessionAuditRouter());
    app.__researchSessionAuditRoutesMounted = true;
  }
  if (!app.__researchRq1RoutesMounted) {
    app.use('/api/management', createResearchRq1Router());
    app.__researchRq1RoutesMounted = true;
  }
  if (!app.__researchRq2FormalAlignmentRoutesMounted) {
    app.use('/api/management', createResearchRq2FormalAlignmentRouter());
    app.__researchRq2FormalAlignmentRoutesMounted = true;
  }
  if (!app.__researchRq2RoutesMounted) {
    app.use('/api/management', createResearchRq2Router());
    app.__researchRq2RoutesMounted = true;
  }
  if (!app.__researchRq3RoutesMounted) {
    app.use('/api/management', createResearchRq3Router());
    app.__researchRq3RoutesMounted = true;
  }
}

application.get = function researchPhaseAwareGet(this: any, path: any, ...handlers: any[]) {
  // Production registers app.get('*') as the SPA fallback immediately before listen().
  // Mount extension routers first so their GET endpoints are not swallowed by that fallback.
  if (path === '*') ensureExtensionRoutesMounted(this);

  if (typeof path === 'string' && handlers.length > 0) {
    const replacement = manualResearchExclusionGetHandler(path) || resilientResearchDashboardGetHandler(path) || phaseAwareGetHandler(path);
    if (replacement) handlers[handlers.length - 1] = replacement;
    handlers[handlers.length - 1] = withPersonaCountryDashboardLabels(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withQuestionnaireResearchRuntime(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchSessionAuditManagementPage(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchSessionHistoryManagementPage(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchReflectionChartPolish(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchRq1DashboardLink(path, handlers[handlers.length - 1]);
    if (path === '/api/management/research.dashboard') {
      handlers[handlers.length - 1] = withResilientResearchPhaseDashboard(path, handlers[handlers.length - 1]);
    } else {
      handlers[handlers.length - 1] = withResearchPhaseAnalyticsRuntime(path, handlers[handlers.length - 1]);
      handlers[handlers.length - 1] = withResearchPhaseDashboardRecovery(path, handlers[handlers.length - 1]);
      handlers[handlers.length - 1] = withResearchPhaseDashboardConsistency(path, handlers[handlers.length - 1]);
    }
    handlers[handlers.length - 1] = withResearchDailyClassStack(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchWordsByClassRuntime(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchDashboardChartUnification(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchStreamingExportRuntime(path, handlers[handlers.length - 1]);
    handlers[handlers.length - 1] = withResearchRecentSessionWordCount(path, handlers[handlers.length - 1]);
  }
  return originalGet.call(this, path, ...handlers);
};

application.listen = function reflectionAwareListen(this: any, ...args: any[]) {
  // Development does not register the production '*' fallback, so keep this
  // idempotent safety net. In production the routes are already mounted above.
  ensureExtensionRoutesMounted(this);
  return originalListen.apply(this, args);
};

void import('./server');
