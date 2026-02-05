import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Link } from 'wouter';
import { useAthlete } from '@/contexts/AthleteContext';
import { useAuth } from '@/contexts/AuthContext';
import { AthleteSwitcher } from '@/components/AthleteSwitcher';
import { isAthleteAccessLocked } from '@shared/schema';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Athlete, Session } from '@shared/schema';
import {
  Calendar,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle,
  Plus,
  UserPlus,
  GraduationCap,
  Users,
  FileText,
  FileSignature,
  UserX,
} from 'lucide-react';

interface AvailableContractsResponse {
  not_assigned: boolean;
  message?: string;
  contracts: Array<{
    id: string;
    name: string;
    monthly_price: number;
  }>;
}

interface AthleteContract {
  id: string;
  athlete_id: string;
  program_contract_id: string;
  signed_at?: string;
  status: 'active' | 'cancelled' | 'expired';
}
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ContractGate } from '@/components/ContractGate';

export default function ParentDashboard() {
  const { activeAthlete, setActiveAthlete, setAthletes } = useAthlete();
  const { club } = useAuth();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [registeringSessionId, setRegisteringSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    graduation_year: new Date().getFullYear() + 10,
    avp_number: '',
    bvca_number: '',
    aau_number: '',
    bvne_number: '',
    p1440_number: '',
  });

  const { data: athletes = [], isLoading: athletesLoading } = useQuery<Athlete[]>({
    queryKey: ['/api/athletes'],
  });

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
  });

  const { data: unviewedFormsCount } = useQuery<{ count: number }>({
    queryKey: ['/api/my-unviewed-forms-count'],
  });

  const { data: contractsResponse } = useQuery<AvailableContractsResponse>({
    queryKey: ['/api/athletes', activeAthlete?.id, 'available-contracts'],
    enabled: !!activeAthlete?.id,
  });

  const { data: currentContract } = useQuery<AthleteContract | null>({
    queryKey: ['/api/athletes', activeAthlete?.id, 'contract'],
    enabled: !!activeAthlete?.id,
  });

  const isNotAssigned = contractsResponse?.not_assigned || false;
  const hasActiveContract = currentContract && currentContract.status === 'active';
  const needsContractSignature = !isNotAssigned && !hasActiveContract && (contractsResponse?.contracts?.length ?? 0) > 0;

  const createAthleteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/athletes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/athletes'] });
      setAddDialogOpen(false);
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        graduation_year: new Date().getFullYear() + 10,
        avp_number: '',
        bvca_number: '',
        aau_number: '',
        bvne_number: '',
        p1440_number: '',
      });
      toast({
        title: 'Athlete Added',
        description: 'Your athlete has been added to your family.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add athlete. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!activeAthlete) throw new Error('No athlete selected');
      setRegisteringSessionId(sessionId);
      return apiRequest('POST', `/api/sessions/${sessionId}/register`, {
        athlete_id: activeAthlete.id,
      });
    },
    onSuccess: () => {
      setRegisteringSessionId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({
        title: 'Registered!',
        description: `${activeAthlete?.first_name} has been registered for the session.`,
      });
    },
    onError: (error: Error) => {
      setRegisteringSessionId(null);
      toast({
        title: 'Registration Failed',
        description: error.message || 'Could not register for session. Please try again.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (athletes.length > 0 && !activeAthlete) {
      setAthletes(athletes);
      setActiveAthlete(athletes[0]);
    }
  }, [athletes, activeAthlete, setAthletes, setActiveAthlete]);

  const isLocked = activeAthlete ? isAthleteAccessLocked(activeAthlete.paid_through_date ?? undefined) : false;

  const upcomingSessions = sessions.slice(0, 3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAthleteMutation.mutate(formData);
  };

  const handleRegister = (sessionId: string) => {
    if (!activeAthlete) {
      toast({
        title: 'Select an Athlete',
        description: 'Please select an athlete first.',
        variant: 'destructive',
      });
      return;
    }
    registerMutation.mutate(sessionId);
  };

  if (athletesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContractGate />
      
      {unviewedFormsCount && unviewedFormsCount.count > 0 && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4" data-testid="alert-new-forms">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-800 dark:text-blue-300">New Forms Available</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                You have {unviewedFormsCount.count} new form{unviewedFormsCount.count !== 1 ? 's' : ''} to review and fill out.
              </p>
              <Link href="/forms">
                <Button size="sm" variant="outline" className="mt-3" data-testid="button-view-forms">
                  <FileText className="h-4 w-4 mr-2" />
                  View Forms
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground">
            Manage your athletes' schedules and registrations
          </p>
        </div>
        {athletes.length > 0 && <AthleteSwitcher />}
      </div>

      {activeAthlete && isNotAssigned && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4" data-testid="alert-not-assigned">
          <div className="flex items-start gap-3">
            <UserX className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-300">Not Yet Assigned to a Program</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {activeAthlete.first_name} has not been assigned to a team or program yet. 
                Your director will assign them to a program before you can enroll in a contract.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeAthlete && needsContractSignature && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4" data-testid="alert-contract-needed">
          <div className="flex items-start gap-3">
            <FileSignature className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-300">Contract Enrollment Available</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                {activeAthlete.first_name} has been assigned to a program. Please review and sign a contract to complete enrollment.
              </p>
              <Link href="/contracts">
                <Button size="sm" variant="outline" className="mt-3" data-testid="button-view-contracts">
                  <FileSignature className="h-4 w-4 mr-2" />
                  View Contracts
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {isLocked && activeAthlete && !isNotAssigned && hasActiveContract && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4" data-testid="alert-payment-required">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Payment Required</h3>
              <p className="text-sm text-destructive/80 mt-1">
                {activeAthlete.first_name}'s account is past due. Please make a payment to continue registering for sessions.
              </p>
              <Link href="/payments">
                <Button size="sm" variant="destructive" className="mt-3" data-testid="button-make-payment">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Make Payment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              My Family
            </CardTitle>
            <CardDescription>
              {athletes.length} athlete{athletes.length !== 1 ? 's' : ''} registered
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-athlete">
                <Plus className="h-4 w-4 mr-2" />
                Add Athlete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Athlete</DialogTitle>
                <DialogDescription>
                  Add a new athlete to your family account.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      required
                      data-testid="input-dob"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="graduation_year">Graduation Year</Label>
                    <Input
                      id="graduation_year"
                      type="number"
                      min={2020}
                      max={2040}
                      value={formData.graduation_year}
                      onChange={(e) => setFormData({ ...formData, graduation_year: parseInt(e.target.value) })}
                      required
                      data-testid="input-graduation-year"
                    />
                  </div>
                </div>
                
                {club?.sport === 'beach_volleyball' && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Organization Membership Numbers (Optional)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="avp">AVP</Label>
                        <Input
                          id="avp"
                          placeholder="Membership #"
                          value={formData.avp_number}
                          onChange={(e) => setFormData({ ...formData, avp_number: e.target.value })}
                          data-testid="input-athlete-avp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aau">AAU</Label>
                        <Input
                          id="aau"
                          placeholder="Membership #"
                          value={formData.aau_number}
                          onChange={(e) => setFormData({ ...formData, aau_number: e.target.value })}
                          data-testid="input-athlete-aau"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bvca">BVCA</Label>
                        <Input
                          id="bvca"
                          placeholder="Membership #"
                          value={formData.bvca_number}
                          onChange={(e) => setFormData({ ...formData, bvca_number: e.target.value })}
                          data-testid="input-athlete-bvca"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bvne">BVNE</Label>
                        <Input
                          id="bvne"
                          placeholder="Membership #"
                          value={formData.bvne_number}
                          onChange={(e) => setFormData({ ...formData, bvne_number: e.target.value })}
                          data-testid="input-athlete-bvne"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p1440">p1440</Label>
                        <Input
                          id="p1440"
                          placeholder="Membership #"
                          value={formData.p1440_number}
                          onChange={(e) => setFormData({ ...formData, p1440_number: e.target.value })}
                          data-testid="input-athlete-p1440"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={createAthleteMutation.isPending} data-testid="button-submit-athlete">
                  {createAthleteMutation.isPending ? 'Adding...' : 'Add Athlete'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {athletes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No athletes registered yet.</p>
              <p className="text-sm">Click "Add Athlete" to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {athletes.map((athlete) => {
                const athleteLocked = isAthleteAccessLocked(athlete.paid_through_date ?? undefined);
                const isActive = activeAthlete?.id === athlete.id;
                return (
                  <div
                    key={athlete.id}
                    className={`p-4 rounded-md border cursor-pointer transition-colors ${
                      isActive ? 'border-primary bg-primary/5' : 'hover-elevate'
                    }`}
                    onClick={() => {
                      setActiveAthlete(athlete);
                    }}
                    data-testid={`card-athlete-${athlete.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {athlete.first_name} {athlete.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <GraduationCap className="h-3.5 w-3.5" />
                          Class of {athlete.graduation_year || 'N/A'}
                        </div>
                        {athlete.date_of_birth && (
                          <div className="text-sm text-muted-foreground mt-0.5">
                            Born {format(new Date(athlete.date_of_birth), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                      {athleteLocked ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Past Due
                        </Badge>
                      ) : athlete.paid_through_date ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {activeAthlete && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
                <CardDescription>Sessions for {activeAthlete.first_name}</CardDescription>
              </div>
              <Link href="/schedule">
                <Button variant="ghost" size="sm" data-testid="link-view-schedule">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingSessions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No upcoming sessions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="p-4 rounded-md bg-muted/50 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{session.title}</div>
                          <div className="text-sm text-muted-foreground mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(session.start_time), 'EEE, MMM d')}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(session.start_time), 'h:mm a')} - {format(new Date(session.end_time), 'h:mm a')}
                            </div>
                            {session.facility_id && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5" />
                                {session.facility_id}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary">{session.session_type}</Badge>
                      </div>
                      <Button
                        className="w-full"
                        disabled={isLocked || registeringSessionId === session.id}
                        onClick={() => handleRegister(session.id)}
                        data-testid={`button-register-session-${session.id}`}
                      >
                        {isLocked ? (
                          <>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Payment Required
                          </>
                        ) : registeringSessionId === session.id ? (
                          'Registering...'
                        ) : (
                          'Register Now'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks and actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/athletes">
                <Button variant="outline" className="w-full justify-start" data-testid="link-manage-athletes">
                  <Users className="h-4 w-4 mr-3" />
                  Manage Athletes
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <Link href="/schedule">
                <Button variant="outline" className="w-full justify-start" data-testid="link-view-full-schedule">
                  <Calendar className="h-4 w-4 mr-3" />
                  View Full Schedule
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <Link href="/payments">
                <Button variant="outline" className="w-full justify-start" data-testid="link-payment-history">
                  <CreditCard className="h-4 w-4 mr-3" />
                  Payment History
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
