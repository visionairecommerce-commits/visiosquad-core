import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { z } from 'zod';
import { Plus, Calendar, MapPin, Users, Clock, AlertTriangle, Info, X, Repeat, Trash2, Ban } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Session {
  id: string;
  title: string;
  session_type: 'practice' | 'clinic' | 'drop_in';
  program_id: string;
  team_id: string | null;
  facility_id: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  capacity: number | null;
  price: string | null;
  status: 'scheduled' | 'cancelled' | 'completed';
  recurrence_group_id: string | null;
}

interface Program {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  program_id: string;
}

interface Facility {
  id: string;
  name: string;
  location: string | null;
}

interface Court {
  id: string;
  facility_id: string;
  name: string;
  description: string | null;
}

const singleSessionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  session_type: z.enum(['practice', 'clinic', 'drop_in']),
  program_id: z.string().min(1, 'Program is required'),
  team_id: z.string().optional(),
  facility_id: z.string().optional(),
  court_id: z.string().optional(),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  location: z.string().optional(),
  capacity: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  forceCreate: z.boolean().optional(),
});

const timeBlockSchema = z.object({
  days: z.array(z.string()).min(1, 'Select at least one day'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
});

const recurringSessionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  session_type: z.enum(['practice', 'clinic', 'drop_in']),
  program_id: z.string().min(1, 'Program is required'),
  team_id: z.string().optional(),
  facility_id: z.string().optional(),
  court_id: z.string().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  recurrence: z.object({
    startDate: z.string().min(1, 'Start date is required'),
    timeBlocks: z.array(timeBlockSchema).min(1, 'Add at least one time block'),
    repeatUntil: z.string().min(1, 'End date is required'),
  }),
  forceCreate: z.boolean().optional(),
});

type SingleSessionForm = z.infer<typeof singleSessionSchema>;
type RecurringSessionForm = z.infer<typeof recurringSessionSchema>;

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

