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
  type PaymentKind, 
  type PaymentRail,
  FEE_CONFIG 
} from '@shared/pricing';

interface PricingDisplayProps {
  baseAmount: number;
  monthsCount?: number;
  isRecurring?: boolean;
  showComparison?: boolean;
  selectedMethod?: 'card' | 'ach';
  onMethodChange?: (method: 'card' | 'ach') => void;
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
  
  const cardCreditPricing = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'card_credit',
  });
  
  const cardDebitPricing = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'card_debit',
  });
  
  const achPricing = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'ach',
  });
  
  const cardSavingsVsCredit = cardCreditPricing.totalAmount - cardDebitPricing.totalAmount;
  const achSavingsVsCredit = cardCreditPricing.totalAmount - achPricing.totalAmount;
  
  const activePricing = selectedMethod === 'card' ? cardCreditPricing : achPricing;
  
  const formatFeeDescription = (rail: PaymentRail, kind: PaymentKind) => {
    const isRecurring = kind === 'recurring_contract';
    const flatFee = isRecurring ? FEE_CONFIG.RECURRING_FLAT_PER_MONTH : FEE_CONFIG.ONE_TIME_FLAT;
    
    switch (rail) {
      case 'card_credit':
        return isRecurring ? `3% + $${flatFee.toFixed(2)}/month` : `3% + $${flatFee.toFixed(2)}`;
      case 'card_debit':
        return isRecurring ? `$${flatFee.toFixed(2)}/month (no %)` : `$${flatFee.toFixed(2)} flat`;
      case 'ach':
        return isRecurring ? `1.5% + $${flatFee.toFixed(2)}/month` : `1.5% + $${flatFee.toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-4">
      {showComparison && (
        <div className="grid grid-cols-2 gap-3">
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
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Card</span>
              </div>
              <div className="text-lg font-bold">
                ${cardCreditPricing.totalAmount.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFeeDescription('card_credit', paymentKind)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <Tooltip>
                  <TooltipTrigger className="underline decoration-dotted cursor-help">
                    Debit: ${cardDebitPricing.totalAmount.toFixed(2)}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Debit cards get the percentage fee waived. Your card type will be automatically detected at checkout.</p>
                  </TooltipContent>
                </Tooltip>
                {cardSavingsVsCredit > 0 && (
                  <span className="text-accent ml-1">(save ${cardSavingsVsCredit.toFixed(2)})</span>
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
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="h-4 w-4 text-accent" />
                <span className="font-medium text-sm">Bank (ACH)</span>
                {achSavingsVsCredit > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Save ${achSavingsVsCredit.toFixed(2)}
                  </Badge>
                )}
              </div>
              <div className="text-lg font-bold">
                ${achPricing.totalAmount.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFeeDescription('ach', paymentKind)}
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
                <p>Technology and Service Fees help cover payment processing and platform costs. Debit cards receive a discount (no percentage fee).</p>
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
              <span className="text-xs ml-1">({formatFeeDescription(activePricing.paymentRail, activePricing.paymentKind)})</span>
            </span>
            <span>${activePricing.techFee.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${activePricing.totalAmount.toFixed(2)}</span>
          </div>
          {activePricing.displayBreakdown.discountMessage && (
            <div className="text-xs text-accent">
              {activePricing.displayBreakdown.discountMessage}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SimplePricingBreakdown({ 
  baseAmount, 
  techFee, 
  total,
  paymentMethod 
}: { 
  baseAmount: number; 
  techFee: number;
  total: number;
  paymentMethod: 'card' | 'ach' | 'cash';
}) {
  const methodLabel = paymentMethod === 'ach' ? 'Bank (ACH)' : 
                      paymentMethod === 'cash' ? 'Cash' : 'Card';
  
  return (
    <div className="text-sm space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Program Fee</span>
        <span>${baseAmount.toFixed(2)}</span>
      </div>
      {techFee > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Technology and Service Fees</span>
          <span>${techFee.toFixed(2)}</span>
        </div>
      )}
      <Separator className="my-1" />
      <div className="flex justify-between font-medium">
        <span>Total ({methodLabel})</span>
        <span>${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
