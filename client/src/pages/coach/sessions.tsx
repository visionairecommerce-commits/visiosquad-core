import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cancelSessionSchema, type CancelSession, isAthleteAccessLocked } from '@shared/schema';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  AlertCircle,
  XCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface AthleteRegistration {
  id: string;
  athlete_id: string;
  first_name: string;
  last_name: string;
  paid_through_date: string | null;
  checked_in: boolean;
}

interface Session {
  id: string;
  title: string;
  session_type: 'practice' | 'clinic' | 'drop_in';
  team_name: string | null;
  program_name: string;
  start_time: string;
  end_time: string;
  location: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  registrations: AthleteRegistration[];
}

const today = new Date();

const initialSession: Session = {
  id: '1',
  title: 'Team Alpha Practice',
  session_type: 'practice',
  team_name: 'Team Alpha',
  program_name: 'Youth Soccer',
  start_time: format(today, "yyyy-MM-dd'T'16:00"),
  end_time: format(today, "yyyy-MM-dd'T'17:30"),
  location: 'Field 1',
  status: 'scheduled',
  registrations: [
    { id: '1', athlete_id: 'a1', first_name: 'Emma', last_name: 'Wilson', paid_through_date: '2026-02-15', checked_in: true },
    { id: '2', athlete_id: 'a2', first_name: 'Jake', last_name: 'Thompson', paid_through_date: '2026-01-10', checked_in: true },
    { id: '3', athlete_id: 'a3', first_name: 'Sophia', last_name: 'Garcia', paid_through_date: '2026-02-20', checked_in: false },
    { id: '4', athlete_id: 'a4', first_name: 'Liam', last_name: 'Martinez', paid_through_date: '2026-01-05', checked_in: false },
    { id: '5', athlete_id: 'a5', first_name: 'Olivia', last_name: 'Johnson', paid_through_date: null, checked_in: false },
    { id: '6', athlete_id: 'a6', first_name: 'Noah', last_name: 'Davis', paid_through_date: '2026-03-01', checked_in: true },
  ],
};

export default function CoachSessionsPage() {
  const [session, setSession] = useState<Session>(initialSession);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { toast } = useToast();

  const cancelForm = useForm<CancelSession>({
    resolver: zodResolver(cancelSessionSchema),
    defaultValues: {
      reason: '',
    },
  });

  const handleCheckIn = (registrationId: string, checkedIn: boolean) => {
    const registration = session.registrations.find(r => r.id === registrationId);
    if (!registration) return;

    const isLocked = isAthleteAccessLocked(registration.paid_through_date ?? undefined);
    if (isLocked && checkedIn) {
      toast({
        title: 'Cannot Check In',
        description: 'This athlete has an overdue payment and cannot be checked in.',
        variant: 'destructive',
      });
      return;
    }

    setSession({
      ...session,
      registrations: session.registrations.map(r =>
        r.id === registrationId ? { ...r, checked_in: checkedIn } : r
      ),
    });

    toast({
      title: checkedIn ? 'Checked In' : 'Checked Out',
      description: `${registration.first_name} ${registration.last_name} has been ${checkedIn ? 'checked in' : 'checked out'}.`,
    });
  };

  const handleCancelSession = (data: CancelSession) => {
    setSession({ ...session, status: 'cancelled' });
    setCancelDialogOpen(false);
    cancelForm.reset();

    const parentEmails = session.registrations.length;

    toast({
      title: 'Session Cancelled',
      description: `Cancellation email sent to ${parentEmails} parent(s).`,
      variant: 'destructive',
    });
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const checkedInCount = session.registrations.filter(r => r.checked_in).length;
  const totalCount = session.registrations.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
          <p className="text-muted-foreground">
            {session.program_name}
            {session.team_name && ` • ${session.team_name}`}
          </p>
        </div>
        {session.status !== 'cancelled' && (
          <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" data-testid="button-cancel-session">
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Practice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Cancel Session
                </DialogTitle>
                <DialogDescription>
                  This will notify all registered parents via email. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <Form {...cancelForm}>
                <form onSubmit={cancelForm.handleSubmit(handleCancelSession)} className="space-y-4">
                  <FormField
                    control={cancelForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cancellation Reason</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Weather conditions, Field maintenance..."
                            {...field}
                            data-testid="input-cancel-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="rounded-md bg-destructive/10 p-3 text-sm">
                    <p className="font-medium text-destructive">
                      {session.registrations.length} parent(s) will be notified
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)}>
                      Keep Session
                    </Button>
                    <Button type="submit" variant="destructive" data-testid="button-confirm-cancel">
                      Cancel Session
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {session.status === 'cancelled' && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="font-medium text-destructive">This session has been cancelled</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Date</div>
                <div className="font-medium">{format(new Date(session.start_time), 'EEE, MMM d')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Time</div>
                <div className="font-medium">
                  {format(new Date(session.start_time), 'h:mm a')} - {format(new Date(session.end_time), 'h:mm a')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Location</div>
                <div className="font-medium">{session.location}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Attendance</div>
                <div className="font-medium">{checkedInCount}/{totalCount} checked in</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attendance</CardTitle>
          <CardDescription>
            Check in athletes as they arrive. Locked athletes cannot be checked in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {session.registrations.map((registration) => {
              const isLocked = isAthleteAccessLocked(registration.paid_through_date ?? undefined);

              return (
                <div
                  key={registration.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(registration.first_name, registration.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {registration.first_name} {registration.last_name}
                        {isLocked && (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                      {isLocked && (
                        <div className="text-xs text-destructive">
                          Payment overdue - Check-in disabled
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {registration.checked_in && (
                      <Badge className="bg-accent/10 text-accent gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Checked In
                      </Badge>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`checkin-${registration.id}`}
                        checked={registration.checked_in}
                        onCheckedChange={(checked) => handleCheckIn(registration.id, checked)}
                        disabled={session.status === 'cancelled' || (isLocked && !registration.checked_in)}
                        data-testid={`switch-checkin-${registration.id}`}
                      />
                      <Label htmlFor={`checkin-${registration.id}`} className="sr-only">
                        Check in
                      </Label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
