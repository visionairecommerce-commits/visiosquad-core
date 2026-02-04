import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Landmark, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  calculateTechnologyAndServiceFees, 
  getTriplePricing,
  formatFeeDescription,
  type PaymentKind, 
  type PaymentRail,
} from '@shared/pricing';

interface PricingDisplayProps {
  baseAmount: number;
  monthsCount?: number;
  isRecurring?: boolean;
  showComparison?: boolean;
  selectedMethod?: 'card' | 'debit' | 'ach';
  onMethodChange?: (method: 'card' | 'debit' | 'ach') => void;
}

export function PricingDisplay({
  baseAmount,
  monthsCount = 1,
  isRecurring = true,
  showComparison = true,
  selectedMethod = 'card',
  onMethodChange,
}: PricingDisplayProps) {
  const paymentKind: PaymentKind = isRecurring ? 'recurring_contract' : 'one_time_event';
  
  const { standard, debit, ach, debitSavings, achSavings } = getTriplePricing(
    baseAmount,
    monthsCount,
    paymentKind
  );
  
  const activePricing = selectedMethod === 'ach' ? ach : 
                        selectedMethod === 'debit' ? debit : standard;

  return (
    <div className="space-y-4">
      {showComparison && (
        <div className="space-y-3">
          <Card 
            className={`cursor-pointer transition-all ${
              selectedMethod === 'card' 
                ? 'ring-2 ring-primary border-primary' 
                : 'hover-elevate'
            }`}
            onClick={() => onMethodChange?.('card')}
            data-testid="button-payment-method-card"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Pay by Card</span>
                </div>
                <div className="text-lg font-bold">
                  ${standard.totalAmount.toFixed(2)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Standard fee: {formatFeeDescription('card_credit', paymentKind)}
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all ${
              selectedMethod === 'debit' 
                ? 'ring-2 ring-primary border-primary' 
                : 'hover-elevate'
            }`}
            onClick={() => onMethodChange?.('debit')}
            data-testid="button-payment-method-debit"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-accent" />
                  <span className="font-medium text-sm">Pay by Debit Card</span>
                  {debitSavings > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Discount Applied
                    </Badge>
                  )}
                </div>
                <div className="text-lg font-bold">
                  ${debit.totalAmount.toFixed(2)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatFeeDescription('card_debit', paymentKind)}
                {debitSavings > 0 && (
                  <span className="text-accent ml-2">Save ${debitSavings.toFixed(2)}</span>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all ${
              selectedMethod === 'ach' 
                ? 'ring-2 ring-primary border-primary' 
                : 'hover-elevate'
            }`}
            onClick={() => onMethodChange?.('ach')}
            data-testid="button-payment-method-ach"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-accent" />
                  <span className="font-medium text-sm">Pay by ACH</span>
                  {achSavings > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      ACH Discount
                    </Badge>
                  )}
                </div>
                <div className="text-lg font-bold">
                  ${ach.totalAmount.toFixed(2)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatFeeDescription('ach', paymentKind)}
                {achSavings > 0 && (
                  <span className="text-accent ml-2">Save ${achSavings.toFixed(2)}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Payment Summary
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Technology and Service Fees help cover payment processing and platform costs. Debit cards and ACH receive discounts.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Program Fee</span>
            <span>${baseAmount.toFixed(2)}</span>
          </div>
          {monthsCount > 1 && isRecurring && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period</span>
              <span>{monthsCount} months</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Technology and Service Fees
            </span>
            <span>${activePricing.displayBreakdown.standardFee.toFixed(2)}</span>
          </div>
          {activePricing.displayBreakdown.discountAmount && activePricing.displayBreakdown.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-accent">
              <span>{activePricing.displayBreakdown.discountLabel}</span>
              <span>-${activePricing.displayBreakdown.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${activePricing.totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SimplePricingBreakdown({ 
  baseAmount, 
  techFee, 
  total,
  paymentMethod,
  discountAmount,
  discountLabel
}: { 
  baseAmount: number; 
  techFee: number;
  total: number;
  paymentMethod: 'card' | 'debit' | 'ach' | 'cash';
  discountAmount?: number;
  discountLabel?: string;
}) {
  const methodLabel = paymentMethod === 'ach' ? 'Bank (ACH)' : 
                      paymentMethod === 'debit' ? 'Debit Card' :
                      paymentMethod === 'cash' ? 'Cash' : 'Card';
  
  const standardFee = techFee + (discountAmount || 0);
  
  return (
    <div className="text-sm space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Program Fee</span>
        <span>${baseAmount.toFixed(2)}</span>
      </div>
      {techFee > 0 && (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Technology and Service Fees</span>
            <span>${standardFee.toFixed(2)}</span>
          </div>
          {discountAmount && discountAmount > 0 && (
            <div className="flex justify-between text-accent">
              <span>{discountLabel || 'Discount'}</span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      <Separator className="my-1" />
      <div className="flex justify-between font-medium">
        <span>Total ({methodLabel})</span>
        <span>${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
