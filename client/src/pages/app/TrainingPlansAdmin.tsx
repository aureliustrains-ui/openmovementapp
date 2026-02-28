import { useState } from "react";
import { usersData, trainingPlansData, trainingSessionsData } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, Plus, Sparkles, User, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TrainingPlansAdmin() {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const clients = usersData.filter(u => u.role === 'Client');
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 flex items-center gap-3">
            <Dumbbell className="h-8 w-8 text-indigo-600" />
            Training Plans
          </h1>
          <p className="text-slate-500">Manage and assign training plans to your clients.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Sparkles className="mr-2 h-4 w-4" /> Generate Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Generate Training Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Goal</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strength">Strength & Hypertrophy</SelectItem>
                    <SelectItem value="endurance">Endurance & Cardio</SelectItem>
                    <SelectItem value="fat_loss">Fat Loss</SelectItem>
                    <SelectItem value="general">General Fitness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (Weeks)</Label>
                  <Input type="number" defaultValue="4" />
                </div>
                <div className="space-y-2">
                  <Label>Frequency (Days/Wk)</Label>
                  <Input type="number" defaultValue="3" />
                </div>
              </div>
              <Button className="w-full mt-4">Generate & Assign</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <h3 className="font-semibold text-slate-900">Clients</h3>
          <div className="space-y-2">
            {clients.map(client => (
              <Card 
                key={client.id} 
                className={`cursor-pointer transition-colors ${selectedClient === client.id ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'hover:border-indigo-300'}`}
                onClick={() => setSelectedClient(client.id)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{client.name}</div>
                      <div className="text-xs text-slate-500">{client.email}</div>
                    </div>
                  </div>
                  <ArrowRight className={`h-4 w-4 ${selectedClient === client.id ? 'text-indigo-600' : 'text-slate-300'}`} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedClient ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-lg">Client Plans</h3>
                <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> Blank Plan</Button>
              </div>
              
              {trainingPlansData.filter(p => p.clientId === selectedClient).map(plan => (
                <Card key={plan.id} className="border-slate-200">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="mb-2 bg-indigo-100 text-indigo-800 hover:bg-indigo-100">{plan.status}</Badge>
                        <CardTitle className="text-xl">{plan.goal}</CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-2">
                          <span className="flex items-center"><CalendarIcon className="h-3.5 w-3.5 mr-1" /> Starts {plan.startDate}</span>
                          <span>{plan.durationWeeks} Weeks</span>
                        </CardDescription>
                      </div>
                      <Button variant="secondary" size="sm">Edit Plan</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {trainingSessionsData.filter(s => s.planId === plan.id).map(session => (
                        <div key={session.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <div className="font-medium text-slate-900">{session.name}</div>
                            <div className="text-sm text-slate-500">Week {session.week} • {session.day}</div>
                          </div>
                          <Badge variant={session.completed ? "default" : "outline"} className={session.completed ? "bg-green-500 hover:bg-green-600" : ""}>
                            {session.completed ? "Completed" : "Scheduled"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {trainingPlansData.filter(p => p.clientId === selectedClient).length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Dumbbell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-slate-900">No active plans</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mt-1 mb-4">This client doesn't have any training plans yet. Generate one to get them started.</p>
                  <Button variant="outline"><Sparkles className="mr-2 h-4 w-4" /> Generate Plan</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 bg-white rounded-xl border border-dashed border-slate-200">
              <User className="h-16 w-16 mb-4 opacity-20" />
              <p>Select a client to view or manage their training plans.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
