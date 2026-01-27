import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAthlete } from '@/contexts/AthleteContext';
import { AthleteSwitcher } from '@/components/AthleteSwitcher';
import { isAthleteAccessLocked } from '@shared/schema';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import type { Session, Registration } from '@shared/schema';

interface RegistrationWithSession extends Registration {
  session: Session;
}

export default function ParentSchedulePage() {
  const { activeAthlete } = useAthlete();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [registeringSessionId, setRegisteringSessionId] = useState<string | null>(null);

  const isLocked = activeAthlete ? isAthleteAccessLocked(activeAthlete.paid_through_date ?? undefined) : false;

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
  });

  const { data: registrations = [] } = useQuery<RegistrationWithSession[]>({
    queryKey: ['/api/athletes', activeAthlete?.id, 'registrations'],
    enabled: !!activeAthlete?.id,
  });

  const registerMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!activeAthlete) throw new Error('No athlete selected');
      setRegisteringSessionId(sessionId);
      return apiRequest('POST', `/api/sessions/${sessionId}/register`, {
        athlete_id: activeAthlete.id,
      });
    },
    onSuccess: () => {
      setRegisteringSessionId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/athletes', activeAthlete?.id, 'registrations'] });
      toast({
        title: 'Registered!',
        description: `${activeAthlete?.first_name} has been registered for the session.`,
      });
    },
    onError: (error: Error) => {
      setRegisteringSessionId(null);
      toast({
        title: 'Registration Failed',
        description: error.message || 'Could not register for session. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleRegister = (sessionId: string) => {
    if (!activeAthlete) {
      toast({
        title: 'Select an Athlete',
        description: 'Please select an athlete first.',
        variant: 'destructive',
      });
      return;
    }
    registerMutation.mutate(sessionId);
  };

  const registeredSessionIds = useMemo(() => {
    return new Set(registrations.map(r => r.session_id));
  }, [registrations]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSessionsForDate = (date: Date) => {
    return sessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      return isSameDay(sessionDate, date);
    });
  };

  const getRegistrationsForDate = (date: Date) => {
    return registrations.filter(reg => {
      const sessionDate = new Date(reg.session.start_time);
      return isSameDay(sessionDate, date);
    });
  };

  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];
  const selectedDateRegistrations = selectedDate ? getRegistrationsForDate(selectedDate) : [];

  const upcomingRegistrations = registrations
    .filter(reg => new Date(reg.session.start_time) >= new Date())
    .sort((a, b) => new Date(a.session.start_time).getTime() - new Date(b.session.start_time).getTime())
    .slice(0, 5);

  if (!activeAthlete) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No athlete selected</p>
          <p className="text-sm">Please select an athlete to view their schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-schedule-title">
            {activeAthlete.first_name}'s Schedule
          </h1>
          <p className="text-muted-foreground">
            View and manage session registrations
          </p>
        </div>
        <AthleteSwitcher />
      </div>

      {isLocked && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Payment Required</h3>
              <p className="text-sm text-destructive/80 mt-1">
                {activeAthlete.first_name}'s account is past due. Please update your payment to register for sessions.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center" data-testid="text-current-month">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => {
                const daySessions = getSessionsForDate(day);
                const dayRegistrations = getRegistrationsForDate(day);
                const hasRegistrations = dayRegistrations.length > 0;
                const hasSessions = daySessions.length > 0;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative p-2 min-h-[60px] rounded-md text-sm transition-colors
                      ${!isCurrentMonth ? 'text-muted-foreground/50' : ''}
                      ${isToday(day) ? 'bg-primary/10 font-bold' : ''}
                      ${isSelected ? 'ring-2 ring-primary' : ''}
                      ${hasSessions || hasRegistrations ? 'hover-elevate cursor-pointer' : 'cursor-default'}
                    `}
                    data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <span className={isToday(day) ? 'text-primary' : ''}>
                      {format(day, 'd')}
                    </span>
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {hasRegistrations && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Registered sessions" />
                      )}
                      {hasSessions && !hasRegistrations && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Available sessions" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Registered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Available</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Registrations</CardTitle>
              <CardDescription>
                {activeAthlete.first_name}'s next sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingRegistrations.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No upcoming registrations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingRegistrations.map(reg => (
                    <button
                      key={reg.id}
                      className="w-full text-left p-3 rounded-md bg-muted/50 space-y-2 hover-elevate"
                      onClick={() => {
                        const sessionDate = new Date(reg.session.start_time);
                        setCurrentMonth(sessionDate);
                        setSelectedDate(sessionDate);
                      }}
                      data-testid={`registration-${reg.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">{reg.session.title}</div>
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Registered
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(reg.session.start_time), 'EEE, MMM d')}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date(reg.session.start_time), 'h:mm a')} - {format(new Date(reg.session.end_time), 'h:mm a')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Sessions on {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateSessions.length === 0 && selectedDateRegistrations.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No sessions on this date</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedDateSessions.map(session => {
                  const isRegistered = registeredSessionIds.has(session.id);
                  const isRegistering = registeringSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      className="p-4 rounded-md border space-y-3"
                      data-testid={`session-card-${session.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{session.title}</div>
                          <Badge variant="secondary" className="mt-1">
                            {session.session_type}
                          </Badge>
                        </div>
                        {isRegistered && (
                          <Badge className="gap-1 bg-green-500">
                            <CheckCircle className="h-3 w-3" />
                            Registered
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(session.start_time), 'h:mm a')} - {format(new Date(session.end_time), 'h:mm a')}
                        </div>
                        {session.facility_id && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            {session.facility_id}
                          </div>
                        )}
                      </div>
                      {!isRegistered && (
                        <Button
                          className="w-full"
                          disabled={isLocked || isRegistering}
                          onClick={() => handleRegister(session.id)}
                          data-testid={`button-register-${session.id}`}
                        >
                          {isLocked ? (
                            <>
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Payment Required
                            </>
                          ) : isRegistering ? (
                            'Registering...'
                          ) : (
                            'Register Now'
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
