import { useState } from "react";
import { Link, useRoute } from "wouter";
import { phasesData, sessionsData, exerciseTemplates } from "@/lib/mock-data";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dumbbell, Plus, GripVertical, Trash2, ArrowLeft, Save, PlayCircle, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function AdminPhaseBuilder() {
  const [, params] = useRoute("/app/admin/clients/:clientId/builder/:phaseId");
  const isNew = params?.phaseId === 'new';
  
  // Minimal state for demo purposes - referencing the provided design
  const [phaseName, setPhaseName] = useState(isNew ? "New Phase" : "Hypertrophy Block 1");
  
  // Exercise row component matching the provided reference screenshot
  const ExerciseRow = ({ name, sets, reps, load, rpe, tempo, rest }: any) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3 shadow-sm group">
      {/* Header bar */}
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
      
      {/* Prescription Grid matching the UI reference */}
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
      
      {/* Notes footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <Input placeholder="Add coaching notes or cues..." className="h-8 text-sm bg-white border-slate-200 text-slate-600" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 animate-in fade-in">
      {/* Topbar */}
      <div className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200 py-4 -mx-6 px-6 md:-mx-8 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/app/admin/clients/${params?.clientId}`}>
            <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-200"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="font-semibold text-slate-900">Builder</div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">Save Draft</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6">
            <Save className="mr-2 h-4 w-4" /> Publish Phase
          </Button>
        </div>
      </div>

      {/* Phase Settings */}
      <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
          <Input 
            value={phaseName} 
            onChange={(e) => setPhaseName(e.target.value)}
            className="text-2xl font-display font-bold bg-transparent border-none text-white focus-visible:ring-0 px-0 h-auto placeholder:text-slate-500"
            placeholder="Phase Name"
          />
        </div>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-600">Goal</Label>
            <Input defaultValue="Build base muscle mass" className="bg-slate-50" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600">Duration (Weeks)</Label>
            <Select defaultValue="4">
              <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
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

      {/* Movement Session Editor Container */}
      <div className="mt-12 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-display font-bold text-slate-900">Session 1: Lower Body Primary</h2>
          <Button variant="outline" size="sm" className="bg-white"><Plus className="mr-2 h-4 w-4" /> Add Session</Button>
        </div>

        {/* Section Wrapper */}
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
        
        <div className="flex justify-center mt-8">
          <Button variant="outline" className="border-dashed bg-white shadow-sm rounded-full px-6">
            <Plus className="mr-2 h-4 w-4" /> Add New Block (Section)
          </Button>
        </div>
      </div>
    </div>
  );
}
