import { UserProgress, Achievement } from '../types/tone';

interface ProgressData extends UserProgress {
  checkpoints: ProgressCheckpoint[];
}

interface ProgressCheckpoint {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: Date;
}

export class ProgressService {
  private achievements: Achievement[] = [
    {
      id: 'first-step',
      name: 'First Step',
      description: 'Started your first course',
      icon: '🌟',
      criteria: { type: 'courses_started', value: 1 }
    },
    {
      id: 'quick-starter',
      name: 'Quick Starter',
      description: 'Started 3 courses in one week',
      icon: '🚀',
      criteria: { type: 'courses_started', value: 3 }
    },
    {
      id: 'dedicated-learner',
      name: 'Dedicated Learner',
      description: 'Spent 10 hours learning',
      icon: '📚',
      criteria: { type: 'time_spent', value: 10 }
    },
    {
      id: 'skill-sharpeners',
      name: 'Skill Sharpener',
      description: 'Completed 5 courses',
      icon: '⚔️',
      criteria: { type: 'courses_completed', value: 5 }
    },
    {
      id: 'certification-chaser',
      name: 'Certification Chaser',
      description: 'Earned your first certification',
      icon: '🎓',
      criteria: { type: 'certifications_earned', value: 1 }
    },
    {
      id: 'learning-streak-7',
      name: 'Week Warrior',
      description: '7-day learning streak',
      icon: '🔥',
      criteria: { type: 'streak_days', value: 7 }
    },
    {
      id: 'learning-streak-30',
      name: 'Monthly Master',
      description: '30-day learning streak',
      icon: '💎',
      criteria: { type: 'streak_days', value: 30 }
    },
    {
      id: 'domain-expert',
      name: 'Domain Expert',
      description: 'Completed all courses in a domain',
      icon: '👑',
      criteria: { type: 'domain_mastered', value: 1 }
    },
    {
      id: 'night-owl',
      name: 'Night Owl',
      description: 'Studied after midnight',
      icon: '🦉',
      criteria: { type: 'late_night_study', value: 1 }
    },
    {
      id: 'early-bird',
      name: 'Early Bird',
      description: 'Studied before 6 AM',
      icon: '🐦',
      criteria: { type: 'early_morning_study', value: 1 }
    }
  ];

  private userProgress: Map<string, ProgressData> = new Map();
  private checkpoints: Map<string, ProgressCheckpoint[]> = new Map();

  async startCourse(userId: string, courseId: string): Promise<UserProgress> {
    const key = `${userId}-${courseId}`;

    let progress = this.userProgress.get(key);

    if (!progress) {
      progress = {
        userId,
        courseId,
        status: 'in_progress',
        progress: 0,
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        timeSpent: 0,
        achievements: [],
        checkpoints: []
      };

      this.userProgress.set(key, progress);
      this.initializeCheckpoints(progress);
    } else if (progress.status === 'completed') {
      progress.status = 'in_progress';
      progress.progress = 0;
      progress.lastAccessedAt = new Date();
    }

    await this.checkAndUnlockAchievements(progress);

    return progress;
  }

  private initializeCheckpoints(progress: ProgressData): void {
    const courseCheckpoints: ProgressCheckpoint[] = [
      { id: `${progress.courseId}-intro`, title: 'Introduction', completed: false },
      { id: `${progress.courseId}-basics`, title: 'Core Basics', completed: false },
      { id: `${progress.courseId}-intermediate`, title: 'Intermediate Concepts', completed: false },
      { id: `${progress.courseId}-advanced`, title: 'Advanced Topics', completed: false },
      { id: `${progress.courseId}-project`, title: 'Final Project', completed: false },
      { id: `${progress.courseId}-review`, title: 'Review & Assessment', completed: false }
    ];

    progress.checkpoints = courseCheckpoints;
    this.checkpoints.set(`${progress.userId}-${progress.courseId}`, courseCheckpoints);
  }

  async updateProgress(
    userId: string,
    courseId: string,
    progressPercent: number,
    timeSpentMinutes?: number
  ): Promise<UserProgress> {
    const key = `${userId}-${courseId}`;
    const progress = this.userProgress.get(key);

    if (!progress) {
      return this.startCourse(userId, courseId);
    }

    progress.progress = Math.min(Math.max(progressPercent, 0), 100);
    progress.lastAccessedAt = new Date();

    if (timeSpentMinutes) {
      progress.timeSpent += timeSpentMinutes;
    }

    this.updateCheckpoints(progress, progressPercent);
    await this.checkAndUnlockAchievements(progress);

    if (progress.progress >= 100 && progress.status !== 'completed') {
      progress.status = 'completed';
      progress.completedAt = new Date();
      await this.checkAndUnlockAchievements(progress);
    }

    return progress;
  }

