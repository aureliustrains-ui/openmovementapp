import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usersQuery, phasesQuery, sessionsQuery, useUpdatePhase, useDeletePhase, messagesQuery, useSendMessage, useMarkChatRead } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Plus, MessageCircle, PlayCircle, Settings, CheckCircle2, ChevronLeft, ArrowRight, BarChart, Repeat, Loader2, XCircle, Clock, ExternalLink, Send, Pencil, CalendarDays, Trash2, Archive, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ComingSoonDialog } from "@/components/ComingSoonDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isPhaseReadyToActivate(phase: any): boolean {
  const checks = (phase.movementChecks as any[]) || [];
  if (checks.length === 0) return true;
  return checks.every((mc: any) => mc.status === 'Approved');
}

function getPhaseDisplayStatus(phase: any): string {
  if (phase.status === 'Waiting for Movement Check' && isPhaseReadyToActivate(phase)) {
    return 'Ready to Activate';
  }
  return phase.status;
}

function getStatusColor(displayStatus: string): string {
  if (displayStatus === 'Active') return 'bg-green-100 text-green-700 border-green-200';
  if (displayStatus === 'Ready to Activate') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (displayStatus === 'Waiting for Movement Check') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (displayStatus === 'Draft') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

export default function AdminClientProfile() {
  const [, params] = useRoute("/app/admin/clients/:id");
  const [, setLocation] = useLocation();
  const clientId = params?.id;
  const { toast } = useToast();
  
  const { data: allUsers = [] } = useQuery(usersQuery);
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { impersonate } = useAuth();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("programming");
  const [chatMessage, setChatMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetPhase, setDeleteTargetPhase] = useState<any>(null);
  const [finishTargetPhase, setFinishTargetPhase] = useState<any>(null);
  const [finishing, setFinishing] = useState(false);
  const [activateTargetPhase, setActivateTargetPhase] = useState<any>(null);
  const [activating, setActivating] = useState(false);
  const [movementCheckPhaseId, setMovementCheckPhaseId] = useState<string | null>(null);

  const { data: chatMessages = [], isLoading: isChatLoading } = useQuery({
    ...messagesQuery(clientId || ""),
    enabled: !!clientId,
    refetchInterval: 5000,
  });
  const sendMessage = useSendMessage();
  const markRead = useMarkChatRead();

  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  useEffect(() => {
    if (activeTab === "chat" && user && clientId && chatMessages.length > 0) {
      markRead.mutate({ userId: user.id, clientId });
    }
  }, [activeTab, user?.id, clientId, chatMessages.length]);

  const client = allUsers.find((u: any) => u.id === clientId);
  const clientPhases = allPhases.filter((p: any) => p.clientId === clientId);
  const activePhases = clientPhases.filter((p: any) => p.status === 'Active');
  const pendingPhases = clientPhases.filter((p: any) => p.status === 'Waiting for Movement Check');
  const draftPhases = clientPhases.filter((p: any) => p.status === 'Draft');
  const completedPhases = clientPhases.filter((p: any) => p.status === 'Completed');

  const phasesWithMovementChecks = clientPhases.filter((p: any) =>
    (p.status === 'Waiting for Movement Check' || p.status === 'Active') &&
    (p.movementChecks as any[])?.length > 0
  );

  useEffect(() => {
    if (phasesWithMovementChecks.length > 0 && !movementCheckPhaseId) {
      setMovementCheckPhaseId(phasesWithMovementChecks[0].id);
    }
  }, [phasesWithMovementChecks, movementCheckPhaseId]);

  const selectedMovementPhase = allPhases.find((p: any) => p.id === movementCheckPhaseId);

  if (!client) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !clientId) return;

    sendMessage.mutate({
      clientId: clientId,
      sender: "Head Coach",
      text: chatMessage,
      time: new Date().toISOString(),
      isClient: false,
    });
    setChatMessage("");
  };

  const handleOpenApprove = (phaseId: string, exerciseId: string) => {
    setSelectedPhaseId(phaseId);
    setSelectedExerciseId(exerciseId);
    setApproveNote("");
    setIsApproveOpen(true);
  };

  const handleApproveMovementCheck = async () => {
    if (!selectedPhaseId || !selectedExerciseId) return;
    const phase = allPhases.find((p: any) => p.id === selectedPhaseId);
    if (!phase) return;
    
    setIsSubmitting(true);
    try {
      const updatedChecks = (phase.movementChecks as any[]).map((mc: any) => {
        if (mc.exerciseId !== selectedExerciseId) return mc;
        return {
          ...mc,
          status: 'Approved',
          decision: 'approved',
          approvedNote: approveNote || '',
          decidedAt: new Date().toISOString(),
        };
      });

      const allApproved = updatedChecks.every((mc: any) => mc.status === 'Approved');
      
      await updatePhase.mutateAsync({
        id: selectedPhaseId,
        movementChecks: updatedChecks,
      });

      toast({
        title: "Check Approved",
        description: allApproved ? "All checks approved — phase is ready to activate!" : "Movement check approved.",
      });
      setIsApproveOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve movement check.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReject = (phaseId: string, exerciseId: string) => {
    setSelectedPhaseId(phaseId);
    setSelectedExerciseId(exerciseId);
    setFeedback("");
    setIsRejectOpen(true);
  };

  const handleRejectMovementCheck = async () => {
    if (!selectedPhaseId || !selectedExerciseId) return;
    
    const phase = allPhases.find((p: any) => p.id === selectedPhaseId);
    if (!phase) return;

    setIsSubmitting(true);
    try {
      const updatedChecks = (phase.movementChecks as any[]).map((mc: any) => {
        if (mc.exerciseId !== selectedExerciseId) return mc;
        return {
          ...mc,
          status: 'Needs Resubmission',
          decision: 'resubmit',
          resubmitFeedback: feedback,
          decidedAt: new Date().toISOString(),
        };
      });

      await updatePhase.mutateAsync({
        id: selectedPhaseId,
        movementChecks: updatedChecks,
      });

      toast({
        title: "Feedback Sent",
        description: "Client has been notified to re-upload.",
      });
      setIsRejectOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send feedback.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivatePhase = async () => {
    if (activating || !activateTargetPhase) return;
    setActivating(true);
    try {
      for (const ap of activePhases) {
        await updatePhase.mutateAsync({
          id: ap.id,
          status: 'Completed',
        });
      }

      await updatePhase.mutateAsync({
        id: activateTargetPhase.id,
        status: 'Active',
      });

      const finishedNames = activePhases.map((p: any) => `"${p.name}"`).join(', ');
      toast({
        title: "Phase Activated",
        description: activePhases.length > 0
          ? `"${activateTargetPhase.name}" is now active. ${finishedNames} moved to completed.`
          : `"${activateTargetPhase.name}" is now active.`,
      });
      setActivateTargetPhase(null);
    } catch (err) {
      toast({ title: "Error", description: "Failed to activate phase.", variant: "destructive" });
    } finally {
      setActivating(false);
    }
  };

  const handleFinishPhase = async () => {
    if (finishing || !finishTargetPhase) return;
    setFinishing(true);
    try {
      await updatePhase.mutateAsync({
        id: finishTargetPhase.id,
        status: 'Completed',
      });
      toast({ title: "Phase Completed", description: `"${finishTargetPhase.name}" has been marked as completed.` });
      setFinishTargetPhase(null);
    } catch (err) {
      toast({ title: "Error", description: "Failed to finish phase.", variant: "destructive" });
    } finally {
      setFinishing(false);
    }
  };

  const handleDeletePhase = async () => {
    if (deleting || !deleteTargetPhase) return;
    setDeleting(true);
    try {
      await deletePhase.mutateAsync(deleteTargetPhase.id);
      toast({ title: "Phase Deleted", description: `"${deleteTargetPhase.name}" and all associated data removed.` });
      setDeleteTargetPhase(null);
    } catch (err) {
      toast({ title: "Delete Failed", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const getSessionCount = (phaseId: string) => {
    return allSessions.filter((s: any) => s.phaseId === phaseId).length;
  };

  const renderPhaseCard = (phase: any) => {
    const displayStatus = getPhaseDisplayStatus(phase);
    const statusColor = getStatusColor(displayStatus);
    const ready = phase.status === 'Waiting for Movement Check' && isPhaseReadyToActivate(phase);
    const pendingChecks = phase.status === 'Waiting for Movement Check' && !ready;
    const checksInfo = (phase.movementChecks as any[]) || [];
    const approvedCount = checksInfo.filter((mc: any) => mc.status === 'Approved').length;

    return (
      <Card key={phase.id} className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white" data-testid={`card-phase-${phase.id}`}>
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={statusColor} data-testid={`badge-status-${phase.id}`}>
                {displayStatus}
              </Badge>
              <span className="text-sm font-medium text-slate-500">{phase.durationWeeks} weeks &middot; {getSessionCount(phase.id)} session(s)</span>
              {pendingChecks && checksInfo.length > 0 && (
                <span className="text-xs text-amber-600">{approvedCount}/{checksInfo.length} checks approved</span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-slate-900" data-testid={`text-phase-name-${phase.id}`}>{phase.name}</h3>
            {phase.goal && <p className="text-slate-600 mt-1">{phase.goal}</p>}
          </div>
          <div className="flex items-start gap-2 shrink-0 flex-wrap">
            <Link href={`/app/admin/clients/${clientId}/builder/${phase.id}`}>
              <Button variant="outline" className="bg-white" data-testid={`button-edit-${phase.id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
            </Link>
            {ready && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setActivateTargetPhase(phase)}
                data-testid={`button-activate-${phase.id}`}
              >
                <Zap className="mr-2 h-4 w-4" /> Activate
              </Button>
            )}
            {pendingChecks && (
              <Button
                variant="outline"
                className="text-amber-600 border-amber-200 cursor-not-allowed opacity-60"
                disabled
                data-testid={`button-activate-disabled-${phase.id}`}
                title="All movement checks must be approved before activating"
              >
                <Zap className="mr-2 h-4 w-4" /> Activate
              </Button>
            )}
            {phase.status === 'Active' && (
              <Button
                variant="outline"
                className="text-slate-600 border-slate-200 hover:bg-slate-50"
                onClick={() => setFinishTargetPhase(phase)}
                data-testid={`button-finish-${phase.id}`}
              >
                <Archive className="mr-2 h-4 w-4" /> Finish
              </Button>
            )}
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setDeleteTargetPhase(phase)}
              data-testid={`button-delete-${phase.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <CardContent className="p-6">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Weekly Schedule
          </h4>
          {(() => {
            const schedule = (phase.schedule as any[]) || [];
            const week1 = schedule.filter((s: any) => s.week === 1);
            if (week1.length === 0) {
              return <p className="text-sm text-slate-400 italic">No schedule assigned yet.</p>;
            }
            return (
              <div className="overflow-x-auto">
                <div className="min-w-[400px] grid grid-cols-[80px_1fr_1fr] border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-2 bg-slate-50 border-b border-r border-slate-200 text-[10px] font-semibold text-slate-400 uppercase" />
                  <div className="p-2 bg-slate-50 border-b border-r border-slate-200 text-[10px] font-semibold text-slate-400 uppercase text-center">AM</div>
                  <div className="p-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase text-center">PM</div>
                  {WEEKDAYS.map(day => {
                    const amEntries = week1.filter((s: any) => s.day === day && (s.slot || "AM") === "AM");
                    const pmEntries = week1.filter((s: any) => s.day === day && s.slot === "PM");
                    if (amEntries.length === 0 && pmEntries.length === 0) return null;
                    return [
                      <div key={`${day}-label`} className="p-2 border-b border-r border-slate-100 text-xs font-medium text-slate-600">{day.slice(0, 3)}</div>,
                      <div key={`${day}-am`} className="p-1.5 border-b border-r border-slate-100 flex flex-wrap gap-1">
                        {amEntries.map((e: any, i: number) => {
                          const s = allSessions.find((ss: any) => ss.id === e.sessionId);
                          return s ? <Badge key={i} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">{s.name}</Badge> : null;
                        })}
                      </div>,
                      <div key={`${day}-pm`} className="p-1.5 border-b border-slate-100 flex flex-wrap gap-1">
                        {pmEntries.map((e: any, i: number) => {
                          const s = allSessions.find((ss: any) => ss.id === e.sessionId);
                          return s ? <Badge key={i} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">{s.name}</Badge> : null;
                        })}
                      </div>
                    ];
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    );
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
          <Button variant="outline" className="bg-white" data-testid="button-message-client" onClick={() => setActiveTab("chat")}><MessageCircle className="mr-2 h-4 w-4" /> Message</Button>
          <Button variant="outline" className="bg-white" data-testid="button-edit-profile" onClick={() => setIsComingSoonOpen(true)}><Settings className="mr-2 h-4 w-4" /> Edit Profile</Button>
        </div>
      </div>

      <ComingSoonDialog 
        open={isComingSoonOpen} 
        onOpenChange={setIsComingSoonOpen}
        title="Edit Profile Coming Soon"
        description="The ability to manage client profile details directly is coming soon."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-200/50 p-1 rounded-xl w-full justify-start overflow-x-auto h-12">
          <TabsTrigger value="programming" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6" data-testid="tab-programming">Programming</TabsTrigger>
          <TabsTrigger value="movement" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6" data-testid="tab-movement">Movement Checks</TabsTrigger>
          <TabsTrigger value="chat" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6" data-testid="tab-chat">Chat</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6" data-testid="tab-logs">Logs & History</TabsTrigger>
        </TabsList>
        
        <div className="mt-8">
          <TabsContent value="programming" className="space-y-8 m-0 outline-none">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-display font-bold text-slate-900">Phases</h2>
              <Link href={`/app/admin/clients/${clientId}/builder/new`}>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full" data-testid="button-create-phase"><Plus className="mr-2 h-4 w-4" /> Create Phase</Button>
              </Link>
            </div>

            {activePhases.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Phase{activePhases.length > 1 ? 's' : ''}</h3>
                <div className="space-y-4">
                  {activePhases.map((phase: any) => renderPhaseCard(phase))}
                </div>
              </div>
            )}

            {pendingPhases.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Pending Phases
                </h3>
                <div className="space-y-4">
                  {pendingPhases.map((phase: any) => renderPhaseCard(phase))}
                </div>
              </div>
            )}

            {draftPhases.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Drafts In Progress</h3>
                <div className="space-y-3">
                  {draftPhases.map((phase: any) => (
                    <Card key={phase.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl bg-white overflow-hidden" data-testid={`card-draft-${phase.id}`}>
                      <CardContent className="p-5 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Draft</Badge>
                            <span className="text-xs text-slate-400">{getSessionCount(phase.id)} session(s) &middot; {phase.durationWeeks} weeks</span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 truncate">{phase.name}</h4>
                          {phase.goal && <p className="text-sm text-slate-500 mt-0.5 truncate">{phase.goal}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/app/admin/clients/${clientId}/builder/${phase.id}`}>
                            <Button variant="outline" size="sm" className="bg-white" data-testid={`button-edit-draft-${phase.id}`}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setDeleteTargetPhase(phase)}
                            data-testid={`button-delete-draft-${phase.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {clientPhases.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <Dumbbell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No Phases Yet</h3>
                <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">This client doesn't have any training phases. Build one from scratch or use a template.</p>
                <Link href={`/app/admin/clients/${clientId}/builder/new`}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" data-testid="button-build-phase">Build Phase</Button>
                </Link>
              </div>
            )}

            {completedPhases.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Phase History</h3>
                <div className="space-y-3">
                  {completedPhases.map((phase: any) => (
                    <Card key={phase.id} className="border-slate-200 shadow-none hover:bg-slate-50 transition-colors rounded-2xl" data-testid={`card-completed-${phase.id}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-xs">Completed</Badge>
                          </div>
                          <div className="font-medium text-slate-900">{phase.name}</div>
                          <div className="text-sm text-slate-500">{phase.durationWeeks} Weeks</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/app/admin/clients/${clientId}/builder/${phase.id}`}>
                            <Button variant="ghost" size="sm" className="text-slate-500" data-testid={`button-view-completed-${phase.id}`}>
                              <Pencil className="h-4 w-4 mr-1" /> View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTargetPhase(phase)}
                            data-testid={`button-delete-completed-${phase.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                <div className="flex items-center justify-between">
                  <CardTitle>Movement Checks</CardTitle>
                  {phasesWithMovementChecks.length > 1 && (
                    <Select value={movementCheckPhaseId || ''} onValueChange={setMovementCheckPhaseId}>
                      <SelectTrigger className="w-[220px] bg-white" data-testid="select-movement-phase">
                        <SelectValue placeholder="Select phase" />
                      </SelectTrigger>
                      <SelectContent>
                        {phasesWithMovementChecks.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({getPhaseDisplayStatus(p)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {selectedMovementPhase && (
                  <p className="text-sm text-slate-500 mt-1">{selectedMovementPhase.name} — {getPhaseDisplayStatus(selectedMovementPhase)}</p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {selectedMovementPhase && (selectedMovementPhase.movementChecks as any[]).length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {(selectedMovementPhase.movementChecks as any[]).map((mc: any, i: number) => (
                      <div key={i} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between hover:bg-slate-50/50 transition-colors" data-testid={`movement-check-${i}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className={
                              mc.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                              mc.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                              mc.status === 'Needs Resubmission' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {mc.status || 'Not Submitted'}
                            </Badge>
                            {mc.decidedAt && (
                              <span className="text-xs text-slate-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Reviewed {new Date(mc.decidedAt).toLocaleDateString()}
                              </span>
                            )}
                            {!mc.decidedAt && mc.submittedAt && (
                              <span className="text-xs text-slate-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Submitted {new Date(mc.submittedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-lg text-slate-900">{mc.name}</h4>
                          {mc.clientNote && (
                            <div className="mt-2 text-sm bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-100">
                              <span className="font-bold">Client Note:</span> {mc.clientNote}
                            </div>
                          )}
                          {mc.approvedNote && mc.status === 'Approved' && (
                            <div className="mt-2 text-sm bg-green-50 text-green-800 p-2 rounded-lg border border-green-100">
                              <span className="font-bold">Approval Note:</span> {mc.approvedNote}
                            </div>
                          )}
                          {mc.resubmitFeedback && mc.status === 'Needs Resubmission' && (
                            <div className="mt-2 text-sm bg-red-50 text-red-800 p-2 rounded-lg border border-red-100">
                              <span className="font-bold">Resubmission Feedback:</span> {mc.resubmitFeedback}
                            </div>
                          )}
                        </div>
                        
                        <div className="shrink-0 flex items-center gap-3">
                          {mc.videoUrl ? (
                            <a href={mc.videoUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200" data-testid={`button-watch-video-${i}`}>
                                <PlayCircle className="mr-2 h-4 w-4" /> Watch Video <ExternalLink className="ml-2 h-3 w-3" />
                              </Button>
                            </a>
                          ) : (
                            <div className="text-sm text-slate-400 italic">No video submitted</div>
                          )}
                          
                          {mc.status === 'Pending' && (
                            <div className="flex gap-2">
                              <Button 
                                variant="outline"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => handleOpenReject(selectedMovementPhase.id, mc.exerciseId)}
                                data-testid={`button-reject-${i}`}
                                disabled={isSubmitting}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Resubmit
                              </Button>
                              <Button 
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleOpenApprove(selectedMovementPhase.id, mc.exerciseId)}
                                data-testid={`button-approve-${i}`}
                                disabled={isSubmitting}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                              </Button>
                            </div>
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

          <TabsContent value="chat" className="m-0 outline-none">
            <Card className="flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-2xl h-[600px]">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isChatLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <MessageCircle className="h-12 w-12 text-slate-200 mb-4" />
                    <p>No messages yet. Start a conversation.</p>
                  </div>
                ) : (
                  chatMessages.map((msg: any) => (
                    <div key={msg.id} className={`flex gap-4 ${!msg.isClient ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="h-10 w-10 shrink-0 border border-slate-100 shadow-sm">
                        <AvatarFallback className={!msg.isClient ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}>
                          {msg.sender.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex flex-col ${!msg.isClient ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-slate-900 text-sm">{msg.sender}</span>
                          <span className="text-xs text-slate-500">{msg.time?.includes("T") ? new Date(msg.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : msg.time}</span>
                        </div>
                        <div className={`text-sm leading-relaxed p-4 rounded-2xl max-w-md ${
                          !msg.isClient
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <form className="relative flex items-center" onSubmit={handleSendChatMessage}>
                  <Input
                    placeholder="Message client..."
                    className="w-full pr-12 py-6 rounded-xl bg-white border-slate-200 focus-visible:ring-indigo-500 shadow-sm"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    data-testid="input-chat-message"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="absolute right-2 h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                    data-testid="button-send-message"
                    disabled={!chatMessage.trim()}
                  >
                    <Send className="h-4 w-4 text-white" />
                  </Button>
                </form>
              </div>
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

      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve Movement Check</DialogTitle>
            <DialogDescription>
              Optionally leave a note for the client with your approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="approve-note">Approval Note (optional)</Label>
              <Textarea 
                id="approve-note" 
                placeholder="e.g. Great form! You're ready to start with full load." 
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                data-testid="input-approve-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsApproveOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApproveMovementCheck}
              disabled={isSubmitting}
              data-testid="button-confirm-approve"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Resubmission</DialogTitle>
            <DialogDescription>
              Provide feedback to the client on why this video needs to be re-recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="feedback">Resubmission Feedback</Label>
              <Textarea 
                id="feedback" 
                placeholder="e.g. Your camera angle makes it hard to see your depth. Please record from the side." 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                data-testid="input-reject-feedback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsRejectOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectMovementCheck}
              disabled={isSubmitting || !feedback.trim()}
              data-testid="button-confirm-reject"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activateTargetPhase !== null} onOpenChange={(open) => { if (!open) setActivateTargetPhase(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Activate Phase</DialogTitle>
            <DialogDescription>
              {activePhases.length > 0
                ? `Activating "${activateTargetPhase?.name}" will finish the current active phase${activePhases.length > 1 ? 's' : ''} (${activePhases.map((p: any) => `"${p.name}"`).join(', ')}) and make this the client's new active phase.`
                : `Activate "${activateTargetPhase?.name}"? The client will immediately see this phase.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateTargetPhase(null)} disabled={activating}>
              Cancel
            </Button>
            <Button
              onClick={handleActivatePhase}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={activating}
              data-testid="button-confirm-activate"
            >
              {activating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              {activePhases.length > 0 ? 'Finish & Activate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finishTargetPhase !== null} onOpenChange={(open) => { if (!open) setFinishTargetPhase(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Finish Phase</DialogTitle>
            <DialogDescription>
              Mark "{finishTargetPhase?.name}" as completed? It will remain visible in your admin history but will no longer appear for the client.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishTargetPhase(null)} disabled={finishing}>
              Cancel
            </Button>
            <Button
              onClick={handleFinishPhase}
              className="bg-slate-900 hover:bg-slate-800 text-white"
              disabled={finishing}
              data-testid="button-confirm-finish"
            >
              {finishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              Finish Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTargetPhase !== null} onOpenChange={(open) => { if (!open) setDeleteTargetPhase(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Phase</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTargetPhase?.name}"? This will also remove all sessions and logs tied to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetPhase(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeletePhase}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              data-testid="button-confirm-delete-phase"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
