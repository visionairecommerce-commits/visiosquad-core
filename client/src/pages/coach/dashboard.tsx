import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { Calendar, Users, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { format, isToday, isFuture, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface Session {
  id: string;
  title: string;
  session_type: string;
  program_id: string;
  team_id: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  status: string;
}

interface Team {
  id: string;
  name: string;
  program_id: string;
  coach_id: string | null;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const today = new Date();

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  const todaysSessions = sessions.filter(s => {
    const sessionDate = parseISO(s.start_time);
    return isToday(sessionDate) && s.status !== 'cancelled';
  });

  const upcomingSessions = sessions.filter(s => {
    const sessionDate = parseISO(s.start_time);
    return isFuture(sessionDate) && !isToday(sessionDate) && s.status !== 'cancelled';
  }).slice(0, 5);

  const stats = [
    { title: 'Assigned Teams', value: String(teams.length), icon: Users },
    { title: 'Today\'s Sessions', value: String(todaysSessions.length), icon: Calendar },
    { title: 'Upcoming Sessions', value: String(upcomingSessions.length), icon: Clock },
  ];

  if (sessionsLoading || teamsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Coach Dashboard</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coach Dashboard</h1>
          <p className="text-muted-foreground">
            {format(today, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Sessions</CardTitle>
            <CardDescription>Sessions scheduled for today</CardDescription>
          </CardHeader>
          <CardContent>
            {todaysSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No sessions scheduled for today
              </p>
            ) : (
              <div className="space-y-3">
                {todaysSessions.map((session) => (
                  <div key={session.id} className="p-4 rounded-md bg-muted/50 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{session.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(parseISO(session.start_time), 'h:mm a')} - {format(parseISO(session.end_time), 'h:mm a')}
                          {session.location && ` • ${session.location}`}
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {session.session_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <Link href={`/sessions/${session.id}`}>
                      <Button className="w-full" data-testid={`button-manage-session-${session.id}`}>
                        Manage Session
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Teams</CardTitle>
            <CardDescription>Teams assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No teams assigned yet. Contact your club director to be assigned to teams.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <div key={team.id} className="p-3 rounded-md border">
                    <div className="font-medium">{team.name}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
            <CardDescription>Your next scheduled sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming sessions scheduled
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 rounded-md border">
                    <div>
                      <div className="font-medium">{session.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(session.start_time), 'EEE, MMM d')} at {format(parseISO(session.start_time), 'h:mm a')}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {session.session_type.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
