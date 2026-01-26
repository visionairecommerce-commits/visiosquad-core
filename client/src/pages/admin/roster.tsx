import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, UserPlus, ArrowRight } from 'lucide-react';
import { isAthleteAccessLocked } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  program_id: string;
  program_name: string;
  team_id: string | null;
  team_name: string | null;
  paid_through_date: string | null;
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
  { id: '4', name: 'Camp Group A', program_id: '3' },
];

const initialAthletes: Athlete[] = [
  { id: '1', first_name: 'Emma', last_name: 'Wilson', program_id: '1', program_name: 'Youth Soccer', team_id: '1', team_name: 'Team Alpha', paid_through_date: '2026-02-15' },
  { id: '2', first_name: 'Jake', last_name: 'Thompson', program_id: '1', program_name: 'Youth Soccer', team_id: '1', team_name: 'Team Alpha', paid_through_date: '2026-01-10' },
  { id: '3', first_name: 'Sophia', last_name: 'Garcia', program_id: '1', program_name: 'Youth Soccer', team_id: null, team_name: null, paid_through_date: '2026-02-20' },
  { id: '4', first_name: 'Liam', last_name: 'Martinez', program_id: '1', program_name: 'Youth Soccer', team_id: null, team_name: null, paid_through_date: '2026-01-05' },
  { id: '5', first_name: 'Olivia', last_name: 'Johnson', program_id: '2', program_name: 'Elite Training', team_id: '3', team_name: 'Elite Squad', paid_through_date: '2026-03-01' },
  { id: '6', first_name: 'Noah', last_name: 'Davis', program_id: '2', program_name: 'Elite Training', team_id: null, team_name: null, paid_through_date: null },
];

export default function RosterPage() {
  const [athletes, setAthletes] = useState<Athlete[]>(initialAthletes);
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const { toast } = useToast();

  const unassignedAthletes = athletes.filter(a =>
    a.team_id === null && (selectedProgram === 'all' || a.program_id === selectedProgram)
  );

  const assignedAthletes = athletes.filter(a =>
    a.team_id !== null && (selectedProgram === 'all' || a.program_id === selectedProgram)
  );

  const handleMoveToTeam = (athleteId: string, teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    setAthletes(athletes.map(a =>
      a.id === athleteId
        ? { ...a, team_id: teamId, team_name: team?.name || null }
        : a
    ));
    toast({
      title: 'Athlete Assigned',
      description: `Athlete moved to ${team?.name}.`,
    });
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const AthleteCard = ({ athlete }: { athlete: Athlete }) => {
    const isLocked = isAthleteAccessLocked(athlete.paid_through_date ?? undefined);
    const availableTeams = teams.filter(t => t.program_id === athlete.program_id);

    return (
      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(athlete.first_name, athlete.last_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium flex items-center gap-2">
              {athlete.first_name} {athlete.last_name}
              {isLocked && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {athlete.program_name}
              {athlete.team_name && ` • ${athlete.team_name}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && (
            <Badge variant="destructive" className="text-xs">
              Locked
            </Badge>
          )}
          {!athlete.team_id && availableTeams.length > 0 && (
            <Select onValueChange={(value) => handleMoveToTeam(athlete.id, value)}>
              <SelectTrigger className="w-[140px]" data-testid={`select-team-${athlete.id}`}>
                <SelectValue placeholder="Move to Team" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roster Management</h1>
          <p className="text-muted-foreground">Assign athletes to teams and manage rosters</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-program">
              <SelectValue placeholder="Filter by program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programs.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="unassigned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="unassigned" data-testid="tab-unassigned">
            Unassigned Pool
            {unassignedAthletes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unassignedAthletes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assigned" data-testid="tab-assigned">
            Assigned Athletes
            {assignedAthletes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {assignedAthletes.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Unassigned Athletes
              </CardTitle>
              <CardDescription>
                Athletes enrolled in a program but not assigned to a team
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedAthletes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  All athletes are assigned to teams
                </p>
              ) : (
                <div className="space-y-2">
                  {unassignedAthletes.map((athlete) => (
                    <AthleteCard key={athlete.id} athlete={athlete} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assigned">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assigned Athletes</CardTitle>
              <CardDescription>
                Athletes currently assigned to teams
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignedAthletes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No athletes assigned yet
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedAthletes.map((athlete) => (
                    <AthleteCard key={athlete.id} athlete={athlete} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
