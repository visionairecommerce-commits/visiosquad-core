import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Trophy,
  Target,
  Tent,
  Star,
  Check,
  CreditCard,
  Building,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isFuture, isToday } from 'date-fns';
import type { Event, Athlete } from '@shared/schema';
import { calculateTechnologyAndServiceFees, FEE_VERSION } from '@shared/pricing';

interface EventRoster {
  id: string;
  event_id: string;
  athlete_id: string;
  checked_in: boolean;
  payment_id: string | null;
}

interface ParentPaymentMethod {
  id: string;
  payment_type: 'card' | 'ach';
  card_last_four: string | null;
  card_brand: string | null;
  bank_last_four: string | null;
  bank_name: string | null;
  is_default: boolean;
}

const eventTypeIcons = {
  clinic: Target,
  camp: Tent,
  tryout: Star,
  tournament: Trophy,
  other: CalendarDays,
};

export default function ParentEventsPage() {
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<string>('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [useNewCard, setUseNewCard] = useState(false);

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ['/api/athletes'],
  });

  const { data: paymentMethods = [] } = useQuery<ParentPaymentMethod[]>({
    queryKey: ['/api/parents/payment-methods'],
  });

  const { data: allRosters = [] } = useQuery<EventRoster[]>({
    queryKey: ['/api/events/all-rosters'],
    enabled: athletes.length > 0,
  });

  const registerMutation = useMutation({
    mutationFn: async ({ eventId, athleteId, paymentMethodId, cardDetails }: {
      eventId: string;
      athleteId: string;
      paymentMethodId?: string;
      cardDetails?: { card_number: string; card_expiry: string; card_cvv: string };
    }) => {
      const body: Record<string, unknown> = { athlete_id: athleteId };
      if (paymentMethodId) {
        body.payment_method_id = paymentMethodId;
      } else if (cardDetails) {
        body.card_number = cardDetails.card_number;
        body.card_expiry = cardDetails.card_expiry;
        body.card_cvv = cardDetails.card_cvv;
      }
      return apiRequest('POST', `/api/events/${eventId}/register-and-pay`, body);
    },
    onSuccess: () => {
      toast({ title: 'Registration successful!', description: 'Your athlete is now registered for the event.' });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowPaymentDialog(false);
      resetPaymentForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message || 'Failed to register for event',
        variant: 'destructive',
      });
    },
  });

  const resetPaymentForm = () => {
    setSelectedEvent(null);
    setSelectedAthlete('');
    setPaymentMethodId('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setUseNewCard(false);
  };

  const handleRegisterClick = (event: Event) => {
    setSelectedEvent(event);
    const eventPrice = Number(event.price) || 0;
    
    if (eventPrice === 0) {
      if (athletes.length === 1) {
        registerMutation.mutate({ eventId: event.id, athleteId: athletes[0].id });
      } else {
        setShowPaymentDialog(true);
      }
    } else {
      if (paymentMethods.length > 0) {
        const defaultMethod = paymentMethods.find(m => m.is_default) || paymentMethods[0];
        setPaymentMethodId(defaultMethod.id);
      }
      setShowPaymentDialog(true);
    }
  };

  const handleConfirmRegistration = () => {
    if (!selectedEvent || !selectedAthlete) return;
    
    const eventPrice = Number(selectedEvent.price) || 0;
    
    if (eventPrice === 0) {
      registerMutation.mutate({ eventId: selectedEvent.id, athleteId: selectedAthlete });
    } else if (useNewCard) {
      if (!cardNumber || !cardExpiry || !cardCvv) {
        toast({ title: 'Please enter card details', variant: 'destructive' });
        return;
      }
      registerMutation.mutate({
        eventId: selectedEvent.id,
        athleteId: selectedAthlete,
        cardDetails: { card_number: cardNumber, card_expiry: cardExpiry, card_cvv: cardCvv },
      });
    } else if (paymentMethodId) {
      registerMutation.mutate({
        eventId: selectedEvent.id,
        athleteId: selectedAthlete,
        paymentMethodId,
      });
    } else {
      toast({ title: 'Please select a payment method', variant: 'destructive' });
    }
  };

  const isAthleteRegistered = (eventId: string, athleteId: string) => {
    return allRosters.some(r => r.event_id === eventId && r.athlete_id === athleteId);
  };

  const getAthleteRegistrationStatus = (eventId: string) => {
    const registeredAthletes = athletes.filter(a => isAthleteRegistered(eventId, a.id));
    return registeredAthletes;
  };

  const getEventStatus = (event: Event) => {
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);
    if (isPast(endDate)) return 'past';
    if (isToday(startDate) || (isPast(startDate) && isFuture(endDate))) return 'today';
    return 'upcoming';
  };

  const upcomingEvents = events.filter(e => getEventStatus(e) !== 'past');
  const pastEvents = events.filter(e => getEventStatus(e) === 'past');

  if (eventsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Events</h1>
          <p className="text-muted-foreground">Browse and register for upcoming events</p>
        </div>
      </div>

      {upcomingEvents.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No upcoming events at this time</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {upcomingEvents.map((event) => {
          const EventIcon = eventTypeIcons[event.event_type] || CalendarDays;
          const registeredAthletes = getAthleteRegistrationStatus(event.id);
          const eventPrice = Number(event.price) || 0;
          const feeCalc = eventPrice > 0 ? calculateTechnologyAndServiceFees({
            baseAmount: eventPrice,
            paymentRail: 'card_credit',
            paymentKind: 'one_time_event',
            monthsCount: 1,
          }) : null;
          const allRegistered = athletes.length > 0 && registeredAthletes.length === athletes.length;
          
          return (
            <Card key={event.id} className="flex flex-col" data-testid={`card-event-${event.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <EventIcon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                  </div>
                  <Badge variant={getEventStatus(event) === 'today' ? 'default' : 'secondary'}>
                    {event.event_type}
                  </Badge>
                </div>
                {event.description && (
                  <CardDescription className="mt-1">{event.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>{format(new Date(event.start_time), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {event.capacity && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Capacity: {event.capacity}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {eventPrice === 0 ? (
                      <Badge variant="secondary">Free</Badge>
                    ) : (
                      <span className="font-medium">
                        ${eventPrice.toFixed(2)}
                        {feeCalc && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (+ ${feeCalc.techFee.toFixed(2)} fee)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {registeredAthletes.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Registered:</p>
                    <div className="flex flex-wrap gap-1">
                      {registeredAthletes.map((athlete) => (
                        <Badge key={athlete.id} variant="outline" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          {athlete.first_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  {allRegistered ? (
                    <Button disabled className="w-full" data-testid={`button-registered-${event.id}`}>
                      <Check className="h-4 w-4 mr-2" />
                      All Athletes Registered
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleRegisterClick(event)}
                      className="w-full"
                      data-testid={`button-register-${event.id}`}
                    >
                      {eventPrice > 0 ? (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Register & Pay
                        </>
                      ) : (
                        'Register Now'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {pastEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Past Events</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastEvents.slice(0, 6).map((event) => {
              const EventIcon = eventTypeIcons[event.event_type] || CalendarDays;
              const registeredAthletes = getAthleteRegistrationStatus(event.id);
              
              return (
                <Card key={event.id} className="opacity-60" data-testid={`card-past-event-${event.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <EventIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>{format(new Date(event.start_time), 'MMM d, yyyy')}</span>
                    </div>
                    {registeredAthletes.length > 0 && (
                      <p className="text-xs">
                        {registeredAthletes.length} athlete{registeredAthletes.length !== 1 ? 's' : ''} attended
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        if (!open) resetPaymentForm();
        setShowPaymentDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register for Event</DialogTitle>
            <DialogDescription>
              {selectedEvent?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Athlete</Label>
              <Select value={selectedAthlete} onValueChange={setSelectedAthlete}>
                <SelectTrigger data-testid="select-athlete">
                  <SelectValue placeholder="Choose an athlete" />
                </SelectTrigger>
                <SelectContent>
                  {athletes
                    .filter(a => !selectedEvent || !isAthleteRegistered(selectedEvent.id, a.id))
                    .map((athlete) => (
                      <SelectItem key={athlete.id} value={athlete.id}>
                        {athlete.first_name} {athlete.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEvent && Number(selectedEvent.price) > 0 && (
              <>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Event Price</span>
                    <span>${Number(selectedEvent.price).toFixed(2)}</span>
                  </div>
                  {(() => {
                    const feeCalc = calculateTechnologyAndServiceFees({
                      baseAmount: Number(selectedEvent.price),
                      paymentRail: 'card_credit',
                      paymentKind: 'one_time_event',
                      monthsCount: 1,
                    });
                    return (
                      <>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Technology & Service Fee</span>
                          <span>${feeCalc.techFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-medium border-t pt-2">
                          <span>Total</span>
                          <span>${feeCalc.totalAmount.toFixed(2)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {paymentMethods.length > 0 && !useNewCard && (
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.payment_type === 'card' ? (
                              <span className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                {method.card_brand} •••• {method.card_last_four}
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {method.bank_name} •••• {method.bank_last_four}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUseNewCard(true)}
                      className="text-xs"
                      data-testid="button-use-new-card"
                    >
                      Use a different card
                    </Button>
                  </div>
                )}

                {(paymentMethods.length === 0 || useNewCard) && (
                  <div className="space-y-3">
                    <Label>Card Details</Label>
                    <Input
                      placeholder="Card Number"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      data-testid="input-card-number"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length >= 2) {
                            value = value.slice(0, 2) + '/' + value.slice(2, 4);
                          }
                          setCardExpiry(value);
                        }}
                        data-testid="input-card-expiry"
                      />
                      <Input
                        placeholder="CVV"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        data-testid="input-card-cvv"
                      />
                    </div>
                    {paymentMethods.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUseNewCard(false)}
                        className="text-xs"
                        data-testid="button-use-saved-card"
                      >
                        Use saved payment method
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              data-testid="button-cancel-registration"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRegistration}
              disabled={!selectedAthlete || registerMutation.isPending}
              data-testid="button-confirm-registration"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : selectedEvent && Number(selectedEvent.price) > 0 ? (
                'Pay & Register'
              ) : (
                'Register'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
