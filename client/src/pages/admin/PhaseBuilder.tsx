import { useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { phasesQuery, sessionsQuery, exerciseTemplatesQuery, useUpdatePhase, useCreatePhase, useCreateSession } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dumbbell, Plus, GripVertical, Trash2, ArrowLeft, Save, PlayCircle, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function AdminPhaseBuilder() {
  const [, params] = useRoute("/app/admin/clients/:clientId/builder/:phaseId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = params?.phaseId === 'new';
  
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const updatePhase = useUpdatePhase();
  const createPhase = useCreatePhase();
  const createSession = useCreateSession();
  
  const existingPhase = allPhases.find((p: any) => p.id === params?.phaseId);
  const phaseSessions = allSessions.filter((s: any) => s.phaseId === params?.phaseId);
  
  const [phaseName, setPhaseName] = useState(existingPhase?.name || "New Phase");
  const [goal, setGoal] = useState(existingPhase?.goal || "");
  const [durationWeeks, setDurationWeeks] = useState(String(existingPhase?.durationWeeks || 4));
  
  useEffect(() => {
    if (existingPhase) {
      setPhaseName(existingPhase.name);
      setGoal(existingPhase.goal || "");
      setDurationWeeks(String(existingPhase.durationWeeks));
    }
  }, [existingPhase]);

  const handleSave = async () => {
    if (!isNew && params?.phaseId) {
      updatePhase.mutate({
        id: params.phaseId,
        name: phaseName,
        goal,
        durationWeeks: parseInt(durationWeeks),
        status: 'Active',
      });
      toast({
        title: "Phase Published",
        description: "The phase has been saved and is now active for the client.",
      });
      setLocation(`/app/admin/clients/${params.clientId}`);
    } else if (isNew && params?.clientId) {
      createPhase.mutate({
        clientId: params.clientId,
        name: phaseName,
        goal,
        durationWeeks: parseInt(durationWeeks),
        startDate: new Date().toISOString().split('T')[0],
        status: 'Draft',
        movementChecks: [],
        schedule: [],
      }, {
        onSuccess: (phase: any) => {
          toast({
            title: "Phase Created",
            description: "Your new phase has been created.",
          });
          setLocation(`/app/admin/clients/${params.clientId}/builder/${phase.id}`);
        }
      });
    }
  };
  
  const ExerciseRow = ({ name, sets, reps, load, rpe, tempo, rest }: any) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3 shadow-sm group">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="cursor-move text-slate-400 hover:text-slate-600">
            <GripVertical className="h-5 w-5" />
          </div>
          <div className="font-semibold text-slate-900">{name}</div>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-normal">Strength</Badge>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600"><PlayCircle className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      
      <div className="p-4 bg-white grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sets</Label>
          <Input defaultValue={sets} className="h-9 bg-slate-50 border-slate-200 font-medium" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Reps</Label>
          <Input defaultValue={reps} className="h-9 bg-slate-50 border-slate-200 font-medium" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Load (Guidance)</Label>
          <Input defaultValue={load || "Auto"} className="h-9 bg-slate-50 border-slate-200 text-indigo-700 font-medium" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">RPE / RIR</Label>
          <Input defaultValue={rpe} className="h-9 bg-slate-50 border-slate-200 font-medium" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tempo</Label>
          <Input defaultValue={tempo} className="h-9 bg-slate-50 border-slate-200" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Rest</Label>
          <Input defaultValue={rest} className="h-9 bg-slate-50 border-slate-200" />
        </div>
      </div>
      
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <Input placeholder="Add coaching notes or cues..." className="h-8 text-sm bg-white border-slate-200 text-slate-600" />
      </div>
    </div>
  );

  const displaySessions = phaseSessions.length > 0 ? phaseSessions : (existingPhase ? [] : []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 animate-in fade-in">
      <div className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200 py-4 -mx-6 px-6 md:-mx-8 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/app/admin/clients/${params?.clientId}`}>
            <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-200" data-testid="button-back-client"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="font-semibold text-slate-900">Builder</div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white" onClick={() => toast({ title: "Draft Saved" })} data-testid="button-save-draft">Save Draft</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6" onClick={handleSave} data-testid="button-publish-phase">
            <Save className="mr-2 h-4 w-4" /> {isNew ? 'Create Phase' : 'Publish Phase'}
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
          <Input 
            value={phaseName} 
            onChange={(e) => setPhaseName(e.target.value)}
            className="text-2xl font-display font-bold bg-transparent border-none text-white focus-visible:ring-0 px-0 h-auto placeholder:text-slate-500"
            placeholder="Phase Name"
            data-testid="input-phase-name"
          />
        </div>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-600">Goal</Label>
            <Input value={goal} onChange={e => setGoal(e.target.value)} className="bg-slate-50" data-testid="input-phase-goal" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600">Duration (Weeks)</Label>
            <Select value={durationWeeks} onValueChange={setDurationWeeks}>
              <SelectTrigger className="bg-slate-50" data-testid="select-duration"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[4,6,8,12].map(w => <SelectItem key={w} value={w.toString()}>{w} Weeks</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600">Movement Check Gate</Label>
            <Select defaultValue="yes">
              <SelectTrigger className="bg-slate-50 border-amber-200 text-amber-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Require video approval before start</SelectItem>
                <SelectItem value="no">Bypass (Go online immediately)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {displaySessions.map((session: any, idx: number) => (
        <div key={session.id} className="mt-12 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-display font-bold text-slate-900">Session {idx + 1}: {session.name}</h2>
            <Button variant="outline" size="sm" className="bg-white"><Plus className="mr-2 h-4 w-4" /> Add Session</Button>
          </div>

          {(session.sections as any[]).map((section: any) => (
            <div key={section.id} className="border-2 border-slate-200 rounded-2xl bg-slate-100/50 p-4 relative">
              <div className="absolute -left-3 -top-3 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{section.name}</div>
              
              <div className="mt-4">
                {section.exercises.map((ex: any) => (
                  <ExerciseRow key={ex.id} name={ex.name} sets={ex.sets} reps={ex.reps} rpe={ex.rpe} tempo={ex.tempo} rest={ex.rest} load={ex.load} />
                ))}
              </div>
              
              <Button variant="outline" className="w-full mt-2 border-dashed border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300">
                <Plus className="mr-2 h-4 w-4" /> Add Exercise
              </Button>
            </div>
          ))}
        </div>
      ))}

      {displaySessions.length === 0 && !isNew && (
        <div className="mt-12 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-display font-bold text-slate-900">Session 1: Lower Body Primary</h2>
            <Button variant="outline" size="sm" className="bg-white"><Plus className="mr-2 h-4 w-4" /> Add Session</Button>
          </div>
          <div className="border-2 border-slate-200 rounded-2xl bg-slate-100/50 p-4 relative">
            <div className="absolute -left-3 -top-3 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">A. Primary Block</div>
            <div className="mt-4">
              <ExerciseRow name="Barbell Back Squat" sets="4" reps="8-10" rpe="8" tempo="3010" rest="120s" load="80% 1RM" />
            </div>
            <Button variant="outline" className="w-full mt-2 border-dashed border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300">
              <Plus className="mr-2 h-4 w-4" /> Add Exercise to Block A
            </Button>
          </div>
          <div className="border-2 border-slate-200 rounded-2xl bg-slate-100/50 p-4 relative mt-8">
            <div className="absolute -left-3 -top-3 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">B. Secondary Block</div>
            <div className="mt-4">
              <ExerciseRow name="Dumbbell Romanian Deadlift" sets="3" reps="10-12" rpe="8" tempo="3010" rest="90s" load="Auto" />
              <ExerciseRow name="Bulgarian Split Squat" sets="3" reps="10/leg" rpe="8.5" tempo="2010" rest="90s" load="Auto" />
            </div>
            <Button variant="outline" className="w-full mt-2 border-dashed border-slate-300 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300">
              <Plus className="mr-2 h-4 w-4" /> Add Exercise to Block B
            </Button>
          </div>
        </div>
      )}
      
      <div className="flex justify-center mt-8">
        <Button variant="outline" className="border-dashed bg-white shadow-sm rounded-full px-6">
          <Plus className="mr-2 h-4 w-4" /> Add New Block (Section)
        </Button>
      </div>
    </div>
  );
}
