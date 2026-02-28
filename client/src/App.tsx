import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Marketing
import Landing from "@/pages/marketing/Landing";
// Auth
import Login from "@/pages/auth/Login";
import SignUp from "@/pages/auth/SignUp";
// import ResetPassword from "@/pages/auth/ResetPassword";

// App shell
import { AppLayout } from "@/components/layout/AppLayout";
import Onboarding from "@/pages/app/Onboarding";
import Dashboard from "@/pages/app/Dashboard";
import Projects from "@/pages/app/Projects";
import Messages from "@/pages/app/Messages";
import Calendar from "@/pages/app/Calendar";
import Files from "@/pages/app/Files";
import Settings from "@/pages/app/Settings";
import Admin from "@/pages/app/Admin";
import TrainingPlansAdmin from "@/pages/app/TrainingPlansAdmin";
import TrainingPlanClient from "@/pages/app/TrainingPlanClient";
import Help from "@/pages/Help";

function Router() {
  return (
    <Switch>
      {/* Marketing Pages */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />
      <Route path="/help" component={Help} />

      {/* Auth-protected App routes */}
      <Route path="/onboarding" component={Onboarding} />
      
      {/* App Shell routing */}
      <Route path="/app/*">
        {() => (
          <AppLayout>
            <Switch>
              <Route path="/app/dashboard" component={Dashboard} />
              <Route path="/app/projects" component={Projects} />
              <Route path="/app/messages" component={Messages} />
              <Route path="/app/calendar" component={Calendar} />
              <Route path="/app/files" component={Files} />
              <Route path="/app/settings" component={Settings} />
              <Route path="/app/admin/training" component={TrainingPlansAdmin} />
              <Route path="/app/admin" component={Admin} />
              <Route path="/app/my-training" component={TrainingPlanClient} />
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
