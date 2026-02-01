import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { isAthleteAccessLocked } from '@shared/schema';
import { useAthlete } from '@/contexts/AthleteContext';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, AlertCircle, CheckCircle, Calendar, GraduationCap, Key, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Athlete } from '@shared/schema';

export default function AthletesPage() {
  const { setActiveAthlete } = useAthlete();
  const { club } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    date_of_birth: '',
    graduation_year: new Date().getFullYear() + 10,
    volleyball_life_number: '',
    avp_number: '',
    bvca_number: '',
    aau_number: '',
    bvne_number: '',
    p1440_number: '',
  });
  const [loginFormData, setLoginFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const { data: athletes = [], isLoading } = useQuery<Athlete[]>({
    queryKey: ['/api/athletes'],
  });

  const createAthleteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/athletes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/athletes'] });
      setDialogOpen(false);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        date_of_birth: '',
        graduation_year: new Date().getFullYear() + 10,
        volleyball_life_number: '',
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

  const setupLoginMutation = useMutation({
    mutationFn: async (data: { athleteId: string; email: string; password: string }) => {
      return apiRequest('POST', `/api/athletes/${data.athleteId}/setup-login`, { email: data.email, password: data.password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/athletes'] });
      setLoginDialogOpen(false);
      setSelectedAthlete(null);
      setLoginFormData({ email: '', password: '', confirmPassword: '' });
      toast({
        title: 'Login Created',
        description: 'Your athlete can now log in with their own account.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set up login. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenLoginDialog = (athlete: Athlete, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAthlete(athlete);
    setLoginFormData({ 
      email: athlete.email || '', 
      password: '', 
      confirmPassword: '' 
    });
    setLoginDialogOpen(true);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAthlete) return;
    
    if (!loginFormData.email || !loginFormData.password) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in email and password.',
        variant: 'destructive',
      });
      return;
    }
    
    if (loginFormData.password.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }
    
    if (loginFormData.password !== loginFormData.confirmPassword) {
      toast({
        title: 'Passwords Don\'t Match',
        description: 'Please make sure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }
    
    setupLoginMutation.mutate({
      athleteId: selectedAthlete.id,
      email: loginFormData.email,
      password: loginFormData.password,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.date_of_birth) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    createAthleteMutation.mutate(formData);
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Athletes</h1>
          <p className="text-muted-foreground">Manage your family's athletes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                Add a child to your family account.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    placeholder="First name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    data-testid="input-athlete-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    placeholder="Last name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    data-testid="input-athlete-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="athlete@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-athlete-email"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    required
                    data-testid="input-athlete-dob"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="graduation_year">HS Graduation Year *</Label>
                  <Input
                    id="graduation_year"
                    type="number"
                    min={2020}
                    max={2040}
                    value={formData.graduation_year}
                    onChange={(e) => setFormData({ ...formData, graduation_year: parseInt(e.target.value) })}
                    required
                    data-testid="input-athlete-graduation-year"
                  />
                </div>
              </div>
              
              {club?.sport === 'beach_volleyball' && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Membership Numbers (Optional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="volleyball_life">Volleyball Life</Label>
                      <Input
                        id="volleyball_life"
                        placeholder="Membership #"
                        value={formData.volleyball_life_number}
                        onChange={(e) => setFormData({ ...formData, volleyball_life_number: e.target.value })}
                        data-testid="input-athlete-volleyball-life"
                      />
                    </div>
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAthleteMutation.isPending} data-testid="button-submit-athlete">
                  {createAthleteMutation.isPending ? 'Adding...' : 'Add Athlete'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {athletes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Plus className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No athletes registered yet.</p>
              <p className="text-sm">Click "Add Athlete" to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {athletes.map((athlete) => {
            const isLocked = isAthleteAccessLocked(athlete.paid_through_date ?? undefined);
            const age = calculateAge(athlete.date_of_birth);

            return (
              <Card
                key={athlete.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setActiveAthlete(athlete)}
                data-testid={`card-athlete-${athlete.id}`}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-lg bg-primary/10 text-primary">
                        {getInitials(athlete.first_name, athlete.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {athlete.first_name} {athlete.last_name}
                        {isLocked && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </CardTitle>
                      <CardDescription>
                        {age} years old
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {athlete.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Born {format(new Date(athlete.date_of_birth), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      Class of {athlete.graduation_year || 'N/A'}
                    </div>
                  </div>

                  {athlete.paid_through_date && (
                    <div className="flex items-center gap-2">
                      {isLocked ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Payment Overdue
                        </Badge>
                      ) : (
                        <Badge className="bg-accent/10 text-accent gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Paid through {format(new Date(athlete.paid_through_date), 'MMM yyyy')}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    {athlete.has_login ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Has own login</span>
                        {athlete.email && <span className="text-xs">({athlete.email})</span>}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleOpenLoginDialog(athlete, e)}
                        data-testid={`button-setup-login-${athlete.id}`}
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Set Up Login
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Athlete Login</DialogTitle>
            <DialogDescription>
              {selectedAthlete && (
                <>Create a separate login for {selectedAthlete.first_name} so they can access their own schedule and messages.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="athlete_email">Email Address</Label>
              <Input
                id="athlete_email"
                type="email"
                placeholder="athlete@example.com"
                value={loginFormData.email}
                onChange={(e) => setLoginFormData({ ...loginFormData, email: e.target.value })}
                required
                data-testid="input-athlete-login-email"
              />
              <p className="text-xs text-muted-foreground">
                This will be the email your athlete uses to log in.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="athlete_password">Password</Label>
              <Input
                id="athlete_password"
                type="password"
                placeholder="At least 6 characters"
                value={loginFormData.password}
                onChange={(e) => setLoginFormData({ ...loginFormData, password: e.target.value })}
                required
                data-testid="input-athlete-login-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="athlete_confirm_password">Confirm Password</Label>
              <Input
                id="athlete_confirm_password"
                type="password"
                placeholder="Confirm password"
                value={loginFormData.confirmPassword}
                onChange={(e) => setLoginFormData({ ...loginFormData, confirmPassword: e.target.value })}
                required
                data-testid="input-athlete-login-confirm-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLoginDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={setupLoginMutation.isPending} data-testid="button-submit-athlete-login">
                {setupLoginMutation.isPending ? 'Setting up...' : 'Create Login'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
