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
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminQAChecklist from "@/pages/admin/QAChecklist";

// Client
import ClientMyPhase from "@/pages/client/MyPhase";
import ClientSessionView from "@/pages/client/SessionView";
import ClientChat from "@/pages/client/Chat";
import ClientInfo from "@/pages/client/Info";

function ProtectedRoute({ component: Component, allowedRole, ...rest }: any) {
  const { user } = useAuth();
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  if (allowedRole && user.role !== allowedRole) {
    return <Redirect to={user.role === 'Admin' ? "/app/admin/clients" : "/app/client/my-phase"} />;
  }
  
  return <Component {...rest} />;
}

function Router() {
  const { user, initialized, initialize } = useAuth();

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
        {user ? (
          <Redirect to={user.role === 'Admin' ? "/app/admin/clients" : "/app/client/my-phase"} />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>

      <Route path="/login">
        {user ? (
          <Redirect to={user.role === 'Admin' ? "/app/admin/clients" : "/app/client/my-phase"} />
        ) : (
          <Login />
        )}
      </Route>

      <Route path="/signup">
        {user ? (
          <Redirect to={user.role === 'Admin' ? "/app/admin/clients" : "/app/client/my-phase"} />
        ) : (
          <SignUp />
        )}
      </Route>
      
      {/* App Shell routing */}
      <Route path="/app/*">
        {() => {
          if (!user) return <Redirect to="/login" />;
          
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
                <Route path="/app/admin/templates">
                  {() => <ProtectedRoute component={AdminTemplates} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/analytics">
                  {() => <ProtectedRoute component={AdminAnalytics} allowedRole="Admin" />}
                </Route>
                <Route path="/app/admin/qa">
                  {() => <ProtectedRoute component={AdminQAChecklist} allowedRole="Admin" />}
                </Route>
                
                {/* Client Routes */}
                <Route path="/app/client/my-phase">
                  {() => <ProtectedRoute component={ClientMyPhase} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/session/:sessionId">
                  {() => <ProtectedRoute component={ClientSessionView} allowedRole="Client" />}
                </Route>
                <Route path="/app/client/chat">
                  {() => <ProtectedRoute component={ClientChat} allowedRole="Client" />}
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