export default function SchedulePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionMode, setSessionMode] = useState<'single' | 'recurring'>('single');
  const [conflictInfo, setConflictInfo] = useState<{
    type: 'soft' | 'hard';
    message: string;
    requiresConfirmation?: boolean;
  } | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [createCourtDialogOpen, setCreateCourtDialogOpen] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtFacilityId, setNewCourtFacilityId] = useState('');
  const { toast } = useToast();

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
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

  const { data: courts = [] } = useQuery<Court[]>({
    queryKey: ['/api/courts'],
  });

  const singleForm = useForm<SingleSessionForm>({
    resolver: zodResolver(singleSessionSchema),
    defaultValues: {
      title: '',
      description: '',
      session_type: 'practice',
      program_id: '',
      team_id: '',
      facility_id: '',
      court_id: '',
      start_time: '',
      end_time: '',
      location: '',
      forceCreate: false,
    },
  });

  const recurringForm = useForm<RecurringSessionForm>({
    resolver: zodResolver(recurringSessionSchema),
    defaultValues: {
      title: '',
      description: '',
      session_type: 'practice',
      program_id: '',
      team_id: '',
      facility_id: '',
      court_id: '',
      location: '',
      recurrence: {
        startDate: format(new Date(), 'yyyy-MM-dd'),
        timeBlocks: [{ days: [], startTime: '', endTime: '' }],
        repeatUntil: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
      },
      forceCreate: false,
    },
  });

  const { fields: timeBlocks, append: addTimeBlock, remove: removeTimeBlock } = useFieldArray({
    control: recurringForm.control,
    name: 'recurrence.timeBlocks',
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: SingleSessionForm) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const stored = localStorage.getItem('visiosport_session');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.user) {
            headers['X-User-Role'] = session.user.role || 'admin';
            headers['X-User-Id'] = session.user.id || 'demo-user';
          }
          if (session.club) {
            headers['X-Club-Id'] = session.club.id;
          }
        } catch {}
      }
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw { ...result, status: response.status };
      }
      
      return result;
    },
    onSuccess: (result) => {
      if (result.requiresConfirmation) {
        setConflictInfo({
          type: 'soft',
          message: result.message,
          requiresConfirmation: true,
        });
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      setDialogOpen(false);
      singleForm.reset();
      setConflictInfo(null);
      
      toast({
        title: 'Session Created',
        description: result.warning || 'Session has been scheduled.',
      });
    },
    onError: (error: any) => {
      if (error.conflictType === 'hard') {
        setConflictInfo({
          type: 'hard',
          message: error.message || 'Schedule conflict detected.',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to create session.',
          variant: 'destructive',
        });
      }
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: RecurringSessionForm) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const stored = localStorage.getItem('visiosport_session');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.user) {
            headers['X-User-Role'] = session.user.role || 'admin';
            headers['X-User-Id'] = session.user.id || 'demo-user';
          }
          if (session.club) {
            headers['X-Club-Id'] = session.club.id;
          }
        } catch {}
      }
      
      const response = await fetch('/api/sessions/recurring', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw { ...result, status: response.status };
      }
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      setDialogOpen(false);
      recurringForm.reset();
      setConflictInfo(null);
      
      toast({
        title: 'Sessions Created',
        description: `Created ${result.totalCreated} sessions.${result.warnings?.length ? ` ${result.warnings.length} with minor overlaps.` : ''}`,
      });
    },
    onError: (error: any) => {
      if (error.conflicts && error.conflicts.length > 0) {
        setConflictInfo({
          type: 'hard',
          message: `${error.conflicts.length} sessions could not be created due to scheduling conflicts at the same facility.`,
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to create recurring sessions.',
          variant: 'destructive',
        });
      }
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: string; reason: string }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const stored = localStorage.getItem('visiosport_session');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.user) {
            headers['X-User-Role'] = session.user.role || 'admin';
            headers['X-User-Id'] = session.user.id || 'demo-user';
          }
          if (session.club) {
            headers['X-Club-Id'] = session.club.id;
          }
        } catch {}
      }
      
      const response = await fetch(`/api/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to cancel session');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      setCancelDialogOpen(false);
      setSelectedSession(null);
      setCancelReason('');
      
      toast({
        title: 'Session Cancelled',
        description: result.notified > 0 
          ? `Session cancelled. ${result.notified} notification(s) sent.`
          : 'Session has been cancelled.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const stored = localStorage.getItem('visiosport_session');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.user) {
            headers['X-User-Role'] = session.user.role || 'admin';
            headers['X-User-Id'] = session.user.id || 'demo-user';
          }
          if (session.club) {
            headers['X-Club-Id'] = session.club.id;
          }
        } catch {}
      }
      
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete session');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      setDeleteDialogOpen(false);
      setSelectedSession(null);
      
      toast({
        title: 'Session Deleted',
        description: 'Session has been permanently removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createCourtMutation = useMutation({
    mutationFn: async ({ facilityId, name }: { facilityId: string; name: string }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const stored = localStorage.getItem('visiosport_session');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.user) {
            headers['X-User-Role'] = session.user.role || 'admin';
            headers['X-User-Id'] = session.user.id || 'demo-user';
          }
          if (session.club) {
            headers['X-Club-Id'] = session.club.id;
          }
        } catch {}
      }
      
      const response = await fetch('/api/courts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ facility_id: facilityId, name }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to create court');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courts'] });
      setCreateCourtDialogOpen(false);
      setNewCourtName('');
      setNewCourtFacilityId('');
      
      toast({
        title: 'Court Created',
        description: 'The court/field has been added.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSingleSubmit = (data: SingleSessionForm) => {
    setConflictInfo(null);
    const submitData = {
      ...data,
      team_id: data.team_id === 'all' ? undefined : data.team_id,
    };
    createSessionMutation.mutate(submitData);
  };

  const handleForceCreate = () => {
    const data = singleForm.getValues();
    createSessionMutation.mutate({ 
      ...data, 
      team_id: data.team_id === 'all' ? undefined : data.team_id,
      forceCreate: true 
    });
  };

  const onRecurringSubmit = (data: RecurringSessionForm) => {
    setConflictInfo(null);
    const submitData = {
      ...data,
      team_id: data.team_id === 'all' ? undefined : data.team_id,
    };
    createRecurringMutation.mutate(submitData);
  };

  const selectedProgramId = sessionMode === 'single' 
    ? singleForm.watch('program_id') 
    : recurringForm.watch('program_id');
  const availableTeams = teams.filter(t => t.program_id === selectedProgramId);

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'practice': return 'bg-primary/10 text-primary';
      case 'clinic': return 'bg-accent/10 text-accent-foreground';
      case 'drop_in': return 'bg-chart-3/10 text-chart-3';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'EEE, MMM d • h:mm a');
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setConflictInfo(null);
    singleForm.reset();
    recurringForm.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">Manage practices, clinics, and drop-in sessions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => open ? setDialogOpen(true) : handleDialogClose()}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-session">
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Session</DialogTitle>
              <DialogDescription>
                Schedule a single session or set up a recurring pattern.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={sessionMode} onValueChange={(v) => setSessionMode(v as 'single' | 'recurring')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single" data-testid="tab-single-session">
                  <Calendar className="h-4 w-4 mr-2" />
                  Single Session
                </TabsTrigger>
                <TabsTrigger value="recurring" data-testid="tab-recurring-session">
                  <Repeat className="h-4 w-4 mr-2" />
                  Recurring
                </TabsTrigger>
              </TabsList>

              {conflictInfo && (
                <Alert variant={conflictInfo.type === 'hard' ? 'destructive' : 'default'} className="mt-4">
                  {conflictInfo.type === 'hard' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                  <AlertTitle>{conflictInfo.type === 'hard' ? 'Conflict' : 'Warning'}</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>{conflictInfo.message}</span>
                    {conflictInfo.requiresConfirmation && (
                      <Button size="sm" onClick={handleForceCreate} className="ml-4">
                        Proceed Anyway
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <TabsContent value="single" className="mt-4">
                <Form {...singleForm}>
                  <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-4">
                    <FormField
                      control={singleForm.control}
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
                        control={singleForm.control}
                        name="session_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
                        control={singleForm.control}
                        name="program_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Program</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
                    <div className="grid grid-cols-2 gap-4">
                      {selectedProgramId && availableTeams.length > 0 && (
                        <FormField
                          control={singleForm.control}
                          name="team_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Team (Optional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-session-team">
                                    <SelectValue placeholder="All program athletes" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all">All program athletes</SelectItem>
                                  {availableTeams.map((team) => (
                                    <SelectItem key={team.id} value={team.id}>
                                      {team.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Selecting a team auto-registers team members
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={singleForm.control}
                        name="facility_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Facility</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-session-facility">
                                  <SelectValue placeholder="Select facility" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {facilities.map((facility) => (
                                  <SelectItem key={facility.id} value={facility.id}>
                                    {facility.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Used for conflict detection
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {singleForm.watch('facility_id') && (
                        <FormField
                          control={singleForm.control}
                          name="court_id"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Court/Field</FormLabel>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNewCourtFacilityId(singleForm.watch('facility_id') || '');
                                    setCreateCourtDialogOpen(true);
                                  }}
                                  data-testid="button-add-court-single"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Court
                                </Button>
                              </div>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-session-court">
                                    <SelectValue placeholder="Select court/field (optional)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {courts
                                    .filter((court) => court.facility_id === singleForm.watch('facility_id'))
                                    .map((court) => (
                                      <SelectItem key={court.id} value={court.id}>
                                        {court.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Specific court or field within the facility
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={singleForm.control}
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
                        control={singleForm.control}
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
                      control={singleForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., North end of field" {...field} data-testid="input-session-location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={handleDialogClose}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createSessionMutation.isPending} data-testid="button-submit-session">
                        {createSessionMutation.isPending ? 'Creating...' : 'Create Session'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="recurring" className="mt-4">
                <Form {...recurringForm}>
                  <form onSubmit={recurringForm.handleSubmit(onRecurringSubmit)} className="space-y-4">
                    <FormField
                      control={recurringForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Weekly Practice" {...field} data-testid="input-recurring-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={recurringForm.control}
                        name="session_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-recurring-type">
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
                        control={recurringForm.control}
                        name="program_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Program</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-recurring-program">
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
                    <div className="grid grid-cols-2 gap-4">
                      {selectedProgramId && availableTeams.length > 0 && (
                        <FormField
                          control={recurringForm.control}
                          name="team_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Team (Optional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-recurring-team">
                                    <SelectValue placeholder="All program athletes" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all">All program athletes</SelectItem>
                                  {availableTeams.map((team) => (
                                    <SelectItem key={team.id} value={team.id}>
                                      {team.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={recurringForm.control}
                        name="facility_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Facility</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-recurring-facility">
                                  <SelectValue placeholder="Select facility" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {facilities.map((facility) => (
                                  <SelectItem key={facility.id} value={facility.id}>
                                    {facility.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {recurringForm.watch('facility_id') && (
                        <FormField
                          control={recurringForm.control}
                          name="court_id"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Court/Field</FormLabel>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNewCourtFacilityId(recurringForm.watch('facility_id') || '');
                                    setCreateCourtDialogOpen(true);
                                  }}
                                  data-testid="button-add-court-recurring"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Court
                                </Button>
                              </div>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-recurring-court">
                                    <SelectValue placeholder="Select court/field (optional)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {courts
                                    .filter((court) => court.facility_id === recurringForm.watch('facility_id'))
                                    .map((court) => (
                                      <SelectItem key={court.id} value={court.id}>
                                        {court.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Specific court or field within the facility
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={recurringForm.control}
                      name="recurrence.startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-start-date" />
                          </FormControl>
                          <FormDescription>
                            Sessions will be created starting from this date
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4 border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Time Blocks</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTimeBlock({ days: [], startTime: '', endTime: '' })}
                          data-testid="button-add-time-block"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Time Block
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Create different time blocks for different days (e.g., Mon/Wed at 5 PM, Tue/Thu at 6 PM)
                      </p>
                      
                      {timeBlocks.map((block, index) => (
                        <Card key={block.id} className="relative">
                          <CardContent className="pt-4 space-y-3">
                            {timeBlocks.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2"
                                onClick={() => removeTimeBlock(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            <div className="space-y-2">
                              <Label>Days</Label>
                              <div className="flex flex-wrap gap-2">
                                {DAYS_OF_WEEK.map((day) => {
                                  const currentDays = recurringForm.watch(`recurrence.timeBlocks.${index}.days`) || [];
                                  const isChecked = currentDays.includes(day.id);
                                  return (
                                    <div key={day.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${block.id}-${day.id}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          const newDays = checked
                                            ? [...currentDays, day.id]
                                            : currentDays.filter(d => d !== day.id);
                                          recurringForm.setValue(`recurrence.timeBlocks.${index}.days`, newDays);
                                        }}
                                        data-testid={`checkbox-day-${index}-${day.id}`}
                                      />
                                      <Label htmlFor={`${block.id}-${day.id}`} className="text-sm font-normal cursor-pointer">
                                        {day.label}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={recurringForm.control}
                                name={`recurrence.timeBlocks.${index}.startTime`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Start Time</FormLabel>
                                    <FormControl>
                                      <Input type="time" {...field} data-testid={`input-block-start-${index}`} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={recurringForm.control}
                                name={`recurrence.timeBlocks.${index}.endTime`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>End Time</FormLabel>
                                    <FormControl>
                                      <Input type="time" {...field} data-testid={`input-block-end-${index}`} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <FormField
                      control={recurringForm.control}
                      name="recurrence.repeatUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repeat Until</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-repeat-until" />
                          </FormControl>
                          <FormDescription>
                            Sessions will be created for each selected day until this date
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={handleDialogClose}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createRecurringMutation.isPending} data-testid="button-submit-recurring">
                        {createRecurringMutation.isPending ? 'Creating...' : 'Create Sessions'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {sessionsLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Sessions Scheduled</h3>
            <p className="text-muted-foreground mb-4">
              Create your first session to start scheduling practices and events.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const program = programs.find(p => p.id === session.program_id);
            const team = session.team_id ? teams.find(t => t.id === session.team_id) : null;
            const facility = session.facility_id ? facilities.find(f => f.id === session.facility_id) : null;
            
            return (
              <Card key={session.id} className={session.status === 'cancelled' ? 'opacity-60' : ''} data-testid={`card-session-${session.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{session.title}</CardTitle>
                        <Badge className={getSessionTypeColor(session.session_type)}>
                          {session.session_type.replace('_', '-')}
                        </Badge>
                        {session.recurrence_group_id && (
                          <Badge variant="outline" className="gap-1">
                            <Repeat className="h-3 w-3" />
                            Recurring
                          </Badge>
                        )}
                        {session.status === 'cancelled' && (
                          <Badge variant="destructive">Cancelled</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {program?.name || 'Unknown Program'}
                        {team && ` • ${team.name}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {session.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedSession(session);
                          setCancelDialogOpen(true);
                        }}
                        data-testid={`button-cancel-session-${session.id}`}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedSession(session);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-session-${session.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDateTime(session.start_time)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(new Date(session.end_time), 'h:mm a')}
                    </div>
                    {facility && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {facility.name}
                      </div>
                    )}
                    {session.location && !facility && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {session.location}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Session Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
        setCancelDialogOpen(open);
        if (!open) {
          setSelectedSession(null);
          setCancelReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Session</DialogTitle>
            <DialogDescription>
              Cancel "{selectedSession?.title}"? This will notify registered participants via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Cancellation Reason</Label>
              <Textarea
                id="cancel-reason"
                placeholder="e.g., Weather conditions, instructor unavailable..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                data-testid="input-cancel-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setSelectedSession(null);
                setCancelReason('');
              }}
              data-testid="button-cancel-dialog-cancel"
            >
              Keep Session
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedSession) {
                  cancelSessionMutation.mutate({
                    sessionId: selectedSession.id,
                    reason: cancelReason || 'Session cancelled',
                  });
                }
              }}
              disabled={cancelSessionMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelSessionMutation.isPending ? 'Cancelling...' : 'Cancel Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Session Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setSelectedSession(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Permanently delete "{selectedSession?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedSession(null);
              }}
              data-testid="button-delete-dialog-cancel"
            >
              Keep Session
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedSession) {
                  deleteSessionMutation.mutate(selectedSession.id);
                }
              }}
              disabled={deleteSessionMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteSessionMutation.isPending ? 'Deleting...' : 'Delete Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Court Dialog */}
      <Dialog open={createCourtDialogOpen} onOpenChange={(open) => {
        setCreateCourtDialogOpen(open);
        if (!open) {
          setNewCourtName('');
          setNewCourtFacilityId('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Court/Field</DialogTitle>
            <DialogDescription>
              Add a new court or field to {facilities.find(f => f.id === newCourtFacilityId)?.name || 'the facility'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="court-name">Court/Field Name</Label>
              <Input
                id="court-name"
                placeholder="e.g., Court 1, Field A, Main Gym..."
                value={newCourtName}
                onChange={(e) => setNewCourtName(e.target.value)}
                data-testid="input-court-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateCourtDialogOpen(false);
                setNewCourtName('');
                setNewCourtFacilityId('');
              }}
              data-testid="button-cancel-create-court"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newCourtFacilityId && newCourtName.trim()) {
                  createCourtMutation.mutate({
                    facilityId: newCourtFacilityId,
                    name: newCourtName.trim(),
                  });
                }
              }}
              disabled={createCourtMutation.isPending || !newCourtName.trim()}
              data-testid="button-confirm-create-court"
            >
              {createCourtMutation.isPending ? 'Creating...' : 'Add Court'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
