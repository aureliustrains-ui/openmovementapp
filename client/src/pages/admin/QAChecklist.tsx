import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usersQuery, phasesQuery, sessionsQuery, exerciseTemplatesQuery } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import {
  Users,
  Layers,
  Dumbbell,
  Library,
  ClipboardCheck,
  PlayCircle,
  TrendingUp,
  UserCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { User, Phase } from "@shared/schema";

type TestResult = { pass: boolean; detail: string };

export default function QAChecklist() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery(usersQuery);
  const { data: phases = [] } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);
  const { data: exerciseTemplates = [] } = useQuery(exerciseTemplatesQuery);

  const clients = users.filter((u: User) => u.role === 'Client');
  const sarah = clients.find((u: User) => u.name.toLowerCase().includes('sarah')) || clients[0];

  const { impersonate } = useAuth();
  const [, setLocation] = useLocation();

  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

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

  const runSavePublishTest = async () => {
    if (!sarah) return;
    setTestRunning(true);
    setTestResults([]);
    const results: TestResult[] = [];

    try {
      const phaseRes = await fetch("/api/phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: sarah.id,
          name: "QA Test Phase",
          goal: "Automated verification",
          durationWeeks: 4,
          startDate: new Date().toISOString().split('T')[0],
          status: "Draft",
          movementChecks: [],
          schedule: [],
        }),
      });
      const phase = await phaseRes.json();
      results.push({
        pass: !!phase.id && phase.status === "Draft",
        detail: phase.id ? `Phase created: ${phase.id}` : "Phase creation failed",
      });

      const sessRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phaseId: phase.id,
          name: "QA Test Session",
          description: "Auto-generated",
          sections: [{
            id: crypto.randomUUID(),
            name: "A. Main",
            exercises: [{
              id: crypto.randomUUID(),
              name: "Test Squat",
              sets: "3", reps: "10", load: "100kg", rpe: "8", tempo: "3010", rest: "90s", notes: "",
            }],
          }],
          completedInstances: [],
        }),
      });
      const session = await sessRes.json();
      results.push({
        pass: !!session.id && session.phaseId === phase.id,
        detail: session.id ? `Session created: ${session.id}` : "Session creation failed",
      });

      const schedule = [
        { day: "Monday", week: 1, sessionId: session.id },
        { day: "Monday", week: 2, sessionId: session.id },
        { day: "Monday", week: 3, sessionId: session.id },
        { day: "Monday", week: 4, sessionId: session.id },
      ];
      await fetch(`/api/phases/${phase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });

      const verifyPhaseRes = await fetch(`/api/phases/${phase.id}`);
      const verifyPhase = await verifyPhaseRes.json();
      const scheduleOk = Array.isArray(verifyPhase.schedule) && verifyPhase.schedule.length === 4;
      const scheduleIdsOk = scheduleOk && verifyPhase.schedule.every((s: any) => s.sessionId === session.id && typeof s.week === "number" && typeof s.day === "string");
      results.push({
        pass: scheduleOk && scheduleIdsOk,
        detail: scheduleOk
          ? `Schedule persisted: ${verifyPhase.schedule.length} entries, IDs match: ${scheduleIdsOk}`
          : `Schedule missing or empty (got ${verifyPhase.schedule?.length || 0})`,
      });

      const verifySessRes = await fetch(`/api/sessions?phaseId=${phase.id}`);
      const verifySessions = await verifySessRes.json();
      const sessionPersisted = verifySessions.length === 1 && verifySessions[0].id === session.id;
      const exercisePersisted = sessionPersisted && verifySessions[0].sections?.[0]?.exercises?.length === 1;
      results.push({
        pass: sessionPersisted && exercisePersisted,
        detail: sessionPersisted
          ? `Session persisted with ${verifySessions[0].sections?.[0]?.exercises?.length || 0} exercise(s)`
          : `Session not found (got ${verifySessions.length} sessions)`,
      });

      await fetch(`/api/phases/${phase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active", movementChecks: [] }),
      });
      const publishedRes = await fetch(`/api/phases/${phase.id}`);
      const published = await publishedRes.json();
      results.push({
        pass: published.status === "Active",
        detail: `Status after publish: "${published.status}"`,
      });

      const scheduleAfterPublish = Array.isArray(published.schedule) && published.schedule.length === 4;
      results.push({
        pass: scheduleAfterPublish,
        detail: scheduleAfterPublish
          ? `Schedule survived publish: ${published.schedule.length} entries`
          : `Schedule lost after publish (got ${published.schedule?.length || 0})`,
      });

      await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      await fetch(`/api/phases/${phase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Draft", schedule: [], movementChecks: [] }),
      });

      qc.invalidateQueries({ queryKey: ["phases"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    } catch (err: any) {
      results.push({ pass: false, detail: `Test error: ${err.message}` });
    }

    setTestResults(results);
    setTestRunning(false);
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
              {phaseStats.active} Active &bull; {phaseStats.draft} Draft
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
            <div className="text-2xl font-bold">{allSessions.length}</div>
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
                "Save draft — sessions + schedule persist",
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-indigo-600" />
            Automated Save & Publish Test
          </CardTitle>
          <CardDescription>
            Creates a phase with a session, saves schedule, verifies persistence, publishes, then cleans up.
            {sarah ? ` Uses ${sarah.name} as the test client.` : " No client available."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={runSavePublishTest}
            disabled={testRunning || !sarah}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="button-run-save-test"
          >
            {testRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            {testRunning ? "Running..." : "Run Save/Publish Test"}
          </Button>

          {testResults.length > 0 && (
            <div className="space-y-2 mt-4">
              {testResults.map((r, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${r.pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`} data-testid={`test-result-${i}`}>
                  {r.pass ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                  <div>
                    <div className={`text-sm font-semibold ${r.pass ? 'text-green-800' : 'text-red-800'}`}>
                      Step {i + 1}: {r.pass ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{r.detail}</div>
                  </div>
                </div>
              ))}
              <div className="mt-3">
                <Badge className={testResults.every(r => r.pass) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
                  {testResults.filter(r => r.pass).length}/{testResults.length} passed
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
