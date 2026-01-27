import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { isAthleteAccessLocked } from '@shared/schema';
import type { Session } from '@shared/schema';

interface RegistrationAthlete {
  id: string;
  first_name: string;
  last_name: string;
  paid_through_date: string | null;
}

interface Registration {
  id: string;
  athlete_id: string;
  checked_in: boolean;
  athlete: RegistrationAthlete;
}

interface SessionWithRegistrations extends Session {
  registrations?: Registration[];
}

export default function CoachCalendarPage() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionWithRegistrations | null>(null);

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
  });

  const { data: registrations = [], refetch: refetchRegistrations } = useQuery<Registration[]>({
    queryKey: ['/api/sessions', selectedSession?.id, 'registrations'],
    enabled: !!selectedSession?.id,
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ registrationId, checkedIn }: { registrationId: string; checkedIn: boolean }) => {
      return apiRequest('PATCH', `/api/registrations/${registrationId}/checkin`, { checked_in: checkedIn });
    },
    onSuccess: () => {
      refetchRegistrations();
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Check-in Failed',
        description: error.message || 'Could not update check-in status.',
        variant: 'destructive',
      });
    },
  });

  const handleCheckIn = (registration: Registration) => {
    const isLocked = isAthleteAccessLocked(registration.athlete.paid_through_date ?? undefined);
    if (isLocked && !registration.checked_in) {
      toast({
        title: 'Cannot Check In',
        description: 'This athlete has an overdue payment and cannot be checked in.',
        variant: 'destructive',
      });
      return;
    }

    checkInMutation.mutate({
      registrationId: registration.id,
      checkedIn: !registration.checked_in,
    });

    toast({
      title: registration.checked_in ? 'Checked Out' : 'Checked In',
      description: `${registration.athlete.first_name} ${registration.athlete.last_name} has been ${registration.checked_in ? 'checked out' : 'checked in'}.`,
    });
  };

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

  const getSessionTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'practice': return 'default';
      case 'clinic': return 'secondary';
      case 'drop_in': return 'outline';
      default: return 'default';
    }
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const checkedInCount = registrations.filter(r => r.checked_in).length;
  const totalCount = registrations.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-calendar-title">
          Session Calendar
        </h1>
        <p className="text-muted-foreground">
          View sessions and manage attendance
        </p>
      </div>

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
                      ${hasSessions ? 'hover-elevate cursor-pointer' : 'cursor-default'}
                    `}
                    data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <span className={isToday(day) ? 'text-primary' : ''}>
                      {format(day, 'd')}
                    </span>
                    {hasSessions && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" title={`${daySessions.length} session(s)`} />
                        {daySessions.length > 1 && (
                          <span className="text-[10px] text-muted-foreground">{daySessions.length}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a Date'}
              </CardTitle>
              <CardDescription>
                {selectedDateSessions.length > 0 
                  ? `${selectedDateSessions.length} session(s) scheduled`
                  : 'No sessions on this date'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDateSessions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sessions scheduled</p>
                </div>
              ) : (
                selectedDateSessions.map(session => (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg border hover-elevate cursor-pointer"
                    onClick={() => setSelectedSession(session)}
                    data-testid={`session-card-${session.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{session.title}</h4>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(session.start_time), 'h:mm a')} - {format(new Date(session.end_time), 'h:mm a')}
                          </span>
                        </div>
                        {session.location && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{session.location}</span>
                          </div>
                        )}
                      </div>
                      <Badge variant={getSessionTypeBadgeVariant(session.session_type)} className="shrink-0">
                        {session.session_type}
                      </Badge>
                    </div>
                    {session.status === 'cancelled' && (
                      <Badge variant="destructive" className="mt-2">Cancelled</Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedSession?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedSession && (
                <>
                  {format(new Date(selectedSession.start_time), 'EEEE, MMMM d • h:mm a')} - {format(new Date(selectedSession.end_time), 'h:mm a')}
                  {selectedSession.location && ` • ${selectedSession.location}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Attendance</h4>
              <Badge variant="outline">
                {checkedInCount}/{totalCount} checked in
              </Badge>
            </div>

            {registrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No registrations yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {registrations.map(registration => {
                  const isLocked = isAthleteAccessLocked(registration.athlete.paid_through_date ?? undefined);
                  
                  return (
                    <div
                      key={registration.id}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border
                        ${registration.checked_in ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : ''}
                        ${isLocked ? 'opacity-60' : ''}
                      `}
                      data-testid={`registration-${registration.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={registration.checked_in ? 'bg-green-100 text-green-700' : ''}>
                            {getInitials(registration.athlete.first_name, registration.athlete.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {registration.athlete.first_name} {registration.athlete.last_name}
                          </p>
                          <div className="flex items-center gap-2">
                            {isLocked ? (
                              <span className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Payment overdue
                              </span>
                            ) : registration.checked_in ? (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Checked in
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Not checked in
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant={registration.checked_in ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleCheckIn(registration)}
                        disabled={isLocked && !registration.checked_in || checkInMutation.isPending}
                        data-testid={`button-checkin-${registration.id}`}
                      >
                        {registration.checked_in ? 'Check Out' : 'Check In'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
