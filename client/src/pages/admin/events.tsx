import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Trophy,
  Target,
  Tent,
  Star,
  Trash2,
  Edit,
  UserPlus,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Event, Program, Team, Facility, Athlete } from '@shared/schema';

interface EventRoster {
  id: string;
  event_id: string;
  athlete_id: string;
  checked_in: boolean;
  athlete: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface EventFormData {
  title: string;
  description: string;
  event_type: 'clinic' | 'camp' | 'tryout' | 'tournament' | 'other';
  program_id: string;
  team_id: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: number | undefined;
  price: number;
}

const initialFormData: EventFormData = {
  title: '',
  description: '',
  event_type: 'clinic',
  program_id: '',
  team_id: '',
  start_time: '',
  end_time: '',
  location: '',
  capacity: undefined,
  price: 0,
};

export default function EventsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [rosterEventId, setRosterEventId] = useState<string | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
  });

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ['/api/athletes'],
  });

  const { data: eventRosters = [] } = useQuery<EventRoster[]>({
    queryKey: ['/api/events', rosterEventId, 'rosters'],
    enabled: !!rosterEventId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      return apiRequest('POST', '/api/events', {
        title: data.title,
        description: data.description || undefined,
        event_type: data.event_type,
        program_id: data.program_id || undefined,
        team_id: data.team_id || undefined,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location || undefined,
        capacity: data.capacity || undefined,
        price: data.price,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setIsDialogOpen(false);
      setFormData(initialFormData);
      toast({
        title: 'Event Created',
        description: 'The event has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventFormData> }) => {
      return apiRequest('PATCH', `/api/events/${id}`, {
        title: data.title,
        description: data.description || undefined,
        event_type: data.event_type,
        program_id: data.program_id || null,
        team_id: data.team_id || null,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location || null,
        capacity: data.capacity || null,
        price: data.price,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setIsDialogOpen(false);
      setEditingEvent(null);
      setFormData(initialFormData);
      toast({
        title: 'Event Updated',
        description: 'The event has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update event.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setDeleteEventId(null);
      toast({
        title: 'Event Deleted',
        description: 'The event has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event.',
        variant: 'destructive',
      });
    },
  });

  const addToRosterMutation = useMutation({
    mutationFn: async ({ eventId, athleteId }: { eventId: string; athleteId: string }) => {
      return apiRequest('POST', `/api/events/${eventId}/rosters`, { athlete_id: athleteId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', rosterEventId, 'rosters'] });
      setSelectedAthleteId('');
      toast({
        title: 'Athlete Added',
        description: 'The athlete has been added to the event roster.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add athlete to roster.',
        variant: 'destructive',
      });
    },
  });

  const removeFromRosterMutation = useMutation({
    mutationFn: async ({ eventId, rosterId }: { eventId: string; rosterId: string }) => {
      return apiRequest('DELETE', `/api/events/${eventId}/rosters/${rosterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', rosterEventId, 'rosters'] });
      toast({
        title: 'Athlete Removed',
        description: 'The athlete has been removed from the event roster.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove athlete from roster.',
        variant: 'destructive',
      });
    },
  });

  const handleAddToRoster = () => {
    if (!rosterEventId || !selectedAthleteId) return;
    addToRosterMutation.mutate({ eventId: rosterEventId, athleteId: selectedAthleteId });
  };

  const handleRemoveFromRoster = (rosterId: string) => {
    if (!rosterEventId) return;
    removeFromRosterMutation.mutate({ eventId: rosterEventId, rosterId });
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const availableAthletes = athletes.filter(
    a => !eventRosters.some(r => r.athlete_id === a.id)
  );

  const rosterEvent = events.find(e => e.id === rosterEventId);

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type as EventFormData['event_type'],
      program_id: event.program_id || '',
      team_id: event.team_id || '',
      start_time: event.start_time.slice(0, 16),
      end_time: event.end_time.slice(0, 16),
      location: event.location || '',
      capacity: event.capacity || undefined,
      price: event.price,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'clinic': return <Target className="h-4 w-4" />;
      case 'camp': return <Tent className="h-4 w-4" />;
      case 'tryout': return <Star className="h-4 w-4" />;
      case 'tournament': return <Trophy className="h-4 w-4" />;
      default: return <CalendarDays className="h-4 w-4" />;
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

  const upcomingEvents = events.filter(e => new Date(e.start_time) >= new Date());
  const pastEvents = events.filter(e => new Date(e.start_time) < new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-events-title">
            Events
          </h1>
          <p className="text-muted-foreground">
            Create and manage clinics, camps, tryouts, and tournaments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingEvent(null);
            setFormData(initialFormData);
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} data-testid="button-create-event">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? 'Edit Event' : 'Create New Event'}
                </DialogTitle>
                <DialogDescription>
                  {editingEvent 
                    ? 'Update the event details below.'
                    : 'Fill in the details to create a new event.'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Spring Clinic 2026"
                    required
                    data-testid="input-event-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event_type">Event Type</Label>
                  <Select
                    value={formData.event_type}
                    onValueChange={(value) => setFormData({ ...formData, event_type: value as EventFormData['event_type'] })}
                  >
                    <SelectTrigger data-testid="select-event-type">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinic">Clinic</SelectItem>
                      <SelectItem value="camp">Camp</SelectItem>
                      <SelectItem value="tryout">Tryout</SelectItem>
                      <SelectItem value="tournament">Tournament</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the event..."
                    rows={3}
                    data-testid="textarea-event-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Date/Time</Label>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      data-testid="input-event-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Date/Time</Label>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      data-testid="input-event-end-time"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Select
                    value={formData.location}
                    onValueChange={(value) => setFormData({ ...formData, location: value })}
                  >
                    <SelectTrigger data-testid="select-event-location">
                      <SelectValue placeholder="Select a facility" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities.map(facility => (
                        <SelectItem key={facility.id} value={facility.name}>
                          {facility.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      data-testid="input-event-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity (Optional)</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      value={formData.capacity || ''}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Unlimited"
                      data-testid="input-event-capacity"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="program_id">Associated Program (Optional)</Label>
                  <Select
                    value={formData.program_id}
                    onValueChange={(value) => setFormData({ ...formData, program_id: value })}
                  >
                    <SelectTrigger data-testid="select-event-program">
                      <SelectValue placeholder="No program association" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No program association</SelectItem>
                      {programs.map(program => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team_id">Associated Team (Optional)</Label>
                  <Select
                    value={formData.team_id}
                    onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                  >
                    <SelectTrigger data-testid="select-event-team">
                      <SelectValue placeholder="No team association" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No team association</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-event"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-event"
                >
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading events...</div>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Events Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first clinic, camp, tryout, or tournament.
              </p>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcomingEvents.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Upcoming Events</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map(event => (
                  <Card key={event.id} data-testid={`event-card-${event.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          {getEventTypeIcon(event.event_type)}
                          {event.title}
                        </CardTitle>
                        <Badge variant={getEventTypeBadgeVariant(event.event_type)}>
                          {event.event_type}
                        </Badge>
                      </div>
                      <CardDescription>
                        {event.description || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm space-y-1.5">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {format(new Date(event.start_time), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.capacity && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span>Capacity: {event.capacity}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>${event.price}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 flex-wrap">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setRosterEventId(event.id)}
                          data-testid={`button-manage-roster-${event.id}`}
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          Roster
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(event)}
                          data-testid={`button-edit-event-${event.id}`}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => setDeleteEventId(event.id)}
                          data-testid={`button-delete-event-${event.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">Past Events</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pastEvents.map(event => (
                  <Card key={event.id} className="opacity-60" data-testid={`past-event-card-${event.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          {getEventTypeIcon(event.event_type)}
                          {event.title}
                        </CardTitle>
                        <Badge variant="outline">
                          {event.event_type}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(event.start_time), 'MMM d, yyyy h:mm a')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteEventId} onOpenChange={(open) => !open && setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event and remove all associated registrations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEventId && deleteMutation.mutate(deleteEventId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!rosterEventId} onOpenChange={(open) => !open && setRosterEventId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {rosterEvent?.title} - Roster
            </DialogTitle>
            <DialogDescription>
              {rosterEvent && (
                <>
                  {format(new Date(rosterEvent.start_time), 'EEEE, MMMM d • h:mm a')}
                  {rosterEvent.location && ` • ${rosterEvent.location}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="add-athlete">Add Athlete</Label>
                <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId}>
                  <SelectTrigger data-testid="select-athlete-to-add">
                    <SelectValue placeholder="Select an athlete" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAthletes.length === 0 ? (
                      <SelectItem value="" disabled>No available athletes</SelectItem>
                    ) : (
                      availableAthletes.map(athlete => (
                        <SelectItem key={athlete.id} value={athlete.id}>
                          {athlete.first_name} {athlete.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddToRoster}
                disabled={!selectedAthleteId || addToRosterMutation.isPending}
                data-testid="button-add-to-roster"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Current Roster</h4>
                <Badge variant="outline">{eventRosters.length} athlete(s)</Badge>
              </div>

              {eventRosters.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No athletes registered yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {eventRosters.map(roster => (
                    <div
                      key={roster.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`roster-entry-${roster.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(roster.athlete.first_name, roster.athlete.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">
                          {roster.athlete.first_name} {roster.athlete.last_name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFromRoster(roster.id)}
                        disabled={removeFromRosterMutation.isPending}
                        data-testid={`button-remove-from-roster-${roster.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
