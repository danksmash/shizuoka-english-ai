import React from 'react';
import type { DialogueTopic } from '../types';
import { getTopicLearningGoals } from '../data/topicLearningGoals';

interface TodayGoalsProps {
  topic: DialogueTopic;
}

export const TodayGoals: React.FC<TodayGoalsProps> = ({ topic }) => {
  const goals = getTopicLearningGoals(topic);

  return (
    <div className="bg-emerald-50/80 p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex-1 overflow-y-auto">
      <h3 className="text-sm font-bold text-emerald-900 mb-3">🌟 Great Job! (今日のめあて)</h3>
      <div className="space-y-2.5 text-xs font-semibold text-slate-800">
        {goals.map((goal) => (
          <div key={`${topic}-${goal.label}`} className="bg-white p-3 rounded-2xl border border-emerald-200/70">
            <div className="font-bold text-slate-900">{goal.label}</div>
            <div className="mt-1 text-[11px] font-bold text-blue-700">{goal.examples}</div>
            <div className="mt-1 text-[9px] font-semibold text-slate-400">{goal.sourceHint}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
