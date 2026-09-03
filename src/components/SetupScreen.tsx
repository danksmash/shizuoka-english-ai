import React, { useState } from 'react';
import { CheckCircle2, KeyRound, MessageCircle, Play } from 'lucide-react';
import { DialogueTopic, StudentProfile, AIStudentProfile } from '../types';
import { AI_STUDENTS_MASTER_LIST, DIALOGUE_TOPICS, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import { stopSpeaking } from '../utils/speech';
import { StudentAvatar } from './StudentAvatar';
import { normalizeLearningCode, isValidLearningCode } from '../dataContract';

interface SetupScreenProps {
  onStartDialogue: (profile: StudentProfile, learningCode: string) => void;
  learningDataEnabled: boolean;
  onValidateLearningCode: (learningCode: string) => Promise<boolean>;
  labelCondition?: 'shown' | 'hidden';
}

const LEARNING_ID_SESSION_KEY = 'ai-exchange-learning-id';

const readRetainedLearningId = () => {
  try {
    return normalizeLearningCode(window.sessionStorage.getItem(LEARNING_ID_SESSION_KEY) || '');
  } catch {
    return '';
  }
};

const retainLearningId = (learningId: string) => {
  try {
    window.sessionStorage.setItem(LEARNING_ID_SESSION_KEY, learningId);
  } catch {
    // Session storage can be unavailable in restricted browser modes; the dialogue still works normally.
  }
};

const profileCountryLabel = (student: AIStudentProfile) => student.country;

const TARGET_STUDENTS = TARGET_20_AI_STUDENT_IDS
  .map((id) => AI_STUDENTS_MASTER_LIST.find((student) => student.id === id))
  .filter((student): student is AIStudentProfile => Boolean(student));

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue, learningDataEnabled, onValidateLearningCode, labelCondition = 'shown' }) => {
  const showLabels = labelCondition === 'shown';
  const [selectedStudentId, setSelectedStudentId] = useState('emma_usa');
  const [selectedTopic, setSelectedTopic] = useState<DialogueTopic>('intro');
  const [durationMinutes, setDurationMinutes] = useState<1 | 2 | 3 | 5>(1);
  const [learningCode, setLearningCode] = useState(readRetainedLearningId);
  const [codeError, setCodeError] = useState('');
  const [checkingCode, setCheckingCode] = useState(false);
  const selectedStudent = TARGET_STUDENTS.find((student) => student.id === selectedStudentId) || TARGET_STUDENTS[0];

  const handleStart = async () => {
    stopSpeaking();
    const normalized = normalizeLearningCode(learningCode);
    if (learningDataEnabled) {
      if (!isValidLearningCode(normalized)) {
        setCodeError('先生から配られた4文字の学習者IDを入力してね');
        return;
      }
      setCheckingCode(true);
      setCodeError('');
      const ok = await onValidateLearningCode(normalized);
      setCheckingCode(false);
      if (!ok) {
        setCodeError('学習者IDを確認できませんでした。先生に確認してください。');
        return;
      }
      retainLearningId(normalized);
    }
    onStartDialogue(
      {
        name: '5・6年生',
        grade: '小学校５・６年生',
        selectedDurationMinutes: durationMinutes,
        selectedTopic,
        selectedAiStudentId: selectedStudentId as StudentProfile['selectedAiStudentId'],
      },
      learningDataEnabled ? normalized : '',
    );
  };

  return (
    <div className="setup-v2-screen text-slate-900">
      <div className="setup-v2-shell">
        <header className="setup-v2-header">
          <div className="setup-v2-brand">
            <div className="setup-v2-brand-icon" aria-hidden="true"><MessageCircle /></div>
            <div className="setup-v2-brand-copy">
              <div className="setup-v2-badges">
                <span className="setup-v2-badge setup-v2-badge-blue">静岡大学 留学生交流プログラム</span>
                <span className="setup-v2-badge setup-v2-badge-green">小学校5・6年生向け English</span>
              </div>
              <h1>AI留学生えいご対話プラクティス</h1>
            </div>
          </div>
          {learningDataEnabled && <div className="setup-v2-learning-id-wrap">
            <p className="setup-v2-learning-id-help">先生から配られた<br />4文字の学習者IDを入力してね</p>
            <div className="setup-v2-learning-id-field-wrap">
              <div className={`setup-v2-learning-id-field ${codeError ? 'setup-v2-learning-id-error' : ''}`}>
                <KeyRound aria-hidden="true" />
                <span>学習者ID</span>
                <input
                  value={learningCode}
                  onChange={(e) => { setLearningCode(normalizeLearningCode(e.target.value)); setCodeError(''); }}
                  maxLength={4}
                  autoCapitalize="characters"
                  aria-label="4文字の学習者ID"
                />
              </div>
              {codeError && <p className="setup-v2-code-error">{codeError}</p>}
            </div>
          </div>}
        </header>

        <main className="setup-v2-main">
          <section className="setup-v2-student-section">
            <div className="setup-v2-section-heading-row">
              <h2><span className="setup-v2-step">1</span>会話するAI留学生をえらぼう（全20名）</h2>
              <span className="setup-v2-selected-pill">{showLabels ? `${selectedStudent.flag} ${selectedStudent.country} 選択中` : `${selectedStudent.name} 選択中`}</span>
            </div>

            <div className="setup-v2-student-grid">
              {TARGET_STUDENTS.map((student) => {
                const selected = student.id === selectedStudentId;
                return <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`setup-v2-persona-card ${selected ? 'setup-v2-persona-card-selected' : ''}`}
                  aria-pressed={selected}
                  aria-label={`${student.country} ${student.name} ${student.age}歳 ${student.city}`}
                >
                  {selected && <CheckCircle2 className="setup-v2-card-check" aria-hidden="true" />}
                  <div className="setup-v2-card-country">
                    <span className="setup-v2-card-flag" aria-hidden="true">{student.flag}</span>
                    <span>{showLabels ? student.country : 'AI留学生'}</span>
                  </div>
                  <div className="setup-v2-card-portrait">
                    <StudentAvatar student={student} size="custom" className="setup-v2-card-avatar" />
                  </div>
                  <div className="setup-v2-card-copy">
                    <h3>{student.name}</h3>
                    <p>{student.age}歳{showLabels ? `・${student.city}` : ''}</p>
                    {showLabels && <p className="setup-v2-card-japanese-name">{student.japaneseName}</p>}
                  </div>
                </button>;
              })}
            </div>
          </section>

          <section className="setup-v2-controls">
            <div className="setup-v2-profile">
              <div className="setup-v2-profile-copy">
                {showLabels && <div className="setup-v2-profile-country"><span>{selectedStudent.flag}</span><strong>{profileCountryLabel(selectedStudent)}</strong></div>}
                <div className="setup-v2-profile-name-row">
                  <h3>{selectedStudent.name}</h3>
                  <span>{selectedStudent.japaneseName}</span>
                </div>
                <p className="setup-v2-profile-origin">{selectedStudent.age}歳{showLabels ? `・${selectedStudent.city}` : ''}</p>
                <p className="setup-v2-profile-bio">{showLabels ? selectedStudent.japaneseBio : '好きなものや専攻について英語で話せるAI留学生です。'}</p>
                <div className="setup-v2-profile-facts">
                  <p><b>❤️ 好き:</b> {selectedStudent.likes.join('、')}</p>
                  <p><b>🎓 専攻:</b> {selectedStudent.major}</p>
                  {showLabels && <p><b>🏛 名所:</b> {selectedStudent.heritageLandmark}</p>}
                </div>
              </div>
              <StudentAvatar student={selectedStudent} size="custom" className="setup-v2-profile-avatar" />
            </div>

            <div className="setup-v2-topic">
              <h2><span className="setup-v2-step">2</span><MessageCircle aria-hidden="true" />対話テーマをえらぶ</h2>
              <div className="setup-v2-topic-grid">
                {DIALOGUE_TOPICS.map((topic) => {
                  const selected = selectedTopic === topic.id;
                  return <button key={topic.id} type="button" onClick={() => setSelectedTopic(topic.id)} className={selected ? 'setup-v2-option-selected' : ''}>
                    <span>{topic.title}</span><small>{topic.subTitle}</small>
                  </button>;
                })}
              </div>
            </div>

            <div className="setup-v2-duration">
              <h2><span className="setup-v2-step">3</span>対話時間をえらぶ</h2>
              <div className="setup-v2-duration-grid">
                {([1, 2, 3, 5] as const).map((minutes) => <button
                  key={minutes}
                  type="button"
                  onClick={() => setDurationMinutes(minutes)}
                  className={durationMinutes === minutes ? 'setup-v2-duration-selected' : ''}
                >
                  <span>{minutes}分</span><small>{minutes * 60}秒</small>
                </button>)}
              </div>
            </div>

            <button type="button" onClick={handleStart} disabled={checkingCode} className="setup-v2-start">
              <Play aria-hidden="true" />{checkingCode ? 'コードを確認しています…' : '対話をスタートする！（Start）'}
            </button>
          </section>
        </main>

        <p className="setup-v2-footer">本アプリは学校での英語学習を目的として設計されています。AI（Anthropic API）を利用した英語対話練習を行います。</p>
      </div>
    </div>
  );
};
