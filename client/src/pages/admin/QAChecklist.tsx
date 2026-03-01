import { useQuery } from "@tanstack/react-query";
import { usersQuery, phasesQuery, sessionsQuery, exerciseTemplatesQuery, messagesQuery } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  Users, 
  Layers, 
  Dumbbell, 
  Library, 
  MessageSquare, 
  ExternalLink, 
  ClipboardCheck,
  PlayCircle,
  TrendingUp,
  UserCircle
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { User, Phase } from "@shared/schema";

export default function QAChecklist() {
  const { data: users = [] } = useQuery(usersQuery);
  const { data: phases = [] } = useQuery(phasesQuery);
  const { data: sessions = [] } = useQuery(sessionsQuery);
  const { data: exerciseTemplates = [] } = useQuery(exerciseTemplatesQuery);
  
  const clients = users.filter((u: User) => u.role === 'Client');
  const sarah = clients.find((u: User) => u.name.toLowerCase().includes('sarah')) || clients[0];
  
  const { impersonate } = useAuth();
  const [, setLocation] = useLocation();

  const handleImpersonate = (client: User) => {
    impersonate(client);
    setLocation("/app/client/my-phase");
  };

  const phaseStats = {
    total: phases.length,
    draft: phases.filter((p: Phase) => p.status === 'Draft').length,
    active: phases.filter((p: Phase) => p.status === 'Active' || p.status === 'Waiting for Movement Check').length,
    completed: phases.filter((p: Phase) => p.status === 'Completed').length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-8 w-8 text-indigo-600" />
          QA / Demo Checklist
        </h1>
        <p className="text-slate-500 mt-2">Internal admin tools for verifying system health and flows.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-stat-clients">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Users className="h-4 w-4" /> Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-phases">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Layers className="h-4 w-4" /> Phases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{phaseStats.total}</div>
            <p className="text-xs text-slate-400 mt-1">
              {phaseStats.active} Active • {phaseStats.draft} Draft
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-sessions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Dumbbell className="h-4 w-4" /> Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-exercises">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Library className="h-4 w-4" /> Exercises
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exerciseTemplates.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Key Flows & Navigation</CardTitle>
            <CardDescription>Quick links to common testing paths</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start gap-2" asChild data-testid="link-view-clients">
              <Link href="/app/admin/clients">
                <Users className="h-4 w-4" /> View Client List
              </Link>
            </Button>
            {sarah && (
              <>
                <Button variant="outline" className="justify-start gap-2" asChild data-testid="link-create-phase-sarah">
                  <Link href={`/app/admin/clients/${sarah.id}/builder/new`}>
                    <Layers className="h-4 w-4" /> Create Phase for {sarah.name}
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start gap-2" asChild data-testid="link-view-sarah">
                  <Link href={`/app/admin/clients/${sarah.id}`}>
                    <UserCircle className="h-4 w-4" /> View {sarah.name}'s Profile
                  </Link>
                </Button>
                <Button variant="secondary" className="justify-start gap-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100" onClick={() => handleImpersonate(sarah)} data-testid="button-impersonate-sarah">
                  <PlayCircle className="h-4 w-4" /> Impersonate {sarah.name}
                </Button>
              </>
            )}
            <Button variant="outline" className="justify-start gap-2" asChild data-testid="link-templates">
              <Link href="/app/admin/templates">
                <Library className="h-4 w-4" /> Templates Library
              </Link>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild data-testid="link-analytics">
              <Link href="/app/admin/analytics">
                <TrendingUp className="h-4 w-4" /> Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QA Checklist</CardTitle>
            <CardDescription>Visual verification of features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                "Create a phase with sessions and exercises",
                "Publish phase to client",
                "Client sees phase on My Phase",
                "Client submits movement check video",
                "Admin approves movement check",
                "Client can open and log a session",
                "Chat works both directions",
                "Templates CRUD works"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-600">
                  <div className="h-5 w-5 rounded border border-slate-300 shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
