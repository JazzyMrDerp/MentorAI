import type { Progress, StudentProfile } from '../types';
import { getProgressForStudent, getProgressBySubject, getProfile } from '../db';

export interface TeacherStats {
  totalQuizzes: number;
  averageScore: number;
  totalXP: number;
  currentStreak: number;
  recentActivity: Progress[];
  subjectBreakdown: {
    math: { attempts: number; avgScore: number };
    ela: { attempts: number; avgScore: number };
  };
}

export async function loadTeacherData(nickname: string): Promise<TeacherStats | null> {
  const profile = await getProfile(nickname);
  if (!profile) return null;
  
  const allProgress = await getProgressForStudent(nickname);
  const mathProgress = await getProgressBySubject(nickname, 'math');
  const elaProgress = await getProgressBySubject(nickname, 'ela');
  
  const calculateAvg = (progress: Progress[]): number => {
    if (progress.length === 0) return 0;
    const total = progress.reduce((sum, p) => sum + p.score, 0);
    return Math.round(total / progress.length);
  };
  
  return {
    totalQuizzes: allProgress.length,
    averageScore: calculateAvg(allProgress),
    totalXP: profile.totalXP,
    currentStreak: profile.streak,
    recentActivity: allProgress.slice(0, 10),
    subjectBreakdown: {
      math: { attempts: mathProgress.length, avgScore: calculateAvg(mathProgress) },
      ela: { attempts: elaProgress.length, avgScore: calculateAvg(elaProgress) },
    },
  };
}

export function renderTeacherDashboard(stats: TeacherStats, profile: StudentProfile): string {
  const subjectCards = `
    <div class="subject-card">
      <h3>Math</h3>
      <p class="stat-value">${stats.subjectBreakdown.math.attempts}</p>
      <p class="stat-label">quizzes completed</p>
      <p class="stat-score">Avg: ${stats.subjectBreakdown.math.avgScore}%</p>
    </div>
    <div class="subject-card">
      <h3>ELA</h3>
      <p class="stat-value">${stats.subjectBreakdown.ela.attempts}</p>
      <p class="stat-label">quizzes completed</p>
      <p class="stat-score">Avg: ${stats.subjectBreakdown.ela.avgScore}%</p>
    </div>
  `;
  
  const recentItems = stats.recentActivity.map(p => `
    <div class="recent-item">
      <span class="lesson-title">${p.lessonTitle}</span>
      <span class="lesson-subject">${p.subject.toUpperCase()}</span>
      <span class="lesson-score ${p.score >= 60 ? 'good' : 'needs-work'}">${p.score}%</span>
      <span class="lesson-xp">+${p.xpEarned} XP</span>
    </div>
  `).join('');
  
  return `
    <div class="teacher-dashboard">
      <header class="teacher-header">
        <h1>Teacher Dashboard</h1>
        <p class="student-name">Student: ${profile.nickname}</p>
      </header>
      
      <div class="teacher-stats">
        <div class="stat-box">
          <h3>Total XP</h3>
          <p class="stat-value">${stats.totalXP}</p>
        </div>
        <div class="stat-box">
          <h3>Level</h3>
          <p class="stat-value">${profile.currentLevel}</p>
        </div>
        <div class="stat-box">
          <h3>Streak</h3>
          <p class="stat-value">${stats.currentStreak} 🔥</p>
        </div>
        <div class="stat-box">
          <h3>Quizzes</h3>
          <p class="stat-value">${stats.totalQuizzes}</p>
        </div>
      </div>
      
      <section class="subject-breakdown">
        <h2>Subject Performance</h2>
        <div class="subject-cards">
          ${subjectCards}
        </div>
      </section>
      
      <section class="recent-activity">
        <h2>Recent Activity</h2>
        <div class="recent-list">
          ${recentItems || '<p class="no-activity">No recent activity yet.</p>'}
        </div>
      </section>
    </div>
  `;
}

export function getLevelFromXP(xp: number): number {
  if (xp >= 1000) return 5;
  if (xp >= 700) return 4;
  if (xp >= 450) return 3;
  if (xp >= 250) return 2;
  return 1;
}

export function getXPForNextLevel(currentXP: number): number {
  const currentLevel = getLevelFromXP(currentXP);
  const thresholds = [250, 450, 700, 1000];
  return thresholds[currentLevel - 1] || 0;
}

export async function generateProgressSummary(nickname: string): Promise<string> {
  const stats = await loadTeacherData(nickname);
  if (!stats) return 'No progress data available.';
  
  const level = getLevelFromXP(stats.totalXP);
  
  let summary = `${nickname} is currently at Level ${level} with ${stats.totalXP} XP. `;
  
  if (stats.totalQuizzes === 0) {
    summary += 'They haven\'t completed any quizzes yet.';
  } else {
    summary += `They\'ve completed ${stats.totalQuizzes} quizzes with an average score of ${stats.averageScore}%. `;
    
    if (stats.subjectBreakdown.math.attempts > stats.subjectBreakdown.ela.attempts) {
      summary += 'They\'re stronger in Math. ';
    } else if (stats.subjectBreakdown.ela.attempts > stats.subjectBreakdown.math.attempts) {
      summary += 'They\'re stronger in ELA. ';
    } else {
      summary += 'They\'re equally engaged in both subjects. ';
    }
    
    if (stats.currentStreak > 0) {
      summary += `They\'ve maintained a ${stats.currentStreak}-day learning streak!`;
    }
  }
  
  return summary;
}