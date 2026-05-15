import { UserProfile, Recommendation, FitnessLevel, WorkoutType } from './fitnessExpert.js';

export function getRecommendations(profile: UserProfile): Recommendation[] {
  const recommendations: Recommendation[] = [];

  recommendations.push(...getLevelBasedRecommendations(profile.fitnessLevel));
  recommendations.push(...getGoalBasedRecommendations(profile.goals));
  recommendations.push(...getEquipmentBasedRecommendations(profile.availableEquipment));
  recommendations.push(...getFrequencyBasedRecommendations(profile.daysPerWeek));

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function getLevelBasedRecommendations(level: FitnessLevel): Recommendation[] {
  switch (level) {
    case FitnessLevel.BEGINNER:
      return [
        {
          type: 'workout',
          title: 'Master the Fundamentals',
          description: 'Focus on learning proper form for basic exercises like squats, push-ups, and planks. Building a solid foundation now will prevent injuries and set you up for success!',
          priority: 'high'
        },
        {
          type: 'tip',
          title: 'Start with Bodyweight',
          description: 'Use your bodyweight for the first 2-4 weeks to build coordination and muscle memory before adding weights.',
          priority: 'high'
        },
        {
          type: 'tip',
          title: 'Rest is Part of Training',
          description: 'Take at least 1-2 rest days per week. Your muscles grow during rest, not during workouts!',
          priority: 'medium'
        }
      ];

    case FitnessLevel.INTERMEDIATE:
      return [
        {
          type: 'workout',
          title: 'Implement Progressive Overload',
          description: 'Gradually increase weight, reps, or sets each week to keep challenging your muscles and seeing gains!',
          priority: 'high'
        },
        {
          type: 'tip',
          title: 'Mix Up Your Routine',
          description: 'Try different exercises, rep ranges, and rest periods to target muscles from different angles and prevent plateaus.',
          priority: 'high'
        },
        {
          type: 'tip',
          title: 'Track Your Workouts',
          description: 'Keep a log of your exercises, weights, and reps. Seeing your progress on paper is incredibly motivating!',
          priority: 'medium'
        }
      ];

    case FitnessLevel.ADVANCED:
      return [
        {
          type: 'workout',
          title: 'Periodization Training',
          description: 'Cycle through different training phases (strength, hypertrophy, endurance) every 4-6 weeks for continued progress.',
          priority: 'high'
        },
        {
          type: 'tip',
          title: 'Advanced Techniques',
          description: 'Incorporate techniques like drop sets, supersets, and eccentric training to break through plateaus.',
          priority: 'high'
        },
        {
          type: 'tip',
          title: 'Recovery Optimization',
          description: 'Consider foam rolling, stretching, and recovery modalities to maintain performance at high levels.',
          priority: 'medium'
        }
      ];

    default:
      return [];
  }
}

function getGoalBasedRecommendations(goals: string[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (goals.includes('weight loss')) {
    recommendations.push({
      type: 'workout',
      title: 'HIIT for Fat Loss',
      description: 'High-Intensity Interval Training is excellent for burning calories and boosting metabolism. Try 20-30 second work periods with 10-15 second rest.',
      priority: 'high'
    });
    recommendations.push({
      type: 'tip',
      title: 'Strength Training is Key',
      description: 'Building muscle increases your resting metabolism, helping you burn more calories even at rest!',
      priority: 'medium'
    });
  }

  if (goals.includes('muscle gain') || goals.includes('build muscle')) {
    recommendations.push({
      type: 'workout',
      title: 'Compound Movements First',
      description: 'Prioritize multi-joint exercises like squats, deadlifts, and bench press. They recruit more muscle fibers for greater growth.',
      priority: 'high'
    });
    recommendations.push({
      type: 'tip',
      title: 'Protein for Growth',
      description: 'Aim for 1.6-2.2g of protein per kg of body weight daily to support muscle protein synthesis.',
      priority: 'high'
    });
  }

  if (goals.includes('endurance')) {
    recommendations.push({
      type: 'workout',
      title: 'Build Your Aerobic Base',
      description: 'Include steady-state cardio at 60-70% max heart rate for 30-60 minutes to build your aerobic capacity.',
      priority: 'high'
    });
    recommendations.push({
      type: 'tip',
      title: 'Tempo Training',
      description: 'Slow down your repetitions with 3-4 second negatives to increase time under tension and build muscular endurance.',
      priority: 'medium'
    });
  }

  if (goals.includes('flexibility')) {
    recommendations.push({
      type: 'workout',
      title: 'Daily Mobility Work',
      description: 'Include 10-15 minutes of stretching or yoga daily. Consistency is more important than intensity for flexibility.',
      priority: 'high'
    });
    recommendations.push({
      type: 'tip',
      title: 'Dynamic Before, Static After',
      description: 'Do dynamic stretches before workouts and static stretches after to improve range of motion safely.',
      priority: 'medium'
    });
  }

  if (goals.includes('general fitness') || goals.length === 0) {
    recommendations.push({
      type: 'workout',
      title: 'Balanced Training',
      description: 'Include a mix of strength, cardio, and flexibility work each week for well-rounded fitness.',
      priority: 'high'
    });
    recommendations.push({
      type: 'tip',
      title: 'Listen to Your Body',
      description: 'Pay attention to how you feel. Some days you will have more energy than others - adjust accordingly!',
      priority: 'medium'
    });
  }

  return recommendations;
}

function getEquipmentBasedRecommendations(equipment: string[]): Recommendation[] {
  const hasNone = equipment.includes('none');

  if (hasNone) {
    return [
      {
        type: 'tip',
        title: 'Bodyweight is Powerful',
        description: 'You can build an impressive physique with just bodyweight exercises. Focus on progression like one-legged squats and one-armed push-ups.',
        priority: 'high'
      },
      {
        type: 'tip',
        title: 'Get Creative',
        description: 'Use household items like filled backpacks for added resistance, or find a sturdy bar for inverted rows.',
        priority: 'medium'
      }
    ];
  }

  return [
    {
      type: 'tip',
      title: 'Free Weights vs Machines',
      description: 'Prioritize free weights (dumbbells, barbells) for functional strength, but use machines for isolation work and safety.',
      priority: 'medium'
    }
  ];
}

function getFrequencyBasedRecommendations(daysPerWeek: number): Recommendation[] {
  if (daysPerWeek < 3) {
    return [
      {
        type: 'workout',
        title: 'Full Body Focus',
        description: 'With limited days, focus on full-body workouts that hit all major muscle groups in each session.',
        priority: 'high'
      }
    ];
  }

  if (daysPerWeek >= 5) {
    return [
      {
        type: 'tip',
        title: 'Split Your Training',
        description: 'With more days available, you can split your workouts by muscle group for more targeted training volume.',
        priority: 'medium'
      }
    ];
  }

  return [];
}

export function generateMotivationMessage(profile: UserProfile): string {
  const messages = [
    "Every workout counts! You're one rep closer to your goal!",
    "Your only limit is you! Let's push those boundaries!",
    "Champions are made in the gym when nobody is watching. Keep going!",
    "The pain you feel today is the strength you feel tomorrow!",
    "Your body can do it. It's your mind you need to convince!",
    "Success is the sum of small efforts repeated day in and day out!",
    "The only bad workout is the one that didn't happen!",
    "You're stronger than you think. Trust the process!"
  ];

  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

export function getRecoveryTips(): Recommendation[] {
  return [
    {
      type: 'tip',
      title: 'Sleep is Non-Negotiable',
      description: 'Aim for 7-9 hours of quality sleep. This is when your body repairs and grows!',
      priority: 'high'
    },
    {
      type: 'tip',
      title: 'Hydration Station',
      description: 'Drink at least 2-3 liters of water daily. Dehydration impairs performance and recovery!',
      priority: 'high'
    },
    {
      type: 'tip',
      title: 'Nutrition Matters',
      description: 'Fuel your body with whole foods, adequate protein, and complex carbs for optimal recovery.',
      priority: 'medium'
    },
    {
      type: 'tip',
      title: 'Active Recovery',
      description: 'On rest days, try light walking, swimming, or yoga to promote blood flow without fatigue.',
      priority: 'medium'
    },
    {
      type: 'tip',
      title: 'Manage Stress',
      description: 'High stress elevates cortisol, which can hinder recovery. Find time to relax and unwind!',
      priority: 'low'
    }
  ];
}
