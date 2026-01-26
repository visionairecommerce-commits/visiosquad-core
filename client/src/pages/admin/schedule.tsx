import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { insertSessionSchema, type InsertSession } from '@shared/schema';
import { Plus, Calendar, MapPin, Users, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';

interface Session {
  id: string;
  title: string;
  session_type: 'practice' | 'clinic' | 'drop_in';
  team_name: string | null;
  program_name: string;
  start_time: string;
  end_time: string;
  location: string;
  athletes_count: number;
  status: 'scheduled' | 'cancelled' | 'completed';
}

const programs = [
  { id: '1', name: 'Youth Soccer' },
  { id: '2', name: 'Elite Training' },
  { id: '3', name: 'Summer Camp' },
];

const teams = [
  { id: '1', name: 'Team Alpha', program_id: '1' },
  { id: '2', name: 'Team Beta', program_id: '1' },
  { id: '3', name: 'Elite Squad', program_id: '2' },
];

const today = new Date();
const initialSessions: Session[] = [
  {
    id: '1',
    title: 'Team Alpha Practice',
    session_type: 'practice',
    team_name: 'Team Alpha',
    program_name: 'Youth Soccer',
    start_time: format(today, "yyyy-MM-dd'T'16:00"),
    end_time: format(today, "yyyy-MM-dd'T'17:30"),
    location: 'Field 1',
    athletes_count: 12,
    status: 'scheduled',
  },
  {
    id: '2',
    title: 'Beginner Clinic',
    session_type: 'clinic',
    team_name: null,
    program_name: 'Youth Soccer',
    start_time: format(addDays(today, 1), "yyyy-MM-dd'T'10:00"),
    end_time: format(addDays(today, 1), "yyyy-MM-dd'T'12:00"),
    location: 'Indoor Court',
    athletes_count: 8,
    status: 'scheduled',
  },
  {
    id: '3',
    title: 'Elite Squad Training',
    session_type: 'practice',
    team_name: 'Elite Squad',
    program_name: 'Elite Training',
    start_time: format(addDays(today, 2), "yyyy-MM-dd'T'18:00"),
    end_time: format(addDays(today, 2), "yyyy-MM-dd'T'19:30"),
    location: 'Main Field',
    athletes_count: 10,
    status: 'scheduled',
  },
  {
    id: '4',
    title: 'Drop-in Session',
    session_type: 'drop_in',
    team_name: null,
    program_name: 'Youth Soccer',
    start_time: format(addDays(today, 3), "yyyy-MM-dd'T'14:00"),
    end_time: format(addDays(today, 3), "yyyy-MM-dd'T'15:00"),
    location: 'Field 2',
    athletes_count: 5,
    status: 'scheduled',
  },
];

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<InsertSession>({
    resolver: zodResolver(insertSessionSchema),
    defaultValues: {
      title: '',
      description: '',
      session_type: 'practice',
      program_id: '',
      team_id: '',
      start_time: '',
      end_time: '',
      location: '',
      capacity: undefined,
      price: undefined,
    },
  });

  const checkConflict = (start: string, end: string): { conflict: boolean; overlap: number; session?: Session } => {
    const newStart = new Date(start).getTime();
    const newEnd = new Date(end).getTime();

    for (const session of sessions) {
      if (session.status === 'cancelled') continue;
      const existingStart = new Date(session.start_time).getTime();
      const existingEnd = new Date(session.end_time).getTime();

      const overlapStart = Math.max(newStart, existingStart);
      const overlapEnd = Math.min(newEnd, existingEnd);
      const overlapMinutes = Math.max(0, (overlapEnd - overlapStart) / (1000 * 60));

      if (overlapMinutes > 0) {
        return { conflict: true, overlap: overlapMinutes, session };
      }
    }
    return { conflict: false, overlap: 0 };
  };

  const onSubmit = (data: InsertSession) => {
    const { conflict, overlap, session } = checkConflict(data.start_time, data.end_time);

    if (conflict && overlap > 15) {
      toast({
        title: 'Schedule Conflict',
        description: `This session overlaps with "${session?.title}" by ${Math.round(overlap)} minutes. Please choose a different time.`,
        variant: 'destructive',
      });
      return;
    }

    if (conflict && overlap > 0 && overlap <= 15) {
      toast({
        title: 'Warning: Minor Overlap',
        description: `This session has a ${Math.round(overlap)} minute overlap with "${session?.title}". Session saved anyway.`,
      });
    }

    const program = programs.find(p => p.id === data.program_id);
    const team = data.team_id ? teams.find(t => t.id === data.team_id) : null;

    const newSession: Session = {
      id: String(sessions.length + 1),
      title: data.title,
      session_type: data.session_type,
      team_name: team?.name || null,
      program_name: program?.name || '',
      start_time: data.start_time,
      end_time: data.end_time,
      location: data.location || '',
      athletes_count: 0,
      status: 'scheduled',
    };

    setSessions([...sessions, newSession]);
    setDialogOpen(false);
    form.reset();

    toast({
      title: 'Session Created',
      description: team
        ? `All athletes in ${team.name} have been automatically registered.`
        : 'Session has been scheduled.',
    });
  };

  const selectedProgramId = form.watch('program_id');
  const availableTeams = teams.filter(t => t.program_id === selectedProgramId);

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'practice': return 'bg-primary/10 text-primary';
      case 'clinic': return 'bg-accent/10 text-accent';
      case 'drop_in': return 'bg-chart-3/10 text-chart-3';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'EEE, MMM d • h:mm a');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">Manage practices, clinics, and drop-in sessions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-session">
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Session</DialogTitle>
              <DialogDescription>
                Schedule a practice, clinic, or drop-in session.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Team Practice" {...field} data-testid="input-session-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="session_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-session-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="practice">Practice</SelectItem>
                            <SelectItem value="clinic">Clinic</SelectItem>
                            <SelectItem value="drop_in">Drop-in</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="program_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-session-program">
                              <SelectValue placeholder="Select program" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {programs.map((program) => (
                              <SelectItem key={program.id} value={program.id}>
                                {program.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {selectedProgramId && availableTeams.length > 0 && (
                  <FormField
                    control={form.control}
                    name="team_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-session-team">
                              <SelectValue placeholder="Select team (auto-registers athletes)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTeams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Selecting a team auto-registers all team members
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-session-start" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-session-end" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Field 1" {...field} data-testid="input-session-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-session">
                    Create Session
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className={session.status === 'cancelled' ? 'opacity-60' : ''}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{session.title}</CardTitle>
                    <Badge className={getSessionTypeColor(session.session_type)}>
                      {session.session_type.replace('_', '-')}
                    </Badge>
                    {session.status === 'cancelled' && (
                      <Badge variant="destructive">Cancelled</Badge>
                    )}
                  </div>
                  <CardDescription>
                    {session.program_name}
                    {session.team_name && ` • ${session.team_name}`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {session.athletes_count}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDateTime(session.start_time)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(session.end_time), 'h:mm a')}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {session.location}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
