export const EDUCATION_KNOWLEDGE = {
  domains: {
    technology: {
      name: 'Technology & Software',
      categories: [
        {
          id: 'web-development',
          name: 'Web Development',
          skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'TypeScript', 'Vue.js', 'Angular', 'Next.js', 'GraphQL'],
          certifications: [
            { name: 'Meta Front-End Developer', provider: 'Meta' },
            { name: 'AWS Certified Developer', provider: 'AWS' },
            { name: 'Google UX Design', provider: 'Google' }
          ]
        },
        {
          id: 'data-science',
          name: 'Data Science & Analytics',
          skills: ['Python', 'SQL', 'Machine Learning', 'Statistics', 'TensorFlow', 'Pandas', 'Data Visualization', 'R'],
          certifications: [
            { name: 'IBM Data Science Professional', provider: 'IBM' },
            { name: 'Google Data Analytics', provider: 'Google' },
            { name: 'Microsoft Azure Data Scientist', provider: 'Microsoft' }
          ]
        },
        {
          id: 'cloud-devops',
          name: 'Cloud & DevOps',
          skills: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Linux'],
          certifications: [
            { name: 'AWS Solutions Architect', provider: 'AWS' },
            { name: 'Google Cloud Professional', provider: 'Google' },
            { name: 'CKA - Kubernetes Administrator', provider: 'CNCF' }
          ]
        },
        {
          id: 'mobile-development',
          name: 'Mobile Development',
          skills: ['React Native', 'Flutter', 'iOS', 'Android', 'Swift', 'Kotlin', 'Firebase'],
          certifications: [
            { name: 'Meta React Native', provider: 'Meta' },
            { name: 'Google Associate Android Developer', provider: 'Google' }
          ]
        },
        {
          id: 'cybersecurity',
          name: 'Cybersecurity',
          skills: ['Network Security', 'Penetration Testing', 'Ethical Hacking', 'SIEM', 'Python for Security'],
          certifications: [
            { name: 'CompTIA Security+', provider: 'CompTIA' },
            { name: 'Certified Ethical Hacker (CEH)', provider: 'EC-Council' },
            { name: 'CISSP', provider: '(ISC)²' }
          ]
        }
      ]
    },
    business: {
      name: 'Business & Management',
      categories: [
        {
          id: 'project-management',
          name: 'Project Management',
          skills: ['Agile', 'Scrum', 'Kanban', 'Risk Management', 'Stakeholder Management', 'JIRA'],
          certifications: [
            { name: 'PMP', provider: 'PMI' },
            { name: 'Certified Scrum Master (CSM)', provider: 'Scrum Alliance' },
            { name: 'Google Project Management', provider: 'Google' }
          ]
        },
        {
          id: 'marketing',
          name: 'Digital Marketing',
          skills: ['SEO', 'SEM', 'Social Media', 'Content Marketing', 'Email Marketing', 'Analytics', 'Google Ads'],
          certifications: [
            { name: 'Google Digital Marketing', provider: 'Google' },
            { name: 'HubSpot Inbound Marketing', provider: 'HubSpot' },
            { name: 'Facebook Blueprint', provider: 'Meta' }
          ]
        },
        {
          id: 'finance',
          name: 'Finance & Accounting',
          skills: ['Financial Analysis', 'Excel', 'QuickBooks', 'SAP', 'Financial Modeling'],
          certifications: [
            { name: 'CFA Level I', provider: 'CFA Institute' },
            { name: 'CPA', provider: 'AICPA' },
            { name: 'Financial Modeling', provider: 'Wall Street Prep' }
          ]
        }
      ]
    },
    design: {
      name: 'Design & Creative',
      categories: [
        {
          id: 'ui-ux-design',
          name: 'UI/UX Design',
          skills: ['Figma', 'Adobe XD', 'Prototyping', 'User Research', 'Wireframing', 'Design Systems'],
          certifications: [
            { name: 'Google UX Design', provider: 'Google' },
            { name: 'Interaction Design Foundation', provider: 'IDF' },
            { name: 'Adobe Certified Professional', provider: 'Adobe' }
          ]
        },
        {
          id: 'graphic-design',
          name: 'Graphic Design',
          skills: ['Photoshop', 'Illustrator', 'InDesign', 'Typography', 'Color Theory', 'Branding'],
          certifications: [
            { name: 'Adobe Certified Expert', provider: 'Adobe' },
            { name: 'Graphic Design Certificate', provider: 'Parsons' }
          ]
        },
        {
          id: 'video-animation',
          name: 'Video & Animation',
          skills: ['Premiere Pro', 'After Effects', 'DaVinci Resolve', '3D Animation', 'Motion Graphics'],
          certifications: [
            { name: 'Adobe Certified Professional - Video', provider: 'Adobe' },
            { name: 'Autodesk Certified Professional', provider: 'Autodesk' }
          ]
        }
      ]
    },
    language: {
      name: 'Language & Communication',
      categories: [
        {
          id: 'language-learning',
          name: 'Language Learning',
          skills: ['English', 'Spanish', 'French', 'Mandarin', 'German', 'Japanese', 'Business Communication'],
          certifications: [
            { name: 'TOEFL', provider: 'ETS' },
            { name: 'IELTS', provider: 'British Council' },
            { name: 'DELF/DALF', provider: 'French Ministry' },
            { name: 'JLPT', provider: 'Japan Foundation' }
          ]
        },
        {
          id: 'soft-skills',
          name: 'Soft Skills',
          skills: ['Public Speaking', 'Leadership', 'Communication', 'Time Management', 'Emotional Intelligence'],
          certifications: [
            { name: 'Dale Carnegie Certification', provider: 'Dale Carnegie' },
            { name: 'VitalSmarts Certifications', provider: 'VitalSmarts' }
          ]
        }
      ]
    }
  },

  skillLevels: [
    { id: 'beginner', name: 'Beginner', description: 'No prior experience required', color: '#4CAF50' },
    { id: 'elementary', name: 'Elementary', description: 'Basic understanding and concepts', color: '#8BC34A' },
    { id: 'intermediate', name: 'Intermediate', description: 'Some experience, building fundamentals', color: '#FFC107' },
    { id: 'upper-intermediate', name: 'Upper Intermediate', description: 'Solid foundation, ready for advanced topics', color: '#FF9800' },
    { id: 'advanced', name: 'Advanced', description: 'Expert-level knowledge and skills', color: '#F44336' }
  ],

  learningFormats: [
    { id: 'video', name: 'Video Courses', icon: '🎥' },
    { id: 'interactive', name: 'Interactive Tutorials', icon: '💻' },
    { id: 'reading', name: 'Reading Materials', icon: '📖' },
    { id: 'project', name: 'Project-Based', icon: '🛠️' },
    { id: 'mentorship', name: 'Mentorship', icon: '👨‍🏫' },
    { id: 'bootcamp', name: 'Bootcamps', icon: '🚀' }
  ],

  studyTips: {
    timeManagement: [
      'Use the Pomodoro Technique: 25 minutes of focused study followed by a 5-minute break',
      'Set specific, achievable goals for each study session',
      'Create a dedicated study space free from distractions',
      'Review material within 24 hours of learning it',
      'Space out your learning across multiple sessions'
    ],
    retention: [
      'Practice active recall instead of passive re-reading',
      'Teach concepts to someone else to reinforce understanding',
      'Use spaced repetition systems (SRS) for memorization',
      'Connect new information to existing knowledge',
      'Take breaks to allow information to consolidate'
    ],
    engagement: [
      'Join study groups or online communities',
      'Work on real-world projects to apply learning',
      'Set up accountability partnerships',
      'Track your progress and celebrate milestones',
      'Mix different types of content to stay engaged'
    ]
  }
};

export const CERTIFICATION_PROVIDERS = [
  { name: 'Google', logo: 'Google', popularCerts: ['IT Support', 'Data Analytics', 'UX Design', 'Project Management'] },
  { name: 'Meta', logo: 'Meta', popularCerts: ['Front-End Developer', 'React Native', 'Marketing'] },
  { name: 'Amazon Web Services', logo: 'AWS', popularCerts: ['Solutions Architect', 'Developer', 'SysOps Administrator'] },
  { name: 'Microsoft', logo: 'Microsoft', popularCerts: ['Azure Fundamentals', 'Data Scientist', 'Security Engineer'] },
  { name: 'IBM', logo: 'IBM', popularCerts: ['Data Science', 'Cloud Developer', 'AI Engineer'] },
  { name: 'CompTIA', logo: 'CompTIA', popularCerts: ['A+', 'Security+', 'Network+', 'CySA+'] },
  { name: 'Salesforce', logo: 'Salesforce', popularCerts: ['Admin', 'Developer', 'Architect'] },
  { name: 'HubSpot', logo: 'HubSpot', popularCerts: ['Inbound Marketing', 'Sales', 'Service'] }
];

export default EDUCATION_KNOWLEDGE;
