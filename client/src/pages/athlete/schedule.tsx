import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Calendar,
  Clock,
  MapPin,
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

export default function AthleteSchedulePage() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['/api/my-sessions'],
  });

  const { data: registrations = [] } = useQuery<RegistrationWithSession[]>({
    queryKey: ['/api/my-registrations'],
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

  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
        <p className="text-muted-foreground">View your upcoming sessions and events</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="py-2 text-muted-foreground font-medium">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const daySessions = getSessionsForDate(day);
                const hasSession = daySessions.length > 0;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const inCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <Button
                    key={day.toISOString()}
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`h-10 w-full relative ${!inCurrentMonth ? 'text-muted-foreground/50' : ''} ${isToday(day) ? 'ring-1 ring-primary' : ''}`}
                    onClick={() => setSelectedDate(day)}
                    data-testid={`button-calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    {format(day, 'd')}
                    {hasSession && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a Date'}
            </CardTitle>
            <CardDescription>
              {selectedDate
                ? selectedDateSessions.length > 0
                  ? `${selectedDateSessions.length} session(s) scheduled`
                  : 'No sessions scheduled'
                : 'Click on a date to see sessions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a date to view sessions</p>
              </div>
            ) : selectedDateSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No sessions on this date</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateSessions.map((session) => {
                  const isRegistered = registeredSessionIds.has(session.id);
                  return (
                    <div
                      key={session.id}
                      className="p-4 rounded-lg border bg-card"
                      data-testid={`card-session-${session.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium">{session.title}</p>
                          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(session.start_time), 'h:mm a')} -{' '}
                              {format(new Date(session.end_time), 'h:mm a')}
                            </div>
                            {session.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {session.location}
                              </div>
                            )}
                          </div>
                          {session.description && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {session.description}
                            </p>
                          )}
                        </div>
                        <div>
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
                              data-testid={`button-register-${session.id}`}
                            >
                              Register
                            </Button>
                          ) : (
                            <Badge variant="secondary">{session.session_type}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
