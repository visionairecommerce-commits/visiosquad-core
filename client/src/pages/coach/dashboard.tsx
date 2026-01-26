import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { Calendar, Users, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';

const today = new Date();

const todaysSessions = [
  {
    id: '1',
    title: 'Team Alpha Practice',
    time: '4:00 PM - 5:30 PM',
    location: 'Field 1',
    athletes_count: 12,
    checked_in: 8,
  },
  {
    id: '2',
    title: 'Beginner Clinic',
    time: '6:00 PM - 7:30 PM',
    location: 'Indoor Court',
    athletes_count: 10,
    checked_in: 0,
  },
];

const upcomingSessions = [
  { id: '3', title: 'Team Beta Practice', date: format(addDays(today, 1), 'EEE, MMM d'), time: '4:00 PM', athletes: 14 },
  { id: '4', title: 'Elite Training', date: format(addDays(today, 2), 'EEE, MMM d'), time: '5:00 PM', athletes: 10 },
  { id: '5', title: 'Skills Workshop', date: format(addDays(today, 3), 'EEE, MMM d'), time: '3:00 PM', athletes: 8 },
];

const stats = [
  { title: 'Sessions This Week', value: '8', icon: Calendar },
  { title: 'Total Athletes', value: '47', icon: Users },
  { title: 'Avg Attendance', value: '92%', icon: CheckCircle },
];

export default function CoachDashboard() {
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
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{session.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.time} • {session.location}
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {session.checked_in}/{session.athletes_count}
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
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
              <CardDescription>Next 7 days</CardDescription>
            </div>
            <Link href="/sessions">
              <Button variant="ghost" size="sm" data-testid="link-view-all-sessions">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <div className="font-medium">{session.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {session.date} at {session.time}
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {session.athletes}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
