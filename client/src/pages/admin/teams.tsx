import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { insertTeamSchema, type InsertTeam } from '@shared/schema';
import { Plus, Users, MoreVertical, Edit, Trash2, UserCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Team {
  id: string;
  name: string;
  program_id: string;
  coach_id: string | null;
  created_at: string;
}

interface Program {
  id: string;
  name: string;
}

interface Coach {
  id: string;
  full_name: string;
  email: string;
}

export default function TeamsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const { toast } = useToast();

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: coaches = [] } = useQuery<Coach[]>({
    queryKey: ['/api/coaches'],
  });

  const form = useForm<InsertTeam>({
    resolver: zodResolver(insertTeamSchema),
    defaultValues: {
      name: '',
      program_id: '',
      coach_id: null,
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: InsertTeam) => {
      const response = await apiRequest('POST', '/api/teams', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setDialogOpen(false);
      form.reset();
      toast({ title: 'Team created successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to create team', variant: 'destructive' });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; coach_id?: string | null } }) => {
      const response = await apiRequest('PUT', `/api/teams/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setEditDialogOpen(false);
      setEditingTeam(null);
      toast({ title: 'Team updated successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to update team', variant: 'destructive' });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: 'Team deleted successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to delete team', variant: 'destructive' });
    },
  });

  const onSubmit = (data: InsertTeam) => {
    createTeamMutation.mutate(data);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setSelectedCoachId(team.coach_id || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingTeam) return;
    updateTeamMutation.mutate({
      id: editingTeam.id,
      data: {
        coach_id: selectedCoachId || null,
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteTeamMutation.mutate(id);
  };

  const getProgramName = (programId: string) => {
    const program = programs.find(p => p.id === programId);
    return program?.name || 'Unknown Program';
  };

  const getCoachName = (coachId: string | null) => {
    if (!coachId) return null;
    const coach = coaches.find(c => c.id === coachId);
    return coach?.full_name || 'Unknown Coach';
  };

  if (teamsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
            <p className="text-muted-foreground">Loading teams...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground">Organize athletes into teams within programs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-team">
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Add a new team to organize athletes within a program.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Team Alpha" {...field} data-testid="input-team-name" />
                      </FormControl>
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
                          <SelectTrigger data-testid="select-program">
                            <SelectValue placeholder="Select a program" />
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
                <FormField
                  control={form.control}
                  name="coach_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Coach (Optional)</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val || null)} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger data-testid="select-coach">
                            <SelectValue placeholder="Select a coach" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No coach assigned</SelectItem>
                          {coaches.map((coach) => (
                            <SelectItem key={coach.id} value={coach.id}>
                              {coach.full_name} ({coach.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTeamMutation.isPending} data-testid="button-submit-team">
                    {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team settings and coach assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input value={editingTeam?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Program</Label>
              <Input value={getProgramName(editingTeam?.program_id || '')} disabled />
            </div>
            <div className="space-y-2">
              <Label>Assign Coach</Label>
              <Select value={selectedCoachId} onValueChange={setSelectedCoachId}>
                <SelectTrigger data-testid="select-edit-coach">
                  <SelectValue placeholder="Select a coach" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No coach assigned</SelectItem>
                  {coaches.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.full_name} ({coach.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {coaches.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No coaches available. Coaches must first register using the club code.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateTeamMutation.isPending} data-testid="button-save-team">
                {updateTeamMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No teams yet. Create your first team to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="hover-elevate" data-testid={`card-team-${team.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <CardDescription>{getProgramName(team.program_id)}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-menu-team-${team.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(team)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(team.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  {team.coach_id ? (
                    <Badge variant="secondary" className="text-xs">
                      Coach: {getCoachName(team.coach_id)}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">No coach assigned</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
