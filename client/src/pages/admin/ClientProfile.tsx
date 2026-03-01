import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usersQuery, phasesQuery, sessionsQuery, useUpdatePhase } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Plus, MessageCircle, PlayCircle, Settings, CheckCircle2, ChevronLeft, ArrowRight, BarChart, Repeat, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";

export default function AdminClientProfile() {
  const [, params] = useRoute("/app/admin/clients/:id");
  const [, setLocation] = useLocation();
  const clientId = params?.id;
  
  const { data: allUsers = [] } = useQuery(usersQuery);
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { impersonate } = useAuth();
  const updatePhase = useUpdatePhase();
  
  const client = allUsers.find((u: any) => u.id === clientId);
  const clientPhases = allPhases.filter((p: any) => p.clientId === clientId);
  const activePhase = clientPhases.find((p: any) => p.status === 'Active' || p.status === 'Waiting for Movement Check');
  const pastPhases = clientPhases.filter((p: any) => p.status === 'Completed' || p.status === 'Archived');

  if (!client) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );

  const handleApproveMovementCheck = (phaseId: string, exerciseId: string, videoUrl: string) => {
    const phase = allPhases.find((p: any) => p.id === phaseId);
    if (!phase) return;
    
    const updatedChecks = (phase.movementChecks as any[]).map((mc: any) => {
      if (mc.exerciseId !== exerciseId) return mc;
      return { ...mc, status: 'Approved', videoUrl, feedback: 'Looking great, ready to go!' };
    });

    const allApproved = updatedChecks.every((mc: any) => mc.status === 'Approved');
    
    updatePhase.mutate({
      id: phaseId,
      movementChecks: updatedChecks,
      ...(allApproved ? { status: 'Active' } : {}),
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        <div className="flex items-center gap-6">
          <Link href="/app/admin/clients">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm shrink-0" data-testid="button-back-clients">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-white shadow-md">
              <AvatarImage src={client.avatar} />
              <AvatarFallback className="text-2xl bg-indigo-100 text-indigo-700">{client.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-client-profile-name">{client.name}</h1>
              <p className="text-slate-500 mt-1">{client.email}</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={() => {
              if (client) {
                impersonate(client);
                setLocation("/app/client/my-phase");
              }
            }}
            data-testid="button-impersonate"
          >
            <Repeat className="mr-2 h-4 w-4" /> Impersonate
          </Button>
          <Button variant="outline" className="bg-white" data-testid="button-message-client"><MessageCircle className="mr-2 h-4 w-4" /> Message</Button>
          <Button variant="outline" className="bg-white"><Settings className="mr-2 h-4 w-4" /> Edit Profile</Button>
        </div>
      </div>

      <Tabs defaultValue="programming" className="w-full">
        <TabsList className="bg-slate-200/50 p-1 rounded-xl w-full justify-start overflow-x-auto h-12">
          <TabsTrigger value="programming" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6" data-testid="tab-programming">Programming</TabsTrigger>
          <TabsTrigger value="movement" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6" data-testid="tab-movement">Movement Checks</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6" data-testid="tab-logs">Logs & History</TabsTrigger>
        </TabsList>
        
        <div className="mt-8">
          <TabsContent value="programming" className="space-y-8 m-0 outline-none">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold text-slate-900">Current Phase</h2>
                {!activePhase && (
                  <Link href={`/app/admin/clients/${clientId}/builder/new`}>
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full" data-testid="button-create-phase"><Plus className="mr-2 h-4 w-4" /> Create Phase</Button>
                  </Link>
                )}
              </div>

              {activePhase ? (
                <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={activePhase.status === 'Waiting for Movement Check' ? 'destructive' : 'default'} 
                          className={activePhase.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-green-200 border-none' : 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-none'}
                          data-testid="badge-phase-status">
                          {activePhase.status}
                        </Badge>
                        <span className="text-sm font-medium text-slate-500">Week 1 of {activePhase.durationWeeks}</span>
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900" data-testid="text-phase-name">{activePhase.name}</h3>
                      <p className="text-slate-600 mt-1">{activePhase.goal}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Link href={`/app/admin/clients/${clientId}/builder/${activePhase.id}`}>
                        <Button variant="outline" className="bg-white" data-testid="button-edit-phase">Edit Structure</Button>
                      </Link>
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Weekly Schedule</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(activePhase.schedule as any[]).filter((s: any) => s.week === 1).map((sched: any, i: number) => {
                        const session = allSessions.find((s: any) => s.id === sched.sessionId);
                        return (
                          <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors" data-testid={`card-schedule-${i}`}>
                            <div className="text-xs font-semibold text-indigo-600 mb-1">{sched.day}</div>
                            <div className="font-medium text-slate-900 mb-2">{session?.name}</div>
                            <div className="text-xs text-slate-500">{(session?.sections as any[])?.length} Sections</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                  <Dumbbell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900">No Active Phase</h3>
                  <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">This client doesn't have an active training phase. Build one from scratch or use a template.</p>
                  <Link href={`/app/admin/clients/${clientId}/builder/new`}>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" data-testid="button-build-phase">Build Phase</Button>
                  </Link>
                </div>
              )}
            </div>

            {pastPhases.length > 0 && (
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900 mb-4">Phase History</h2>
                <div className="space-y-3">
                  {pastPhases.map((phase: any) => (
                    <Card key={phase.id} className="border-slate-200 shadow-none hover:bg-slate-50 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{phase.name}</div>
                          <div className="text-sm text-slate-500">{phase.durationWeeks} Weeks • Completed</div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-400" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="movement" className="m-0 outline-none">
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle>Movement Checks Required</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activePhase && (activePhase.movementChecks as any[]).length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {(activePhase.movementChecks as any[]).map((mc: any, i: number) => (
                      <div key={i} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between hover:bg-slate-50/50 transition-colors" data-testid={`movement-check-${i}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className={
                              mc.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                              mc.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700'
                            }>
                              {mc.status}
                            </Badge>
                          </div>
                          <h4 className="font-semibold text-lg text-slate-900">{mc.name}</h4>
                          {mc.feedback && <p className="text-sm text-slate-600 mt-2 bg-slate-100 p-3 rounded-lg border border-slate-200">"{mc.feedback}"</p>}
                        </div>
                        
                        <div className="shrink-0 flex items-center gap-3">
                          {mc.videoUrl ? (
                            <Button variant="outline" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200" data-testid={`button-watch-video-${i}`}>
                              <PlayCircle className="mr-2 h-4 w-4" /> Watch Video
                            </Button>
                          ) : (
                            <div className="text-sm text-slate-400 italic">No video submitted</div>
                          )}
                          {mc.status === 'Pending' && mc.videoUrl && (
                            <Button 
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApproveMovementCheck(activePhase.id, mc.exerciseId, mc.videoUrl)}
                              data-testid={`button-approve-${i}`}
                            >
                              Review & Approve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500">
                    <CheckCircle2 className="h-12 w-12 text-green-200 mx-auto mb-3" />
                    <p>No pending movement checks.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="logs" className="m-0 outline-none">
            <div className="text-center py-20 text-slate-500 bg-white rounded-2xl border border-slate-200">
              <BarChart className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">Workout Logs</h3>
              <p className="mt-1">Detailed session logs will appear here once the client starts tracking.</p>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
