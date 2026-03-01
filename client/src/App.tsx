import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// App shell
import { AppLayout } from "@/components/layout/AppLayout";
import Settings from "@/pages/app/Settings";

// Admin
import AdminClientsList from "@/pages/admin/ClientsList";
import AdminClientProfile from "@/pages/admin/ClientProfile";
import AdminPhaseBuilder from "@/pages/admin/PhaseBuilder";
import AdminTemplates from "@/pages/admin/Templates";
import AdminAnalytics from "@/pages/admin/Analytics";

// Client
import ClientMyPhase from "@/pages/client/MyPhase";
import ClientSessionView from "@/pages/client/SessionView";
import ClientChat from "@/pages/client/Chat";
import ClientInfo from "@/pages/client/Info";

function Router() {
  return (
    <Switch>
      {/* Redirect root to app based on mock user role logic in a real app */}
      <Route path="/">
        <Redirect to="/app/admin/clients" />
      </Route>

      <Route path="/login">
        <Redirect to="/app/admin/clients" />
      </Route>
      
      {/* App Shell routing */}
      <Route path="/app/*">
        {() => (
          <AppLayout>
            <Switch>
              {/* Admin Routes */}
              <Route path="/app/admin/clients" component={AdminClientsList} />
              <Route path="/app/admin/clients/:id" component={AdminClientProfile} />
              <Route path="/app/admin/clients/:clientId/builder/:phaseId" component={AdminPhaseBuilder} />
              <Route path="/app/admin/templates" component={AdminTemplates} />
              <Route path="/app/admin/analytics" component={AdminAnalytics} />
              
              {/* Client Routes */}
              <Route path="/app/client/my-phase" component={ClientMyPhase} />
              <Route path="/app/client/session/:sessionId" component={ClientSessionView} />
              <Route path="/app/client/chat" component={ClientChat} />
              <Route path="/app/client/info" component={ClientInfo} />
              
              {/* Shared Routes */}
              <Route path="/app/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
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
