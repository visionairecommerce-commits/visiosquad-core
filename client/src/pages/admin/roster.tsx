import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, UserPlus, Check, ChevronsUpDown, FileCheck, FileX, GraduationCap, Users, Unlock } from 'lucide-react';
import { isAthleteAccessLocked } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Athlete, Team, Program, AthleteTeamRoster, ProgramContract, AthleteContract } from '@shared/schema';
import { cn } from '@/lib/utils';
import { DollarSign } from 'lucide-react';

interface EnrichedRosterEntry extends AthleteTeamRoster {
  athlete_name: string;
  graduation_year: number;
  team_name: string;
}

export default function RosterPage() {
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedGradYear, setSelectedGradYear] = useState<string>('all');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [athleteSearchOpen, setAthleteSearchOpen] = useState(false);
  const { toast } = useToast();

  const { data: athletes = [] } = useQuery<Athlete[]>({ queryKey: ['/api/athletes'] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ['/api/teams'] });
  const { data: programs = [] } = useQuery<Program[]>({ queryKey: ['/api/programs'] });
  const { data: roster = [] } = useQuery<EnrichedRosterEntry[]>({ queryKey: ['/api/roster'] });
  const { data: programContracts = [] } = useQuery<ProgramContract[]>({ queryKey: ['/api/program-contracts'] });
  const { data: athleteContracts = [] } = useQuery<AthleteContract[]>({ queryKey: ['/api/athlete-contracts'] });

  const assignMutation = useMutation({
    mutationFn: async (data: { athlete_id: string; team_id: string; program_id: string }) => {
      return apiRequest('POST', '/api/roster/assign', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roster'] });
      setAssignDialogOpen(false);
      setSelectedAthleteId('');
      setSelectedTeamId('');
      toast({ title: 'Athlete Assigned', description: 'The athlete has been added to the roster.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to assign athlete.', variant: 'destructive' });
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: async ({ rosterId, contractSigned }: { rosterId: string; contractSigned: boolean }) => {
      return apiRequest('PATCH', `/api/roster/${rosterId}/contract`, { contract_signed: contractSigned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roster'] });
      toast({ title: 'Contract Updated', description: 'Contract status has been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update contract.', variant: 'destructive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (rosterId: string) => {
      return apiRequest('DELETE', `/api/roster/${rosterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roster'] });
      toast({ title: 'Removed', description: 'Athlete removed from roster.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove athlete.', variant: 'destructive' });
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async (athleteId: string) => {
      return apiRequest('POST', `/api/athletes/${athleteId}/grant-access`, { days: 30 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/athletes'] });
      toast({ title: 'Access Granted', description: 'Athlete now has 30 days of access for testing.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to grant access.', variant: 'destructive' });
    },
  });

  const assignContractMutation = useMutation({
    mutationFn: async ({ athleteId, programContractId }: { athleteId: string; programContractId: string }) => {
      const today = new Date().toISOString().split('T')[0];
      return apiRequest('POST', '/api/athlete-contracts', {
        athlete_id: athleteId,
        program_contract_id: programContractId,
        start_date: today,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/athlete-contracts'] });
      toast({ title: 'Contract Assigned', description: 'Pricing contract has been assigned to the athlete.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to assign contract.', variant: 'destructive' });
    },
  });

  const athleteActiveContracts = useMemo(() => {
    const map = new Map<string, AthleteContract>();
    athleteContracts
      .filter(c => c.status === 'active')
      .forEach(c => map.set(c.athlete_id, c));
    return map;
  }, [athleteContracts]);

  const getContractsForProgram = (programId: string) => {
    return programContracts.filter(c => c.program_id === programId);
  };

  const athleteRosterMap = useMemo(() => {
    const map = new Map<string, string[]>();
    roster.forEach(entry => {
      const existing = map.get(entry.athlete_id) || [];
      const team = teams.find(t => t.id === entry.team_id);
      if (team) {
        existing.push(team.name);
      }
      map.set(entry.athlete_id, existing);
    });
    return map;
  }, [roster, teams]);

  const getAthleteDisplayLabel = (athlete: Athlete) => {
    const teamCodes = athleteRosterMap.get(athlete.id) || [];
    const teamDisplay = teamCodes.length > 0 ? teamCodes.join(', ') : 'UNASSIGNED';
    return `${athlete.first_name} ${athlete.last_name} (${athlete.graduation_year || 'N/A'}) - ${teamDisplay}`;
  };

  const gradYears = useMemo(() => {
    const years = new Set<number>();
    athletes.forEach(a => a.graduation_year && years.add(a.graduation_year));
    return Array.from(years).sort();
  }, [athletes]);

  const filteredRoster = useMemo(() => {
    return roster.filter(entry => {
      if (selectedProgram !== 'all' && entry.program_id !== selectedProgram) return false;
      if (selectedGradYear !== 'all' && entry.graduation_year !== parseInt(selectedGradYear)) return false;
      if (contractFilter === 'signed' && !entry.contract_signed) return false;
      if (contractFilter === 'unsigned' && entry.contract_signed) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!entry.athlete_name.toLowerCase().includes(query) && !entry.team_name.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [roster, selectedProgram, selectedGradYear, contractFilter, searchQuery]);

  const groupedByTeam = useMemo(() => {
    const map = new Map<string, EnrichedRosterEntry[]>();
    filteredRoster.forEach(entry => {
      const existing = map.get(entry.team_id) || [];
      existing.push(entry);
      map.set(entry.team_id, existing);
    });
    return map;
  }, [filteredRoster]);

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const handleAssign = () => {
    const team = teams.find(t => t.id === selectedTeamId);
    if (!team) return;
    assignMutation.mutate({
      athlete_id: selectedAthleteId,
      team_id: selectedTeamId,
      program_id: team.program_id,
    });
  };

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Master Roster</h1>
          <p className="text-muted-foreground">Manage athlete assignments and contracts</p>
        </div>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-assign-athlete">
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Athlete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Athlete to Team</DialogTitle>
              <DialogDescription>
                Select an athlete and team to create a roster assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Athlete</Label>
                <Popover open={athleteSearchOpen} onOpenChange={setAthleteSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={athleteSearchOpen}
                      className="w-full justify-between font-normal"
                      data-testid="combobox-athlete"
                    >
                      {selectedAthlete ? getAthleteDisplayLabel(selectedAthlete) : 'Search athletes...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name, grad year..." data-testid="input-athlete-search" />
                      <CommandList>
                        <CommandEmpty>No athletes found.</CommandEmpty>
                        <CommandGroup>
                          {athletes.map((athlete) => (
                            <CommandItem
                              key={athlete.id}
                              value={getAthleteDisplayLabel(athlete)}
                              onSelect={() => {
                                setSelectedAthleteId(athlete.id);
                                setAthleteSearchOpen(false);
                              }}
                              data-testid={`option-athlete-${athlete.id}`}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedAthleteId === athlete.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {athlete.first_name} {athlete.last_name}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <GraduationCap className="h-3 w-3" />
                                  Class of {athlete.graduation_year || 'N/A'}
                                  {' • '}
                                  {(athleteRosterMap.get(athlete.id) || []).join(', ') || 'UNASSIGNED'}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger data-testid="select-team">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => {
                      const program = programs.find(p => p.id === team.program_id);
                      return (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} ({program?.name || 'Unknown Program'})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleAssign}
                disabled={!selectedAthleteId || !selectedTeamId || assignMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {assignMutation.isPending ? 'Assigning...' : 'Assign to Team'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Search by name or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-muted-foreground">Program</Label>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger data-testid="select-filter-program">
                  <SelectValue />
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
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground">Grad Year</Label>
              <Select value={selectedGradYear} onValueChange={setSelectedGradYear}>
                <SelectTrigger data-testid="select-filter-grad-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {gradYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground">Contract</Label>
              <Select value={contractFilter} onValueChange={setContractFilter}>
                <SelectTrigger data-testid="select-filter-contract">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="unsigned">Unsigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {Array.from(groupedByTeam.entries()).map(([teamId, entries]) => {
          const team = teams.find(t => t.id === teamId);
          const program = programs.find(p => p.id === team?.program_id);
          return (
            <Card key={teamId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {team?.name || 'Unknown Team'}
                    </CardTitle>
                    <CardDescription>{program?.name || 'Unknown Program'}</CardDescription>
                  </div>
                  <Badge variant="secondary">{entries.length} athletes</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const athlete = athletes.find(a => a.id === entry.athlete_id);
                    const isLocked = athlete ? isAthleteAccessLocked(athlete.paid_through_date ?? undefined) : false;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`roster-entry-${entry.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(entry.athlete_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {entry.athlete_name}
                              {isLocked && <AlertCircle className="h-4 w-4 text-destructive" />}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <GraduationCap className="h-3.5 w-3.5" />
                              Class of {entry.graduation_year || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {isLocked && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => grantAccessMutation.mutate(entry.athlete_id)}
                              disabled={grantAccessMutation.isPending}
                              className="gap-1 text-xs"
                              data-testid={`button-grant-access-${entry.id}`}
                            >
                              <Unlock className="h-3 w-3" />
                              Grant Access
                            </Button>
                          )}
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <Select
                              value={athleteActiveContracts.get(entry.athlete_id)?.program_contract_id || ''}
                              onValueChange={(contractId) => {
                                if (contractId) {
                                  assignContractMutation.mutate({
                                    athleteId: entry.athlete_id,
                                    programContractId: contractId,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="w-[160px] h-8 text-xs" data-testid={`select-pricing-${entry.id}`}>
                                <SelectValue placeholder="No contract">
                                  {(() => {
                                    const activeContract = athleteActiveContracts.get(entry.athlete_id);
                                    if (!activeContract) return 'No contract';
                                    const pc = programContracts.find(c => c.id === activeContract.program_contract_id);
                                    return pc ? `${pc.name} - $${pc.monthly_price}/mo` : 'No contract';
                                  })()}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {getContractsForProgram(entry.program_id).map(pc => (
                                  <SelectItem key={pc.id} value={pc.id}>
                                    {pc.name} - ${pc.monthly_price}/mo
                                  </SelectItem>
                                ))}
                                {getContractsForProgram(entry.program_id).length === 0 && (
                                  <div className="text-xs text-muted-foreground p-2">
                                    No contracts for this program
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.contract_signed ? (
                              <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                                <FileCheck className="h-3 w-3" />
                                Signed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-orange-600 border-orange-500/40">
                                <FileX className="h-3 w-3" />
                                Unsigned
                              </Badge>
                            )}
                            <Switch
                              checked={entry.contract_signed}
                              onCheckedChange={(checked) => {
                                updateContractMutation.mutate({
                                  rosterId: entry.id,
                                  contractSigned: checked,
                                });
                              }}
                              data-testid={`switch-contract-${entry.id}`}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMutation.mutate(entry.id)}
                            data-testid={`button-remove-${entry.id}`}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {groupedByTeam.size === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No roster entries found.</p>
                <p className="text-sm">Click "Assign Athlete" to add athletes to teams.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
