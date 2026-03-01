import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usersQuery, phasesQuery, sessionsQuery, useUpdatePhase, useDeletePhase, messagesQuery, useSendMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Plus, MessageCircle, PlayCircle, Settings, CheckCircle2, ChevronLeft, ArrowRight, BarChart, Repeat, Loader2, XCircle, Clock, ExternalLink, Send, Pencil, CalendarDays, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ComingSoonDialog } from "@/components/ComingSoonDialog";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("programming");
  const [chatMessage, setChatMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetPhase, setDeleteTargetPhase] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: chatMessages = [], isLoading: isChatLoading } = useQuery({
    ...messagesQuery(clientId || ""),
    enabled: !!clientId,
    refetchInterval: 5000,
  });
  const sendMessage = useSendMessage();

  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  const client = allUsers.find((u: any) => u.id === clientId);
  const clientPhases = allPhases.filter((p: any) => p.clientId === clientId);
  const activePhase = clientPhases.find((p: any) => p.status === 'Active' || p.status === 'Waiting for Movement Check');
  const draftPhases = clientPhases.filter((p: any) => p.status === 'Draft');
  const pastPhases = clientPhases.filter((p: any) => p.status === 'Completed' || p.status === 'Archived');

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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isClient: false,
    });
    setChatMessage("");
  };

  const handleApproveMovementCheck = async (phaseId: string, exerciseId: string) => {
    const phase = allPhases.find((p: any) => p.id === phaseId);
    if (!phase) return;
    
    setIsSubmitting(true);
    try {
      const updatedChecks = (phase.movementChecks as any[]).map((mc: any) => {
        if (mc.exerciseId !== exerciseId) return mc;
        return { ...mc, status: 'Approved', feedback: 'Looking great, ready to go!' };
      });

      const allApproved = updatedChecks.every((mc: any) => mc.status === 'Approved');
      
      await updatePhase.mutateAsync({
        id: phaseId,
        movementChecks: updatedChecks,
        ...(allApproved ? { status: 'Active' } : {}),
      });

      toast({
        title: "Check Approved",
        description: allApproved ? "Phase is now active!" : "Movement check approved.",
      });
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
        return { ...mc, status: 'Needs Resubmission', feedback: feedback };
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

  const handleOpenDeletePhase = (phase: any) => {
    setDeleteTargetPhase(phase);
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const handleDeletePhase = async () => {
    if (deleteConfirmText !== "DELETE" || !deleteTargetPhase) return;
    setDeleting(true);
    try {
      await deletePhase.mutateAsync(deleteTargetPhase.id);
      toast({ title: "Phase Deleted", description: `"${deleteTargetPhase.name}" and all associated data removed.` });
      setDeleteDialogOpen(false);
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

            {activePhase && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Current Phase</h3>
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
                        <Button variant="outline" className="bg-white" data-testid="button-edit-phase"><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleOpenDeletePhase(activePhase)}
                        data-testid="button-delete-active-phase"
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
                      const schedule = (activePhase.schedule as any[]) || [];
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
                            onClick={() => handleOpenDeletePhase(phase)}
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

            {!activePhase && draftPhases.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <Dumbbell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No Phases Yet</h3>
                <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">This client doesn't have any training phases. Build one from scratch or use a template.</p>
                <Link href={`/app/admin/clients/${clientId}/builder/new`}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full" data-testid="button-build-phase">Build Phase</Button>
                </Link>
              </div>
            )}

            {pastPhases.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Phase History</h3>
                <div className="space-y-3">
                  {pastPhases.map((phase: any) => (
                    <Card key={phase.id} className="border-slate-200 shadow-none hover:bg-slate-50 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{phase.name}</div>
                          <div className="text-sm text-slate-500">{phase.durationWeeks} Weeks &bull; Completed</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleOpenDeletePhase(phase)}
                            data-testid={`button-delete-past-${phase.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ArrowRight className="h-5 w-5 text-slate-400" />
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
                              mc.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                              mc.status === 'Needs Resubmission' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {mc.status || 'Not Submitted'}
                            </Badge>
                            {mc.submittedAt && (
                              <span className="text-xs text-slate-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(mc.submittedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-lg text-slate-900">{mc.name}</h4>
                          {mc.clientNote && (
                            <div className="mt-2 text-sm bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-100">
                              <span className="font-bold">Client Note:</span> {mc.clientNote}
                            </div>
                          )}
                          {mc.feedback && (
                            <p className="text-sm text-slate-600 mt-2 bg-slate-100 p-3 rounded-lg border border-slate-200 italic">
                              "{mc.feedback}"
                            </p>
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
                                onClick={() => handleOpenReject(activePhase.id, mc.exerciseId)}
                                data-testid={`button-reject-${i}`}
                                disabled={isSubmitting}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Request Resubmission
                              </Button>
                              <Button 
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleApproveMovementCheck(activePhase.id, mc.exerciseId)}
                                data-testid={`button-approve-${i}`}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Approve
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
                          <span className="text-xs text-slate-500">{msg.time}</span>
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
              <Label htmlFor="feedback">Feedback</Label>
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-700">Delete Phase</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-semibold text-slate-900">"{deleteTargetPhase?.name}"</span> and all associated sessions, schedule, and workout logs. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-sm text-slate-600">Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm</Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="border-red-200 focus-visible:ring-red-500"
              data-testid="input-delete-confirm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeletePhase}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting || deleteConfirmText !== "DELETE"}
              data-testid="button-confirm-delete-phase"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
