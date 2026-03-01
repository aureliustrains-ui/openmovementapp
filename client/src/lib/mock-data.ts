// Mock data for the structured Training Plan domain

export const currentUser = {
  id: 'client_1',
  name: 'Sarah Connor',
  email: 'sarah@example.com',
  role: 'Client',
  avatar: 'https://i.pravatar.cc/150?u=sarah',
};

// Users
export const usersData = [
  { id: 'admin_1', name: 'Head Coach', email: 'coach@example.com', role: 'Admin', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=coach' },
  { id: 'client_1', name: 'Sarah Connor', email: 'sarah@example.com', role: 'Client', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=sarah' },
  { id: 'client_2', name: 'John Smith', email: 'john@example.com', role: 'Client', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=john' },
  { id: 'client_3', name: 'Jane Doe', email: 'jane@example.com', role: 'Client', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=jane' },
];

// Reusable Templates
export const exerciseTemplates = [
  { id: 'ex_t_1', name: 'Barbell Back Squat', targetMuscle: 'Quads', demoUrl: 'https://example.com/squat.mp4' },
  { id: 'ex_t_2', name: 'Dumbbell Romanian Deadlift', targetMuscle: 'Hamstrings', demoUrl: 'https://example.com/rdl.mp4' },
  { id: 'ex_t_3', name: 'Pull-up', targetMuscle: 'Lats', demoUrl: 'https://example.com/pullup.mp4' },
  { id: 'ex_t_4', name: 'Push-up', targetMuscle: 'Chest', demoUrl: 'https://example.com/pushup.mp4' },
];

// Complex Entity: Phase
export const phasesData = [
  {
    id: 'ph_1',
    clientId: 'client_1',
    name: 'Hypertrophy Block 1',
    goal: 'Build base muscle mass',
    startDate: '2026-03-01',
    durationWeeks: 4,
    status: 'Waiting for Movement Check', // Draft | Waiting for Movement Check | Active | Completed
    movementChecks: [
      { exerciseId: 'ex_1', name: 'Barbell Back Squat', status: 'Pending', videoUrl: null, feedback: null },
      { exerciseId: 'ex_2', name: 'Dumbbell Romanian Deadlift', status: 'Approved', videoUrl: 'https://example.com/vid1.mp4', feedback: 'Good hinge, keep lats tight.' }
    ],
    schedule: [
      { week: 1, day: 'Monday', sessionId: 'sess_1' },
      { week: 1, day: 'Wednesday', sessionId: 'sess_2' },
      { week: 2, day: 'Monday', sessionId: 'sess_1' },
      { week: 2, day: 'Wednesday', sessionId: 'sess_2' }
    ]
  },
  {
    id: 'ph_2',
    clientId: 'client_2',
    name: 'Strength Prep',
    goal: 'Neurological adaptation for heavy loads',
    startDate: '2026-02-15',
    durationWeeks: 6,
    status: 'Active',
    movementChecks: [],
    schedule: [
      { week: 1, day: 'Tuesday', sessionId: 'sess_3' },
      { week: 1, day: 'Thursday', sessionId: 'sess_4' }
    ]
  }
];

// Sessions within phases
export const sessionsData = [
  {
    id: 'sess_1',
    phaseId: 'ph_1',
    name: 'Lower Body Primary',
    description: 'Focus on quad and glute development',
    completedInstances: [], // e.g., ['w1_sess_1']
    sections: [
      {
        id: 'sec_1',
        name: 'A. Primary Movement',
        order: 1,
        exercises: [
          { id: 'ex_1', templateId: 'ex_t_1', name: 'Barbell Back Squat', sets: 4, reps: '8-10', load: 'Auto', tempo: '3010', rest: '120s', rpe: '7-8', notes: 'Deep range of motion' }
        ]
      },
      {
        id: 'sec_2',
        name: 'B. Secondary Posterior',
        order: 2,
        exercises: [
          { id: 'ex_2', templateId: 'ex_t_2', name: 'Dumbbell Romanian Deadlift', sets: 3, reps: '10-12', load: 'Auto', tempo: '3010', rest: '90s', rpe: '8', notes: 'Slight knee bend' }
        ]
      }
    ]
  },
  {
    id: 'sess_2',
    phaseId: 'ph_1',
    name: 'Upper Body Primary',
    description: 'Back and chest focus',
    completedInstances: [],
    sections: [
      {
        id: 'sec_3',
        name: 'A. Vertical Pull',
        order: 1,
        exercises: [
          { id: 'ex_3', templateId: 'ex_t_3', name: 'Pull-up', sets: 4, reps: 'AMRAP', load: 'Bodyweight', tempo: '2010', rest: '90s', rpe: '9', notes: 'Full extension at bottom' }
        ]
      }
    ]
  },
  {
    id: 'sess_3',
    phaseId: 'ph_2',
    name: 'Heavy Lower',
    description: 'Strength focus',
    completedInstances: ['w1_sess_3'], // Example completion
    sections: [
      {
        id: 'sec_4',
        name: 'A. Squat Pattern',
        order: 1,
        exercises: [
          { id: 'ex_4', templateId: 'ex_t_1', name: 'Barbell Back Squat', sets: 5, reps: '5', load: '85% 1RM', tempo: '2010', rest: '180s', rpe: '8', notes: '' }
        ]
      }
    ]
  }
];

// Client Logs (attached to specific scheduled instances)
export const clientLogsData = [
  {
    id: 'log_1',
    clientId: 'client_2',
    phaseId: 'ph_2',
    instanceId: 'w1_sess_3', // e.g., week 1, session 3
    exerciseId: 'ex_4',
    date: '2026-02-17',
    sets: [
      { setNumber: 1, weight: 225, reps: 5, rpe: 7.5 },
      { setNumber: 2, weight: 235, reps: 5, rpe: 8 },
      { setNumber: 3, weight: 245, reps: 5, rpe: 8.5 },
      { setNumber: 4, weight: 245, reps: 5, rpe: 9 },
      { setNumber: 5, weight: 245, reps: 4, rpe: 10 }
    ],
    clientNotes: 'Felt heavy today, missed last rep on set 5.'
  }
];

// Chat Data
export const chatsData = [
  { id: 'msg_1', clientId: 'client_1', sender: 'Head Coach', text: 'Hey Sarah, your new phase is in draft. Waiting on that squat video.', time: '2026-02-28 10:00', isClient: false },
  { id: 'msg_2', clientId: 'client_1', sender: 'Sarah Connor', text: 'Will upload it tomorrow during my session!', time: '2026-02-28 14:30', isClient: true },
];
