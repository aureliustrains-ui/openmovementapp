import { Switch, Route, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

// Auth
import Login from "@/pages/auth/Login";
import SignUp from "@/pages/auth/SignUp";

// App shell
import { AppLayout } from "@/components/layout/AppLayout";
import Settings from "@/pages/app/Settings";

// Admin
import AdminClientsList from "@/pages/admin/ClientsList";
import AdminClientProfile from "@/pages/admin/ClientProfile";
import AdminPhaseBuilder from "@/pages/admin/PhaseBuilder";
import AdminTemplates from "@/pages/admin/Templates";
import AdminTemplateBuilder from "@/pages/admin/TemplateBuilder";
import SessionTemplateEditor from "@/pages/admin/SessionTemplateEditor";
import SectionTemplateEditor from "@/pages/admin/SectionTemplateEditor";
import ExerciseTemplateEditor from "@/pages/admin/ExerciseTemplateEditor";

// Client
import ClientHome from "@/pages/client/Home";
import ClientMyPhase from "@/pages/client/MyPhase";
import ClientSessionView from "@/pages/client/SessionView";
import ClientChat from "@/pages/client/Chat";
import ClientInfo from "@/pages/client/Info";
import ClientProgressReport from "@/pages/client/ProgressReport";
import ClientCheckIns from "@/pages/client/CheckIns";
import ClientYou from "@/pages/client/You";

function ProtectedRoute({ component: Component, allowedRole, ...rest }: any) {
  const { sessionUser, impersonating } = useAuth();
  
  if (!sessionUser) {
    return <Redirect to="/login" />;
  }
  
  const canAccessAsImpersonatedClient = allowedRole === "Client" && impersonating && sessionUser.role === "Admin";
  if (allowedRole && sessionUser.role !== allowedRole && !canAccessAsImpersonatedClient) {
    return <Redirect to={sessionUser.role === 'Admin' ? "/app/admin/clients" : "/app/client/home"} />;
  }
  
  return <Component {...rest} />;
}

function ClientReadinessRedirect() {
  return <Redirect to="/app/client/check-ins" />;
}

function Router() {
  const { user, sessionUser, initialized, initialize } = useAuth();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {sessionUser ? (
          <Redirect to={sessionUser.role === 'Admin' ? "/app/admin/clients" : "/app/client/home"} />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>

      <Route path="/login">
        {sessionUser ? (
          <Redirect to={sessionUser.role === 'Admin' ? "/app/admin/clients" : "/app/client/home"} />
        ) : (
          <Login />
        )}
      </Route>

      <Route path="/signup">
        {sessionUser ? (
          <Redirect to={sessionUser.role === 'Admin' ? "/app/admin/clients" : "/app/client/home"} />
        ) : (
          <SignUp />
        )}
      </Route>
      
      {/* App Shell routing */}
      <Route path="/app/*">
        {() => {
          if (!sessionUser) return <Redirect to="/login" />;
          
          return (
            <AppLayout>
              <Switch>
                {/* Admin Routes */}
                <Route path="/app/admin/clients">
                  {() => <ProtectedRoute component={AdminClientsList} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/clients/:id">
                  {() => <ProtectedRoute component={AdminClientProfile} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/clients/:clientId/builder/:phaseId">
                  {() => <ProtectedRoute component={AdminPhaseBuilder} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/templates/phases/:phaseTemplateId">
                  {() => <ProtectedRoute component={AdminTemplateBuilder} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/templates/sessions/:sessionTemplateId">
                  {() => <ProtectedRoute component={SessionTemplateEditor} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/templates/sections/:sectionTemplateId">
                  {() => <ProtectedRoute component={SectionTemplateEditor} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/templates/exercises/:exerciseTemplateId">
                  {() => <ProtectedRoute component={ExerciseTemplateEditor} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/templates">
                  {() => <ProtectedRoute component={AdminTemplates} allowedRole="Admin" />}
                </Route>
                
                {/* Client Routes */}
                <Route path="/app/client/home">
                  {() => <ProtectedRoute component={ClientHome} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/my-phase">
                  {() => <ProtectedRoute component={ClientMyPhase} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/check-ins">
                  {() => <ProtectedRoute component={ClientCheckIns} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/session/:sessionId">
                  {() => <ProtectedRoute component={ClientSessionView} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/progress-reports/:id">
                  {() => <ProtectedRoute component={ClientProgressReport} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/chat">
                  {() => <ProtectedRoute component={ClientChat} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/readiness">
                  {() => <ProtectedRoute component={ClientReadinessRedirect} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/you">
                  {() => <ProtectedRoute component={ClientYou} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/info">
                  {() => <ProtectedRoute component={ClientInfo} allowedRole="Client" />}
                </Route>
                
                {/* Shared Routes */}
                <Route path="/app/settings" component={Settings} />
                <Route component={NotFound} />
              </Switch>
            </AppLayout>
          );
        }}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
