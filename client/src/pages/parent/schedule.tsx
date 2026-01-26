import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAthlete } from '@/contexts/AthleteContext';
import { AthleteSwitcher } from '@/components/AthleteSwitcher';
import { isAthleteAccessLocked, calculateConvenienceFee } from '@shared/schema';
import {
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle,
  CreditCard,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { useState } from 'react';

const today = new Date();

interface Session {
  id: string;
  title: string;
  session_type: 'practice' | 'clinic' | 'drop_in';
  date: string;
  time: string;
  location: string;
  registered: boolean;
  price?: number;
  tags: string[];
}

const allSessions: Session[] = [
  {
    id: '1',
    title: 'Team Alpha Practice',
    session_type: 'practice',
    date: format(today, 'yyyy-MM-dd'),
    time: '4:00 PM - 5:30 PM',
    location: 'Field 1',
    registered: true,
    tags: ['U10', 'Soccer'],
  },
  {
    id: '2',
    title: 'Skills Clinic',
    session_type: 'clinic',
    date: format(addDays(today, 2), 'yyyy-MM-dd'),
    time: '10:00 AM - 12:00 PM',
    location: 'Indoor Court',
    registered: false,
    price: 50,
    tags: ['U10', 'U8', 'Soccer'],
  },
  {
    id: '3',
    title: 'Drop-in Session',
    session_type: 'drop_in',
    date: format(addDays(today, 4), 'yyyy-MM-dd'),
    time: '3:00 PM - 4:00 PM',
    location: 'Field 2',
    registered: false,
    price: 15,
    tags: ['U10', 'U8', 'Soccer', 'Beginners'],
  },
  {
    id: '4',
    title: 'Advanced Training',
    session_type: 'clinic',
    date: format(addDays(today, 5), 'yyyy-MM-dd'),
    time: '5:00 PM - 7:00 PM',
    location: 'Main Field',
    registered: false,
    price: 75,
    tags: ['U12', 'Elite'],
  },
  {
    id: '5',
    title: 'Beginner Fundamentals',
    session_type: 'practice',
    date: format(addDays(today, 6), 'yyyy-MM-dd'),
    time: '10:00 AM - 11:00 AM',
    location: 'Practice Field',
    registered: true,
    tags: ['U8', 'Beginners'],
  },
];

export default function ParentSchedulePage() {
  const { activeAthlete } = useAthlete();
  const { toast } = useToast();
  const [sessions, setSessions] = useState(allSessions);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'ach'>('credit_card');

  const isLocked = activeAthlete ? isAthleteAccessLocked(activeAthlete.paid_through_date ?? undefined) : false;

  const filteredSessions = activeAthlete
    ? sessions.filter(session =>
        session.tags.some(tag => activeAthlete.tags?.includes(tag))
      )
    : sessions;

  const handleRegister = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (isLocked) {
      toast({
        title: 'Payment Required',
        description: 'Please update your payment to register for sessions.',
        variant: 'destructive',
      });
      return;
    }

    const finalPrice = session.price ? calculateConvenienceFee(session.price, paymentMethod) : 0;

    setSessions(sessions.map(s =>
      s.id === sessionId ? { ...s, registered: true } : s
    ));

    toast({
      title: 'Registration Complete',
      description: session.price
        ? `Registered for ${session.title}. Total: $${finalPrice.toFixed(2)}`
        : `Registered for ${session.title}`,
    });
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'practice': return 'bg-primary/10 text-primary';
      case 'clinic': return 'bg-accent/10 text-accent';
      case 'drop_in': return 'bg-chart-3/10 text-chart-3';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">
            Available sessions for {activeAthlete?.first_name || 'your athlete'}
          </p>
        </div>
        <AthleteSwitcher />
      </div>

      {isLocked && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">
              Payment required to register for new sessions
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No sessions available for {activeAthlete?.first_name}'s age group and tags.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSessions.map((session) => (
            <Card key={session.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{session.title}</CardTitle>
                      <Badge className={getSessionTypeColor(session.session_type)}>
                        {session.session_type.replace('_', '-')}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      <div className="flex flex-wrap gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(session.date), 'EEE, MMM d')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {session.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {session.location}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  {session.registered ? (
                    <Badge className="bg-accent/10 text-accent gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Registered
                    </Badge>
                  ) : session.price ? (
                    <div className="text-right">
                      <div className="text-xl font-bold">${session.price}</div>
                      {paymentMethod === 'credit_card' && (
                        <div className="text-xs text-muted-foreground">
                          +3% card fee
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              {!session.registered && (
                <CardContent>
                  <div className="flex items-center gap-3">
                    {session.price && (
                      <div className="flex gap-2">
                        <Button
                          variant={paymentMethod === 'credit_card' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPaymentMethod('credit_card')}
                          data-testid={`button-pay-card-${session.id}`}
                        >
                          <CreditCard className="h-3.5 w-3.5 mr-1" />
                          Card
                        </Button>
                        <Button
                          variant={paymentMethod === 'ach' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPaymentMethod('ach')}
                          data-testid={`button-pay-ach-${session.id}`}
                        >
                          ACH
                        </Button>
                      </div>
                    )}
                    <Button
                      className="ml-auto"
                      disabled={isLocked}
                      onClick={() => handleRegister(session.id)}
                      data-testid={`button-register-${session.id}`}
                    >
                      {isLocked ? (
                        <>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Payment Required
                        </>
                      ) : session.price ? (
                        `Pay $${calculateConvenienceFee(session.price, paymentMethod).toFixed(2)}`
                      ) : (
                        'Register'
                      )}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
