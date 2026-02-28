import { useState } from "react";
import { trainingPlansData, trainingSessionsData, exercisesData, currentUser } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckCircle2, Circle, Dumbbell, Activity, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrainingPlanClient() {
  const [activeSession, setActiveSession] = useState<string | null>(null);

  // In a real app, this would filter by the logged-in user.
  // We'll use the first available plan for the current client, or fallback to tp1 for demo if they are an admin testing it out.
  const myPlans = trainingPlansData.filter(p => p.clientId === currentUser.id);
  const activePlan = myPlans.length > 0 ? myPlans[0] : trainingPlansData[0];
  
  const mySessions = trainingSessionsData.filter(s => s.planId === activePlan?.id);

  if (!activePlan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-slate-200">
        <Dumbbell className="h-16 w-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-display font-bold text-slate-900">No Training Plan</h2>
        <p className="text-slate-500 mt-2 max-w-md">You don't have an active training plan assigned yet. Check back later or contact your coach.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <Dumbbell className="h-64 w-64 -mt-10 -mr-10 transform rotate-12" />
        </div>
        <div className="relative z-10">
          <Badge className="bg-indigo-500/50 hover:bg-indigo-500/50 border-none text-indigo-50 mb-4 backdrop-blur-sm">
            Active Plan
          </Badge>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">{activePlan.goal}</h1>
          <div className="flex flex-wrap items-center gap-4 text-indigo-100 mt-4">
            <span className="flex items-center"><CalendarIcon className="h-4 w-4 mr-2" /> Started {activePlan.startDate}</span>
            <span className="flex items-center"><CalendarDays className="h-4 w-4 mr-2" /> {activePlan.durationWeeks} Weeks</span>
            <span className="flex items-center"><Activity className="h-4 w-4 mr-2" /> {mySessions.length} Sessions Total</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">Your Schedule</h3>
          <div className="space-y-3">
            {mySessions.map(session => (
              <Card 
                key={session.id} 
                className={`cursor-pointer transition-all ${activeSession === session.id ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500 bg-indigo-50/10' : 'hover:border-indigo-200'}`}
                onClick={() => setActiveSession(session.id)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="mt-1">
                    {session.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <div>
                    <div className={`font-medium ${session.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {session.name}
                    </div>
                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-normal">Week {session.week}</Badge>
                      {session.day}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {activeSession ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-2xl font-display font-bold text-slate-900">
                    {mySessions.find(s => s.id === activeSession)?.name}
                  </h2>
                  <p className="text-slate-500 mt-1">Review your exercises and targets for this session.</p>
                </div>
                <Button variant={mySessions.find(s => s.id === activeSession)?.completed ? "outline" : "default"}>
                  {mySessions.find(s => s.id === activeSession)?.completed ? "Mark Incomplete" : "Mark as Done"}
                </Button>
              </div>

              <div className="space-y-4">
                {exercisesData.filter(e => e.sessionId === activeSession).map((exercise, index) => (
                  <Card key={exercise.id} className="border-none shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-4 p-4 border-b border-slate-50">
                        <div className="h-8 w-8 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <h4 className="font-semibold text-lg text-slate-900">{exercise.name}</h4>
                      </div>
                      <div className="bg-slate-50/50 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Sets</div>
                          <div className="font-semibold text-slate-900">{exercise.sets}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Reps</div>
                          <div className="font-semibold text-slate-900">{exercise.reps}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Target Load</div>
                          <div className="font-semibold text-indigo-600">{exercise.load}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Target RPE</div>
                          <div className="font-semibold text-slate-900">{exercise.rpe}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {exercisesData.filter(e => e.sessionId === activeSession).length === 0 && (
                  <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                    No exercises have been added to this session yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              <Activity className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-slate-600">Select a Session</p>
              <p className="text-sm mt-1 max-w-xs text-center">Click on a session from your schedule to view the exercises and targets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