  private updateCheckpoints(progress: ProgressData, percent: number): void {
    const checkpointThresholds = [10, 30, 50, 70, 90, 100];

    for (let i = 0; i < progress.checkpoints.length; i++) {
      const threshold = checkpointThresholds[i];
      if (percent >= threshold && !progress.checkpoints[i].completed) {
        progress.checkpoints[i].completed = true;
        progress.checkpoints[i].completedAt = new Date();
      }
    }
  }

  async getProgress(userId: string, courseId: string): Promise<UserProgress | null> {
    return this.userProgress.get(`${userId}-${courseId}`) || null;
  }

  async getUserAllProgress(userId: string): Promise<UserProgress[]> {
    const allProgress: ProgressData[] = [];
    for (const [key, progress] of this.userProgress.entries()) {
      if (key.startsWith(`${userId}-`)) {
        allProgress.push(progress);
      }
    }
    return allProgress;
  }

  async completeCourse(userId: string, courseId: string): Promise<UserProgress> {
    const progress = await this.updateProgress(userId, courseId, 100);
    progress.status = 'completed';
    progress.completedAt = new Date();
    return progress;
  }

  private async checkAndUnlockAchievements(progress: ProgressData): Promise<string[]> {
    const unlockedIds: string[] = [];
    const userId = progress.userId;

    const allProgress = await this.getUserAllProgress(userId);
    const coursesStarted = allProgress.filter(p => p.startedAt).length;
    const coursesCompleted = allProgress.filter(p => p.status === 'completed').length;
    const totalTimeSpent = allProgress.reduce((sum, p) => sum + p.timeSpent, 0);

    const now = new Date();
    const hour = now.getHours();
    const isNightOwl = hour >= 0 && hour < 5;
    const isEarlyBird = hour >= 4 && hour < 6;

    for (const achievement of this.achievements) {
      if (progress.achievements.includes(achievement.id)) continue;

      let qualifies = false;

      switch (achievement.criteria.type) {
        case 'courses_started':
          qualifies = coursesStarted >= achievement.criteria.value;
          break;
        case 'courses_completed':
          qualifies = coursesCompleted >= achievement.criteria.value;
          break;
        case 'time_spent':
          qualifies = totalTimeSpent >= achievement.criteria.value * 60;
          break;
        case 'certifications_earned':
          qualifies = coursesCompleted >= achievement.criteria.value;
          break;
        case 'late_night_study':
          qualifies = isNightOwl;
          break;
        case 'early_morning_study':
          qualifies = isEarlyBird;
          break;
      }

      if (qualifies) {
        progress.achievements.push(achievement.id);
        unlockedIds.push(achievement.id);
      }
    }

    return unlockedIds;
  }

  async getAchievements(userId: string): Promise<{
    unlocked: Achievement[];
    locked: Achievement[];
  }> {
    const allProgress = await this.getUserAllProgress(userId);
    const unlockedIds = new Set<string>();

    for (const progress of allProgress) {
      for (const id of progress.achievements) {
        unlockedIds.add(id);
      }
    }

    const unlocked: Achievement[] = [];
    const locked: Achievement[] = [];

    for (const achievement of this.achievements) {
      if (unlockedIds.has(achievement.id)) {
        unlocked.push({ ...achievement, unlockedAt: new Date() });
      } else {
        locked.push(achievement);
      }
    }

    return { unlocked, locked };
  }

  async getLearningStats(userId: string): Promise<{
    totalCoursesStarted: number;
    totalCoursesCompleted: number;
    totalTimeSpentMinutes: number;
    currentStreak: number;
    longestStreak: number;
    achievementsUnlocked: number;
    totalAchievements: number;
    averageProgress: number;
  }> {
    const allProgress = await this.getUserAllProgress(userId);

    const totalTimeSpent = allProgress.reduce((sum, p) => sum + p.timeSpent, 0);
    const achievements = await this.getAchievements(userId);

    return {
      totalCoursesStarted: allProgress.filter(p => p.startedAt).length,
      totalCoursesCompleted: allProgress.filter(p => p.status === 'completed').length,
      totalTimeSpentMinutes: totalTimeSpent,
      currentStreak: this.calculateStreak(allProgress),
      longestStreak: 0,
      achievementsUnlocked: achievements.unlocked.length,
      totalAchievements: this.achievements.length,
      averageProgress: allProgress.length > 0
        ? Math.round(allProgress.reduce((sum, p) => sum + p.progress, 0) / allProgress.length)
        : 0
    };
  }

  private calculateStreak(allProgress: ProgressData[]): number {
    const studyDates = new Set<string>();

    for (const progress of allProgress) {
      if (progress.lastAccessedAt) {
        const date = new Date(progress.lastAccessedAt).toISOString().split('T')[0];
        studyDates.add(date);
      }
    }

    let streak = 0;
    const today = new Date();
    const currentDate = new Date(today);

    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (studyDates.has(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }
}

export const progressService = new ProgressService();
