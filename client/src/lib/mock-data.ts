// Mock data for the SaaS template

export const currentUser = {
  id: 'u1',
  name: 'Alex Developer',
  email: 'alex@example.com',
  role: 'Admin',
  avatar: 'https://i.pravatar.cc/150?u=alex',
};

export const currentWorkspace = {
  id: 'w1',
  name: 'Acme Corp',
  logo: 'https://ui-avatars.com/api/?name=Acme+Corp&background=0D8ABC&color=fff',
  plan: 'Pro',
};

export const projectsData = [
  { id: 'p1', name: 'Website Redesign', status: 'In Progress', dueDate: '2026-03-15', assignee: 'Alex Developer' },
  { id: 'p2', name: 'Q1 Marketing Campaign', status: 'Planning', dueDate: '2026-04-01', assignee: 'Sam Smith' },
  { id: 'p3', name: 'API V2 Release', status: 'Completed', dueDate: '2026-02-20', assignee: 'Taylor Jones' },
];

export const tasksData = [
  { id: 't1', projectId: 'p1', title: 'Design system updates', status: 'Done' },
  { id: 't2', projectId: 'p1', title: 'Implement new landing page', status: 'In Progress' },
  { id: 't3', projectId: 'p2', title: 'Draft email copy', status: 'Todo' },
];

export const messagesData = [
  { id: 'm1', channel: 'general', sender: 'Sam Smith', content: 'Hey team, welcome to the new workspace!', time: '10:00 AM' },
  { id: 'm2', channel: 'general', sender: 'Alex Developer', content: 'Thanks Sam, looks great!', time: '10:05 AM' },
  { id: 'm3', channel: 'design', sender: 'Taylor Jones', content: 'I uploaded the new assets to the files section.', time: '11:30 AM' },
];

export const calendarData = [
  { id: 'e1', title: 'Team Sync', date: new Date().toISOString().split('T')[0], time: '10:00 AM', participants: ['Alex', 'Sam', 'Taylor'] },
  { id: 'e2', title: 'Product Review', date: new Date(Date.now() + 86400000).toISOString().split('T')[0], time: '2:00 PM', participants: ['Alex', 'Sam'] },
];

export const filesData = [
  { id: 'f1', name: 'Q1_Report.pdf', size: '2.4 MB', type: 'pdf', uploadedBy: 'Sam Smith', date: '2026-02-25' },
  { id: 'f2', name: 'Design_Assets.zip', size: '15 MB', type: 'zip', uploadedBy: 'Taylor Jones', date: '2026-02-26' },
  { id: 'f3', name: 'Client_List.csv', size: '120 KB', type: 'csv', uploadedBy: 'Alex Developer', date: '2026-02-28' },
];

export const usersData = [
  { id: 'u1', name: 'Alex Developer', email: 'alex@example.com', role: 'Admin', status: 'Active' },
  { id: 'u2', name: 'Sam Smith', email: 'sam@acme.com', role: 'Client', status: 'Active' },
  { id: 'u3', name: 'Taylor Jones', email: 'taylor@acme.com', role: 'Client', status: 'Invited' },
];

export const trainingPlansData = [
  { id: 'tp1', clientId: 'u2', goal: 'Strength & Hypertrophy', startDate: '2026-03-01', durationWeeks: 4, status: 'Active' },
  { id: 'tp2', clientId: 'u3', goal: 'Endurance', startDate: '2026-02-15', durationWeeks: 8, status: 'Active' }
];

export const trainingSessionsData = [
  { id: 'ts1', planId: 'tp1', week: 1, day: 'Monday', name: 'Upper Body Power', completed: true },
  { id: 'ts2', planId: 'tp1', week: 1, day: 'Wednesday', name: 'Lower Body Power', completed: false },
  { id: 'ts3', planId: 'tp1', week: 1, day: 'Friday', name: 'Full Body Hypertrophy', completed: false },
  { id: 'ts4', planId: 'tp2', week: 1, day: 'Tuesday', name: 'Long Run', completed: true },
  { id: 'ts5', planId: 'tp2', week: 1, day: 'Thursday', name: 'Intervals', completed: false }
];

export const exercisesData = [
  { id: 'ex1', sessionId: 'ts1', name: 'Bench Press', sets: 4, reps: '5', load: '185 lbs', rpe: '8' },
  { id: 'ex2', sessionId: 'ts1', name: 'Barbell Row', sets: 4, reps: '6-8', load: '135 lbs', rpe: '7' },
  { id: 'ex3', sessionId: 'ts2', name: 'Squat', sets: 4, reps: '5', load: '225 lbs', rpe: '8' },
  { id: 'ex4', sessionId: 'ts2', name: 'Deadlift', sets: 3, reps: '5', load: '275 lbs', rpe: '8.5' },
];