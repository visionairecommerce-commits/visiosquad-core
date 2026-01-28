import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  CalendarDays,
  Trophy,
  Target,
  Tent,
  Star,
  DollarSign,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { isAthleteAccessLocked } from '@shared/schema';
import type { Session, Program, Event } from '@shared/schema';

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

interface EventRoster {
  id: string;
  athlete_id: string;
  checked_in: boolean;
  athlete: RegistrationAthlete;
}

type CalendarItemType = 'session' | 'event';

interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  session_type?: string;
  event_type?: string;
  status?: string;
  price?: number;
}

export default function AdminCalendarPage() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionWithRegistrations | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [filterProgramId, setFilterProgramId] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<'all' | 'sessions' | 'events'>('all');

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: registrations = [], refetch: refetchRegistrations } = useQuery<Registration[]>({
    queryKey: ['/api/sessions', selectedSession?.id, 'registrations'],
    enabled: !!selectedSession?.id,
  });

  const { data: eventRosters = [], refetch: refetchEventRosters } = useQuery<EventRoster[]>({
    queryKey: ['/api/events', selectedEvent?.id, 'rosters'],
    enabled: !!selectedEvent?.id,
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

  const eventCheckInMutation = useMutation({
    mutationFn: async ({ rosterId, checkedIn }: { rosterId: string; checkedIn: boolean }) => {
      return apiRequest('PATCH', `/api/events/rosters/${rosterId}/checkin`, { checked_in: checkedIn });
    },
    onSuccess: () => {
      refetchEventRosters();
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
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

  const handleEventCheckIn = (roster: EventRoster) => {
    const isLocked = isAthleteAccessLocked(roster.athlete.paid_through_date ?? undefined);
    if (isLocked && !roster.checked_in) {
      toast({
        title: 'Cannot Check In',
        description: 'This athlete has an overdue payment and cannot be checked in.',
        variant: 'destructive',
      });
      return;
    }

    eventCheckInMutation.mutate({
      rosterId: roster.id,
      checkedIn: !roster.checked_in,
    });

    toast({
      title: roster.checked_in ? 'Checked Out' : 'Checked In',
      description: `${roster.athlete.first_name} ${roster.athlete.last_name} has been ${roster.checked_in ? 'checked out' : 'checked in'}.`,
    });
  };

  const filteredSessions = useMemo(() => {
    if (filterProgramId === 'all') return sessions;
    return sessions.filter(s => s.program_id === filterProgramId);
  }, [sessions, filterProgramId]);

  const filteredEvents = useMemo(() => {
    if (filterProgramId === 'all') return events;
    return events.filter(e => e.program_id === filterProgramId);
  }, [events, filterProgramId]);

  const calendarItems = useMemo((): CalendarItem[] => {
    const items: CalendarItem[] = [];
    
    if (viewFilter === 'all' || viewFilter === 'sessions') {
      filteredSessions.forEach(session => {
        items.push({
          id: session.id,
          type: 'session',
          title: session.title,
          start_time: session.start_time,
          end_time: session.end_time,
          location: session.location,
          session_type: session.session_type,
          status: session.status,
        });
      });
    }
    
    if (viewFilter === 'all' || viewFilter === 'events') {
      filteredEvents.forEach(event => {
        items.push({
          id: event.id,
          type: 'event',
          title: event.title,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          event_type: event.event_type,
          price: event.price,
        });
      });
    }
    
    return items;
  }, [filteredSessions, filteredEvents, viewFilter]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getItemsForDate = (date: Date) => {
    return calendarItems.filter(item => {
      const itemDate = new Date(item.start_time);
      return isSameDay(itemDate, date);
    });
  };

  const getSessionsForDate = (date: Date) => {
    return filteredSessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      return isSameDay(sessionDate, date);
    });
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, date);
    });
  };

  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const selectedDateItems = selectedDate ? getItemsForDate(selectedDate) : [];

  const getSessionTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'practice': return 'default';
      case 'clinic': return 'secondary';
      case 'drop_in': return 'outline';
      default: return 'default';
    }
  };

  const getEventTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'clinic': return 'secondary';
      case 'camp': return 'default';
      case 'tryout': return 'outline';
      case 'tournament': return 'default';
      default: return 'outline';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'clinic': return <Target className="h-3 w-3" />;
      case 'camp': return <Tent className="h-3 w-3" />;
      case 'tryout': return <Star className="h-3 w-3" />;
      case 'tournament': return <Trophy className="h-3 w-3" />;
      default: return <CalendarDays className="h-3 w-3" />;
    }
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const sessionCheckedInCount = registrations.filter(r => r.checked_in).length;
  const sessionTotalCount = registrations.length;

  const eventCheckedInCount = eventRosters.filter(r => r.checked_in).length;
  const eventTotalCount = eventRosters.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-calendar-title">
            Event Calendar
          </h1>
          <p className="text-muted-foreground">
            View scheduled sessions and events, manage attendance
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as 'all' | 'sessions' | 'events')}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-filter-all">All</TabsTrigger>
              <TabsTrigger value="sessions" data-testid="tab-filter-sessions">Sessions</TabsTrigger>
              <TabsTrigger value="events" data-testid="tab-filter-events">Events</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={filterProgramId} onValueChange={setFilterProgramId}>
            <SelectTrigger className="w-[200px]" data-testid="select-program-filter">
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programs.map(program => (
                <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                const dayItems = getItemsForDate(day);
                const daySessions = dayItems.filter(i => i.type === 'session');
                const dayEvents = dayItems.filter(i => i.type === 'event');
                const hasItems = dayItems.length > 0;
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
                      ${hasItems ? 'hover-elevate cursor-pointer' : 'cursor-default'}
                    `}
                    data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <span className={isToday(day) ? 'text-primary' : ''}>
                      {format(day, 'd')}
                    </span>
                    {hasItems && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 items-center">
                        {daySessions.length > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" title={`${daySessions.length} session(s)`} />
                        )}
                        {dayEvents.length > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title={`${dayEvents.length} event(s)`} />
                        )}
                        {dayItems.length > 1 && (
                          <span className="text-[10px] text-muted-foreground">{dayItems.length}</span>
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
                {selectedDateItems.length > 0 
                  ? `${selectedDateSessions.length} session(s), ${selectedDateEvents.length} event(s)`
                  : 'Nothing scheduled on this date'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {selectedDateItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nothing scheduled</p>
                </div>
              ) : (
                <>
                  {(viewFilter === 'all' || viewFilter === 'sessions') && selectedDateSessions.length > 0 && (
                    <div className="space-y-2">
                      {viewFilter === 'all' && selectedDateEvents.length > 0 && (
                        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sessions</h5>
                      )}
                      {selectedDateSessions.map(session => (
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
                      ))}
                    </div>
                  )}
                  {(viewFilter === 'all' || viewFilter === 'events') && selectedDateEvents.length > 0 && (
                    <div className="space-y-2">
                      {viewFilter === 'all' && selectedDateSessions.length > 0 && (
                        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Events</h5>
                      )}
                      {selectedDateEvents.map(event => (
                        <div
                          key={event.id}
                          className="p-3 rounded-lg border border-orange-200 dark:border-orange-900/50 hover-elevate cursor-pointer"
                          onClick={() => setSelectedEvent(event)}
                          data-testid={`event-card-${event.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate flex items-center gap-1.5">
                                {getEventTypeIcon(event.event_type)}
                                {event.title}
                              </h4>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                              {event.price !== undefined && event.price > 0 && (
                                <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                                  <DollarSign className="h-3 w-3" />
                                  <span>${event.price}</span>
                                </div>
                              )}
                            </div>
                            <Badge variant={getEventTypeBadgeVariant(event.event_type)} className="shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              {event.event_type}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
                {sessionCheckedInCount}/{sessionTotalCount} checked in
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

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && getEventTypeIcon(selectedEvent.event_type)}
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent && (
                <div className="space-y-1">
                  <div>
                    {format(new Date(selectedEvent.start_time), 'EEEE, MMMM d • h:mm a')} - {format(new Date(selectedEvent.end_time), 'h:mm a')}
                    {selectedEvent.location && ` • ${selectedEvent.location}`}
                  </div>
                  {selectedEvent.price !== undefined && selectedEvent.price > 0 && (
                    <div className="text-green-600 dark:text-green-400 font-medium">
                      Price: ${selectedEvent.price}
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Roster</h4>
              <Badge variant="outline">
                {eventCheckedInCount}/{eventTotalCount} checked in
              </Badge>
            </div>

            {eventRosters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No athletes registered for this event</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {eventRosters.map(roster => {
                  const isLocked = isAthleteAccessLocked(roster.athlete.paid_through_date ?? undefined);
                  
                  return (
                    <div
                      key={roster.id}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border
                        ${roster.checked_in ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : ''}
                        ${isLocked ? 'opacity-60' : ''}
                      `}
                      data-testid={`event-roster-${roster.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={roster.checked_in ? 'bg-green-100 text-green-700' : ''}>
                            {getInitials(roster.athlete.first_name, roster.athlete.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {roster.athlete.first_name} {roster.athlete.last_name}
                          </p>
                          <div className="flex items-center gap-2">
                            {isLocked ? (
                              <span className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Payment overdue
                              </span>
                            ) : roster.checked_in ? (
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
                        variant={roster.checked_in ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleEventCheckIn(roster)}
                        disabled={isLocked && !roster.checked_in || eventCheckInMutation.isPending}
                        data-testid={`button-event-checkin-${roster.id}`}
                      >
                        {roster.checked_in ? 'Check Out' : 'Check In'}
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
