import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { insertAthleteSchema, type InsertAthlete, isAthleteAccessLocked } from '@shared/schema';
import { useAthlete } from '@/contexts/AthleteContext';
import { Plus, AlertCircle, CheckCircle, Calendar, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const mockAthletes = [
  {
    id: '1',
    club_id: 'demo-club-1',
    parent_id: 'demo-parent-1',
    first_name: 'Emma',
    last_name: 'Wilson',
    date_of_birth: '2015-03-15',
    tags: ['U10', 'Soccer'],
    paid_through_date: '2026-02-15',
    is_locked: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    club_id: 'demo-club-1',
    parent_id: 'demo-parent-1',
    first_name: 'Jake',
    last_name: 'Wilson',
    date_of_birth: '2017-07-22',
    tags: ['U8', 'Beginners'],
    paid_through_date: '2026-01-10',
    is_locked: false,
    created_at: new Date().toISOString(),
  },
];

export default function AthletesPage() {
  const { athletes, setAthletes, setActiveAthlete } = useAthlete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (athletes.length === 0) {
      setAthletes(mockAthletes);
      setActiveAthlete(mockAthletes[0]);
    }
  }, [athletes.length, setAthletes, setActiveAthlete]);

  const form = useForm<InsertAthlete>({
    resolver: zodResolver(insertAthleteSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      date_of_birth: '',
      tags: [],
    },
  });

  const onSubmit = (data: InsertAthlete) => {
    const newAthlete = {
      id: String(athletes.length + 1),
      club_id: 'demo-club-1',
      parent_id: 'demo-parent-1',
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      tags: data.tags,
      paid_through_date: null,
      is_locked: false,
      created_at: new Date().toISOString(),
    };

    setAthletes([...athletes, newAthlete]);
    setDialogOpen(false);
    form.reset();

    toast({
      title: 'Athlete Added',
      description: `${data.first_name} ${data.last_name} has been added to your family.`,
    });
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} data-testid="input-athlete-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} data-testid="input-athlete-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-athlete-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-athlete">
                    Add Athlete
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {athletes.map((athlete) => {
          const isLocked = isAthleteAccessLocked(athlete.paid_through_date ?? undefined);
          const age = calculateAge(athlete.date_of_birth);

          return (
            <Card key={athlete.id} className="hover-elevate">
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
    </div>
  );
}
