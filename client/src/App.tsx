import { Switch, Route, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AthleteProvider } from "@/contexts/AthleteContext";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { setupForegroundMessageHandler, isPushNotificationSupported, getNotificationPermissionStatus } from "@/lib/push-notifications";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import CreateClubPage from "@/pages/create-club";
import JoinPage from "@/pages/join";
import OnboardingPage from "@/pages/onboarding";
import AdminDashboard from "@/pages/admin/dashboard";
import ProgramsPage from "@/pages/admin/programs";
import TeamsPage from "@/pages/admin/teams";
import RosterPage from "@/pages/admin/roster";
import AdminSchedulePage from "@/pages/admin/schedule";
import AdminCalendarPage from "@/pages/admin/calendar";
import AdminPaymentsPage from "@/pages/admin/payments";
import ContractsPage from "@/pages/admin/contracts";
import ProgramRosterPage from "@/pages/admin/program-roster";
import CoachDashboard from "@/pages/coach/dashboard";
import CoachSessionsPage from "@/pages/coach/sessions";
import CoachCalendarPage from "@/pages/coach/calendar";
import ParentDashboard from "@/pages/parent/dashboard";
import AthletesPage from "@/pages/parent/athletes";
import ParentSchedulePage from "@/pages/parent/schedule";
import ParentPaymentsPage from "@/pages/parent/payments";
import ParentDocumentsPage from "@/pages/parent/documents";
import ParentContractsPage from "@/pages/parent/contracts";
import ParentFormsPage from "@/pages/parent/forms";
import ParentEventsPage from "@/pages/parent/events";
import SettingsPage from "@/pages/admin/settings";
import EventsPage from "@/pages/admin/events";
import MessagesPage from "@/pages/messages";
import BulletinPage from "@/pages/bulletin";
import AthleteDashboard from "@/pages/athlete/dashboard";
import AthleteSchedulePage from "@/pages/athlete/schedule";
import TermsOfServicePage from "@/pages/terms-of-service";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import OwnerDashboard from "@/pages/owner/dashboard";
import DocuSealOnboarding from "@/pages/owner/docuseal-onboarding";
import PlatformRevenue from "@/pages/owner/platform-revenue";
import { WaiverEnforcementModal } from "@/components/WaiverEnforcementModal";

function RedirectToLogin() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/login");
  }, [setLocation]);
  return null;
}

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/');
  }, [setLocation]);
  return null;
}

function AdminRoutes() {
  return (
    <Switch>
      <Route path="/" component={AdminDashboard} />
      <Route path="/login" component={RedirectToDashboard} />
      <Route path="/create-club" component={RedirectToDashboard} />
      <Route path="/join" component={RedirectToDashboard} />
      <Route path="/onboarding" component={RedirectToDashboard} />
      <Route path="/programs" component={ProgramsPage} />
      <Route path="/programs/:programId/roster" component={ProgramRosterPage} />
      <Route path="/contracts" component={ContractsPage} />
      <Route path="/teams" component={TeamsPage} />
      <Route path="/roster" component={RosterPage} />
      <Route path="/schedule" component={AdminSchedulePage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/calendar" component={AdminCalendarPage} />
      <Route path="/payments" component={AdminPaymentsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/bulletin" component={BulletinPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function CoachRoutes() {
  return (
    <Switch>
      <Route path="/" component={CoachDashboard} />
      <Route path="/login" component={RedirectToDashboard} />
      <Route path="/create-club" component={RedirectToDashboard} />
      <Route path="/join" component={RedirectToDashboard} />
      <Route path="/sessions" component={CoachSessionsPage} />
      <Route path="/sessions/:id" component={CoachSessionsPage} />
      <Route path="/calendar" component={CoachCalendarPage} />
      <Route path="/attendance" component={CoachSessionsPage} />
      <Route path="/programs" component={ProgramsPage} />
      <Route path="/programs/:programId/roster" component={ProgramRosterPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/bulletin" component={BulletinPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ParentRoutes() {
  return (
    <Switch>
      <Route path="/" component={ParentDashboard} />
      <Route path="/login" component={RedirectToDashboard} />
      <Route path="/create-club" component={RedirectToDashboard} />
      <Route path="/join" component={RedirectToDashboard} />
      <Route path="/athletes" component={AthletesPage} />
      <Route path="/contracts" component={ParentContractsPage} />
      <Route path="/schedule" component={ParentSchedulePage} />
      <Route path="/events" component={ParentEventsPage} />
      <Route path="/payments" component={ParentPaymentsPage} />
      <Route path="/documents" component={ParentDocumentsPage} />
      <Route path="/forms" component={ParentFormsPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/bulletin" component={BulletinPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AthleteRoutes() {
  return (
    <Switch>
      <Route path="/" component={AthleteDashboard} />
      <Route path="/login" component={RedirectToDashboard} />
      <Route path="/schedule" component={AthleteSchedulePage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/bulletin" component={BulletinPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function OwnerRoutes() {
  return (
    <Switch>
      <Route path="/" component={OwnerDashboard} />
      <Route path="/clubs" component={OwnerDashboard} />
      <Route path="/revenue" component={PlatformRevenue} />
      <Route path="/docuseal-onboarding" component={DocuSealOnboarding} />
      <Route path="/login" component={RedirectToDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const { toast } = useToast();
  const foregroundUnsubscribe = useRef<(() => void) | null>(null);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  useEffect(() => {
    if (!user) return;

    const trySetupHandler = () => {
      if (!isPushNotificationSupported()) return;
      const permissionStatus = getNotificationPermissionStatus();
      if (permissionStatus === 'granted' && !foregroundUnsubscribe.current) {
        try {
          foregroundUnsubscribe.current = setupForegroundMessageHandler((notification) => {
            toast({
              title: notification.title,
              description: notification.body,
            });
          });
        } catch (error) {
          console.error('Failed to setup foreground handler:', error);
        }
      }
    };

    trySetupHandler();

    const onFocus = () => trySetupHandler();
    window.addEventListener('focus', onFocus);
    
    return () => {
      window.removeEventListener('focus', onFocus);
      if (foregroundUnsubscribe.current) {
        foregroundUnsubscribe.current();
        foregroundUnsubscribe.current = null;
      }
    };
  }, [user, toast]);

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <NotificationPrompt />
            <div className="p-6">
              {user?.role === 'owner' && <OwnerRoutes />}
              {user?.role === 'admin' && <AdminRoutes />}
              {user?.role === 'coach' && <CoachRoutes />}
              {user?.role === 'parent' && <ParentRoutes />}
              {user?.role === 'athlete' && <AthleteRoutes />}
            </div>
          </main>
        </div>
      </div>
      {/* Waiver enforcement modal for parents and coaches */}
      {(user?.role === 'parent' || user?.role === 'coach') && <WaiverEnforcementModal />}
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, club, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/create-club" component={CreateClubPage} />
        <Route path="/join" component={JoinPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/terms-of-service" component={TermsOfServicePage} />
        <Route component={RedirectToLogin} />
      </Switch>
    );
  }

  if (user.role === 'admin' && club && !club.onboarding_complete) {
    return (
      <Switch>
        <Route path="/onboarding" component={OnboardingPage} />
        <Route>{() => { setLocation('/onboarding'); return null; }}</Route>
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AthleteProvider>
            <AppContent />
            <Toaster />
          </AthleteProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
