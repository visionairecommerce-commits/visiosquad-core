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
  Search,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Cookie } from 'lucide-react';
import type { Event, Program, Team, Facility, Athlete } from '@shared/schema';
import { SnackHub } from '@/components/snack-hub';
import { useAuth } from '@/contexts/AuthContext';

interface EventRoster {
  id: string;
  event_id: string;
  athlete_id: string;
  checked_in: boolean;
  payment_id: string | null;
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
  selectedAthletes: { id: string; first_name: string; last_name: string }[];
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
  selectedAthletes: [],
};

export default function EventsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [rosterEventId, setRosterEventId] = useState<string | null>(null);
  const [snackEventId, setSnackEventId] = useState<string | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [athleteSearchQuery, setAthleteSearchQuery] = useState<string>('');
  const [formAthleteSearch, setFormAthleteSearch] = useState<string>('');

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
      const response = await apiRequest('POST', '/api/events', {
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
      const event = await response.json();
      
      // Add selected athletes to the roster
      for (const athlete of data.selectedAthletes) {
        await apiRequest('POST', `/api/events/${event.id}/rosters`, {
          athlete_id: athlete.id,
        });
      }
      
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setFormAthleteSearch('');
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

  const billAthleteMutation = useMutation({
    mutationFn: async ({ rosterId }: { rosterId: string }) => {
      return apiRequest('POST', `/api/events/rosters/${rosterId}/bill`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', rosterEventId, 'rosters'] });
      toast({
        title: 'Payment Recorded',
        description: 'The athlete has been billed for this event.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Billing Failed',
        description: error.message || 'Failed to bill athlete for event.',
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

  const handleBillAthlete = (rosterId: string) => {
    billAthleteMutation.mutate({ rosterId });
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const availableAthletes = athletes.filter(
    a => !eventRosters.some(r => r.athlete_id === a.id)
  );

  // Filter athletes by search query (searches all club athletes not yet on roster)
  const searchedAthletes = athleteSearchQuery.trim()
    ? availableAthletes.filter(a => {
        const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
        const query = athleteSearchQuery.toLowerCase().trim();
        return fullName.includes(query) || 
               a.first_name.toLowerCase().includes(query) || 
               a.last_name.toLowerCase().includes(query);
      })
    : [];

  // Filter athletes for the form (event create/edit) - exclude already selected athletes
  const formAvailableAthletes = athletes.filter(
    a => !formData.selectedAthletes.some(s => s.id === a.id)
  );
  
  const formSearchedAthletes = formAthleteSearch.trim()
    ? formAvailableAthletes.filter(a => {
        const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
        const query = formAthleteSearch.toLowerCase().trim();
        return fullName.includes(query) || 
               a.first_name.toLowerCase().includes(query) || 
               a.last_name.toLowerCase().includes(query);
      })
    : [];

  const rosterEvent = events.find(e => e.id === rosterEventId);
  const snackEvent = events.find(e => e.id === snackEventId);

  const handleExportRoster = async () => {
    if (!rosterEventId) return;
    try {
      const response = await fetch(`/api/events/${rosterEventId}/roster/export`, {
        headers: {
          'X-User-Role': localStorage.getItem('visiosport_role') || '',
          'X-User-Id': localStorage.getItem('visiosport_user_id') || '',
          'X-Club-Id': localStorage.getItem('visiosport_club_id') || '',
        },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'roster.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Roster exported successfully' });
    } catch (error) {
      toast({ title: 'Failed to export roster', variant: 'destructive' });
    }
  };

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
      selectedAthletes: [], // For editing, use the roster dialog instead
    });
    setFormAthleteSearch('');
    setIsDialogOpen(true);
  };
  
  const handleAddAthleteToForm = (athlete: { id: string; first_name: string; last_name: string }) => {
    setFormData(prev => ({
      ...prev,
      selectedAthletes: [...prev.selectedAthletes, athlete],
    }));
    setFormAthleteSearch('');
  };
  
  const handleRemoveAthleteFromForm = (athleteId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAthletes: prev.selectedAthletes.filter(a => a.id !== athleteId),
    }));
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
            Create events and manage rosters and billing for those events
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
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                  <strong>Data Retention:</strong> Event chat messages are automatically deleted 24 hours after the event ends to keep storage manageable.
                </div>
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
                    value={formData.program_id || "__none__"}
                    onValueChange={(value) => setFormData({ ...formData, program_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-event-program">
                      <SelectValue placeholder="No program association" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No program association</SelectItem>
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
                    value={formData.team_id || "__none__"}
                    onValueChange={(value) => setFormData({ ...formData, team_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-event-team">
                      <SelectValue placeholder="No team association" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No team association</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Athlete Selection Section - only show when creating */}
              {!editingEvent && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Add Athletes to Event (Optional)</Label>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search athletes by name..."
                      value={formAthleteSearch}
                      onChange={(e) => setFormAthleteSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-form-search-athlete"
                    />
                  </div>

                  {formAthleteSearch.trim() && (
                    <div className="border rounded-lg max-h-[140px] overflow-y-auto">
                      {formSearchedAthletes.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground text-center">
                          No athletes found matching "{formAthleteSearch}"
                        </div>
                      ) : (
                        formSearchedAthletes.slice(0, 5).map(athlete => (
                          <div
                            key={athlete.id}
                            className="flex items-center justify-between p-2 hover-elevate cursor-pointer border-b last:border-b-0"
                            data-testid={`form-search-result-${athlete.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {getInitials(athlete.first_name, athlete.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {athlete.first_name} {athlete.last_name}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAddAthleteToForm({ 
                                id: athlete.id, 
                                first_name: athlete.first_name, 
                                last_name: athlete.last_name 
                              })}
                              data-testid={`button-form-add-athlete-${athlete.id}`}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {formData.selectedAthletes.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Selected Athletes</span>
                        <Badge variant="outline">{formData.selectedAthletes.length}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.selectedAthletes.map(athlete => (
                          <Badge
                            key={athlete.id}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                            data-testid={`badge-selected-athlete-${athlete.id}`}
                          >
                            {athlete.first_name} {athlete.last_name}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1"
                              onClick={() => handleRemoveAthleteFromForm(athlete.id)}
                              data-testid={`button-remove-selected-${athlete.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {!formAthleteSearch.trim() && formData.selectedAthletes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Search and add athletes now, or manage the roster later
                    </p>
                  )}
                </div>
              )}

              {/* For editing events, show link to roster management */}
              {editingEvent && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    To add or remove athletes from this event, use the "Roster" button on the event card after saving.
                  </p>
                </div>
              )}

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
                          variant="secondary"
                          size="sm"
                          onClick={() => setSnackEventId(event.id)}
                          data-testid={`button-snacks-${event.id}`}
                        >
                          <Cookie className="h-3.5 w-3.5 mr-1" />
                          Snacks
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

      <Dialog open={!!rosterEventId} onOpenChange={(open) => { if (!open) { setRosterEventId(null); setAthleteSearchQuery(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="flex flex-row items-start justify-between gap-4">
            <div>
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
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportRoster}
              disabled={eventRosters.length === 0}
              data-testid="button-export-event-roster"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Add An Athlete To The Event</Label>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search athletes by name..."
                  value={athleteSearchQuery}
                  onChange={(e) => setAthleteSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-athlete"
                />
              </div>

              {athleteSearchQuery.trim() && (
                <div className="border rounded-lg max-h-[180px] overflow-y-auto">
                  {searchedAthletes.length === 0 ? (
                    <div className="py-3 px-3 text-sm text-muted-foreground text-center">
                      No athletes found matching "{athleteSearchQuery}"
                    </div>
                  ) : (
                    searchedAthletes.map(athlete => (
                      <div
                        key={athlete.id}
                        className="flex items-center justify-between p-2 hover-elevate cursor-pointer border-b last:border-b-0"
                        data-testid={`search-result-${athlete.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {getInitials(athlete.first_name, athlete.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {athlete.first_name} {athlete.last_name}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            addToRosterMutation.mutate({ eventId: rosterEventId!, athleteId: athlete.id });
                            setAthleteSearchQuery('');
                          }}
                          disabled={addToRosterMutation.isPending}
                          data-testid={`button-add-athlete-${athlete.id}`}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!athleteSearchQuery.trim() && availableAthletes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Start typing to search from {availableAthletes.length} available athlete(s)
                </p>
              )}
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
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {roster.athlete.first_name} {roster.athlete.last_name}
                          </span>
                          {roster.payment_id ? (
                            <Badge variant="outline" className="text-xs w-fit mt-0.5 text-green-600 border-green-300">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs w-fit mt-0.5 text-amber-600 border-amber-300">
                              Unpaid
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!roster.payment_id && rosterEvent && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleBillAthlete(roster.id)}
                            disabled={billAthleteMutation.isPending}
                            data-testid={`button-bill-athlete-${roster.id}`}
                          >
                            <DollarSign className="h-3.5 w-3.5 mr-1" />
                            Bill ${rosterEvent.price}
                          </Button>
                        )}
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!snackEventId} onOpenChange={(open) => { if (!open) setSnackEventId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              {snackEvent?.title} - Snack Hub
            </DialogTitle>
            <DialogDescription>
              {snackEvent && (
                <>
                  {format(new Date(snackEvent.start_time), 'EEEE, MMMM d • h:mm a')}
                  {snackEvent.location && ` • ${snackEvent.location}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {snackEventId && user && (
            <SnackHub 
              eventId={snackEventId} 
              currentUserId={user.id}
              isAdmin={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
