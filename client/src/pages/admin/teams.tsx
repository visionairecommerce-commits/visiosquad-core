import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Users, Calendar, MoreVertical, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  program_name: string;
  athletes_count: number;
  next_session: string;
}

const programs = [
  { id: '1', name: 'Youth Soccer' },
  { id: '2', name: 'Elite Training' },
  { id: '3', name: 'Summer Camp' },
  { id: '4', name: 'Beginners' },
];

const initialTeams: Team[] = [
  { id: '1', name: 'Team Alpha', program_name: 'Youth Soccer', athletes_count: 12, next_session: 'Today, 4:00 PM' },
  { id: '2', name: 'Team Beta', program_name: 'Youth Soccer', athletes_count: 14, next_session: 'Tomorrow, 5:00 PM' },
  { id: '3', name: 'Elite Squad', program_name: 'Elite Training', athletes_count: 10, next_session: 'Wed, 6:00 PM' },
  { id: '4', name: 'Rising Stars', program_name: 'Beginners', athletes_count: 15, next_session: 'Thu, 4:00 PM' },
  { id: '5', name: 'Camp Group A', program_name: 'Summer Camp', athletes_count: 16, next_session: 'Mon, 9:00 AM' },
];

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertTeam>({
    resolver: zodResolver(insertTeamSchema),
    defaultValues: {
      name: '',
      program_id: '',
    },
  });

  const onSubmit = (data: InsertTeam) => {
    const program = programs.find(p => p.id === data.program_id);
    const newTeam: Team = {
      id: String(teams.length + 1),
      name: data.name,
      program_name: program?.name || '',
      athletes_count: 0,
      next_session: 'Not scheduled',
    };
    setTeams([...teams, newTeam]);
    setDialogOpen(false);
    form.reset();
    toast({
      title: 'Team Created',
      description: `${data.name} has been added to ${program?.name}.`,
    });
  };

  const handleDelete = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
    toast({
      title: 'Team Deleted',
      description: 'The team has been removed.',
    });
  };

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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-team">
                    Create Team
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.id} className="hover-elevate">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{team.name}</CardTitle>
                <CardDescription>{team.program_name}</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid={`button-menu-team-${team.id}`}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
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
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {team.athletes_count} athletes
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Next: {team.next_session}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
