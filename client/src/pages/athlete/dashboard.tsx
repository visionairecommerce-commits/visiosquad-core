import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Session, Registration, AthleteTeamRoster } from '@shared/schema';
import {
  Calendar,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle,
  Users,
  MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface RegistrationWithSession extends Registration {
  session: Session;
}

export default function AthleteDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['/api/my-sessions'],
  });

  const { data: registrations = [] } = useQuery<RegistrationWithSession[]>({
    queryKey: ['/api/my-registrations'],
  });

  const { data: rosters = [] } = useQuery<AthleteTeamRoster[]>({
    queryKey: ['/api/my-rosters'],
  });

  const registerMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest('POST', `/api/sessions/${sessionId}/register`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-registrations'] });
      toast({
        title: 'Registered!',
        description: 'You have been registered for the session.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Could not register for session. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const registeredSessionIds = new Set(registrations.map(r => r.session_id));

  const upcomingSessions = sessions
    .filter((s) => new Date(s.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-athlete-welcome">
          Welcome, {user?.full_name?.split(' ')[0] || 'Athlete'}!
        </h1>
        <p className="text-muted-foreground">Your schedule and team information</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-sessions-summary">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Registered Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registrations.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-teams-summary">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">My Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rosters.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-messages-summary">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Link href="/messages" className="text-primary hover:underline">
                View Messages
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>Your upcoming practices and events</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href="/schedule" data-testid="link-view-full-schedule">
                View Full Schedule
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming sessions scheduled.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSessions.map((session) => {
                const isRegistered = registeredSessionIds.has(session.id);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    data-testid={`card-upcoming-session-${session.id}`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{session.title}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(session.start_time), 'MMM d, yyyy')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(session.start_time), 'h:mm a')}
                        </div>
                        {session.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </div>
                        )}
                      </div>
                    </div>
                    {isRegistered ? (
                      <Badge className="bg-accent/10 text-accent gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Registered
                      </Badge>
                    ) : session.session_type === 'drop_in' ? (
                      <Button
                        size="sm"
                        onClick={() => registerMutation.mutate(session.id)}
                        disabled={registerMutation.isPending}
                        data-testid={`button-register-session-${session.id}`}
                      >
                        Register
                      </Button>
                    ) : (
                      <Badge variant="secondary">{session.session_type}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
