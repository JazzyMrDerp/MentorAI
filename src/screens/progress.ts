import type { StudentProfile, Progress } from '../types';
import { getProgressForStudent, getProgressBySubject } from '../db';

interface ProgressOptions {
  profile: StudentProfile;
  onGoBack: () => void;
}

export async function renderProgressScreen(options: ProgressOptions): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'main-content';
  
  const allProgress = await getProgressForStudent(options.profile.nickname);
  const mathProgress = await getProgressBySubject(options.profile.nickname, 'math');
  const elaProgress = await getProgressBySubject(options.profile.nickname, 'ela');
  
  const calculateAvg = (progress: Progress[]): number => {
    if (progress.length === 0) return 0;
    const total = progress.reduce((sum, p) => sum + p.score, 0);
    return Math.round(total / progress.length);
  };
  
  const getBestScore = (progress: Progress[]): number => {
    if (progress.length === 0) return 0;
    return Math.max(...progress.map(p => p.score));
  };
  
  const getTotalXP = (progress: Progress[]): number => {
    return progress.reduce((sum, p) => sum + p.xpEarned, 0);
  };
  
  const mathAvg = calculateAvg(mathProgress);
  const elaAvg = calculateAvg(elaProgress);
  const mathBest = getBestScore(mathProgress);
  const elaBest = getBestScore(elaProgress);
  const mathXP = getTotalXP(mathProgress);
  const elaXP = getTotalXP(elaProgress);
  
  container.innerHTML = `
    <div class="progress-screen">
      <h1 class="progress-title">Your Progress</h1>
      
      <section class="progress-overview">
        <div class="overview-card">
          <div class="overview-icon">🏆</div>
          <div class="overview-stat">${options.profile.totalXP}</div>
          <div class="overview-label">Total XP</div>
        </div>
        <div class="overview-card">
          <div class="overview-icon">⭐</div>
          <div class="overview-stat">Level ${options.profile.currentLevel}</div>
          <div class="overview-label">Current Level</div>
        </div>
        <div class="overview-card">
          <div class="overview-icon">🔥</div>
          <div class="overview-stat">${options.profile.streak}</div>
          <div class="overview-label">Day Streak</div>
        </div>
        <div class="overview-card">
          <div class="overview-icon">📝</div>
          <div class="overview-stat">${allProgress.length}</div>
          <div class="overview-label">Quizzes Taken</div>
        </div>
      </section>
      
      <section class="progress-subject">
        <h2>Math</h2>
        <div class="subject-stats">
          <div class="subject-stat">
            <span class="subject-label">Quizzes</span>
            <span class="subject-value">${mathProgress.length}</span>
          </div>
          <div class="subject-stat">
            <span class="subject-label">Average</span>
            <span class="subject-value">${mathAvg}%</span>
          </div>
          <div class="subject-stat">
            <span class="subject-label">Best Score</span>
            <span class="subject-value">${mathBest}%</span>
          </div>
          <div class="subject-stat">
            <span class="subject-label">XP Earned</span>
            <span class="subject-value">${mathXP}</span>
          </div>
        </div>
      </section>
      
      <section class="progress-subject">
        <h2>ELA</h2>
        <div class="subject-stats">
          <div class="subject-stat">
            <span class="subject-label">Quizzes</span>
            <span class="subject-value">${elaProgress.length}</span>
          </div>
          <div class="subject-stat">
            <span class="subject-label">Average</span>
            <span class="subject-value">${elaAvg}%</span>
          </div>
          <div class="subject-stat">
            <span class="subject-label">Best Score</span>
            <span class="subject-value">${elaBest}%</span>
          </div>
          <div class="subject-stat">
            <span class="subject-label">XP Earned</span>
            <span class="subject-value">${elaXP}</span>
          </div>
        </div>
      </section>
      
      <section class="progress-history">
        <h2>Recent Quizzes</h2>
        <div class="history-list">
          ${allProgress.length > 0 ? allProgress.slice(0, 10).map(p => `
            <div class="history-item">
              <div class="history-lesson">${p.lessonTitle}</div>
              <div class="history-subject">${p.subject.toUpperCase()}</div>
              <div class="history-score ${p.score >= 60 ? 'good' : 'needs-work'}">${p.score}%</div>
              <div class="history-xp">+${p.xpEarned} XP</div>
            </div>
          `).join('') : '<p class="no-history">No quizzes completed yet.</p>'}
        </div>
      </section>
    </div>
  `;
  
  return container;
}