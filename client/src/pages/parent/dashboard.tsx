import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useAthlete } from '@/contexts/AthleteContext';
import { AthleteSwitcher } from '@/components/AthleteSwitcher';
import { isAthleteAccessLocked } from '@shared/schema';
import {
  Calendar,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle,
} from 'lucide-react';
import { format, addDays } from 'date-fns';

const today = new Date();

const mockAthletes = [
  {
    id: '1',
    club_id: 'demo-club-1',
    parent_id: 'demo-parent-1',
    first_name: 'Emma',
    last_name: 'Wilson',
    date_of_birth: '2015-03-15',
    tags: ['U10', 'Soccer'],
    paid_through_date: '2026-02-15',
    is_locked: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    club_id: 'demo-club-1',
    parent_id: 'demo-parent-1',
    first_name: 'Jake',
    last_name: 'Wilson',
    date_of_birth: '2017-07-22',
    tags: ['U8', 'Beginners'],
    paid_through_date: '2026-01-10',
    is_locked: false,
    created_at: new Date().toISOString(),
  },
];

const upcomingSessions = [
  {
    id: '1',
    title: 'Team Alpha Practice',
    date: format(today, 'EEE, MMM d'),
    time: '4:00 PM - 5:30 PM',
    location: 'Field 1',
    registered: true,
  },
  {
    id: '2',
    title: 'Skills Clinic',
    date: format(addDays(today, 2), 'EEE, MMM d'),
    time: '10:00 AM - 12:00 PM',
    location: 'Indoor Court',
    registered: false,
    price: 25,
  },
  {
    id: '3',
    title: 'Drop-in Session',
    date: format(addDays(today, 4), 'EEE, MMM d'),
    time: '3:00 PM - 4:00 PM',
    location: 'Field 2',
    registered: false,
    price: 15,
  },
];

export default function ParentDashboard() {
  const { athletes, activeAthlete, setAthletes, setActiveAthlete } = useAthlete();

  useEffect(() => {
    if (athletes.length === 0) {
      setAthletes(mockAthletes);
      setActiveAthlete(mockAthletes[0]);
    }
  }, [athletes.length, setAthletes, setActiveAthlete]);

  const isLocked = activeAthlete ? isAthleteAccessLocked(activeAthlete.paid_through_date ?? undefined) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground">
            Manage your athletes' schedules and registrations
          </p>
        </div>
        <AthleteSwitcher />
      </div>

      {isLocked && activeAthlete && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Payment Required</h3>
              <p className="text-sm text-destructive/80 mt-1">
                {activeAthlete.first_name}'s account is past due. Please update your payment to continue registering for sessions.
              </p>
              <Link href="/payments">
                <Button size="sm" variant="destructive" className="mt-3" data-testid="button-make-payment">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Make Payment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeAthlete && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">
                  {activeAthlete.first_name} {activeAthlete.last_name}
                </CardTitle>
                <CardDescription>
                  {activeAthlete.tags?.join(' • ')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {activeAthlete.paid_through_date && (
                  <Badge variant={isLocked ? 'destructive' : 'secondary'} className="gap-1">
                    {isLocked ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                    Paid through {format(new Date(activeAthlete.paid_through_date), 'MMM yyyy')}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
              <CardDescription>Sessions for {activeAthlete?.first_name || 'your athlete'}</CardDescription>
            </div>
            <Link href="/schedule">
              <Button variant="ghost" size="sm" data-testid="link-view-schedule">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="p-4 rounded-md bg-muted/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{session.title}</div>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {session.date}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {session.time}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {session.location}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {session.registered ? (
                        <Badge className="bg-accent/10 text-accent gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Registered
                        </Badge>
                      ) : session.price ? (
                        <div className="text-lg font-semibold">${session.price}</div>
                      ) : null}
                    </div>
                  </div>
                  {!session.registered && (
                    <Button
                      className="w-full"
                      disabled={isLocked}
                      data-testid={`button-register-session-${session.id}`}
                    >
                      {isLocked ? (
                        <>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Payment Required
                        </>
                      ) : (
                        'Register Now'
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common tasks and actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/athletes">
              <Button variant="outline" className="w-full justify-start" data-testid="link-manage-athletes">
                <Calendar className="h-4 w-4 mr-3" />
                Manage Athletes
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link href="/schedule">
              <Button variant="outline" className="w-full justify-start" data-testid="link-view-full-schedule">
                <Calendar className="h-4 w-4 mr-3" />
                View Full Schedule
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link href="/payments">
              <Button variant="outline" className="w-full justify-start" data-testid="link-payment-history">
                <CreditCard className="h-4 w-4 mr-3" />
                Payment History
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
