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
import { Plus, AlertCircle, CheckCircle, Calendar, GraduationCap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Athlete } from '@shared/schema';

export default function AthletesPage() {
  const { setActiveAthlete } = useAthlete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    graduation_year: new Date().getFullYear() + 10,
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
        date_of_birth: '',
        graduation_year: new Date().getFullYear() + 10,
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
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
                  <Label htmlFor="last_name">Last Name</Label>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
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
                  <Label htmlFor="graduation_year">Graduation Year</Label>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
