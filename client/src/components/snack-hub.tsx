import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Droplets,
  Beef,
  Apple,
  Cookie,
  Box,
  Package,
  Plus,
  Check,
  X,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SnackItem {
  id: string;
  event_id: string;
  club_id: string;
  category: 'infrastructure' | 'hydration' | 'protein' | 'fruit_veg' | 'snacks' | 'other';
  item_name: string;
  quantity_needed: number;
  claimed_by: string | null;
  claimed_by_name: string | null;
  is_custom: boolean;
  created_by: string;
  created_at: string;
}

interface SnackHubProps {
  eventId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

const CATEGORIES = [
  { id: 'infrastructure', label: 'Setup & Supplies', icon: Box, color: 'bg-slate-100 text-slate-700' },
  { id: 'hydration', label: 'Drinks', icon: Droplets, color: 'bg-blue-100 text-blue-700' },
  { id: 'protein', label: 'Protein', icon: Beef, color: 'bg-red-100 text-red-700' },
  { id: 'fruit_veg', label: 'Fruits & Veggies', icon: Apple, color: 'bg-green-100 text-green-700' },
  { id: 'snacks', label: 'Snacks', icon: Cookie, color: 'bg-amber-100 text-amber-700' },
  { id: 'other', label: 'Other', icon: Package, color: 'bg-purple-100 text-purple-700' },
];

const SUGGESTED_ITEMS: Record<string, string[]> = {
  infrastructure: ['Cooler', 'Folding Table', 'Plates', 'Napkins', 'Cups', 'Ice', 'Trash Bags'],
  hydration: ['Water Bottles', 'Gatorade', 'Juice Boxes', 'Ice', 'Lemonade'],
  protein: ['Cheese Sticks', 'Turkey Slices', 'Hard Boiled Eggs', 'Chicken Nuggets', 'Hot Dogs'],
  fruit_veg: ['Orange Slices', 'Apple Slices', 'Grapes', 'Carrot Sticks', 'Celery', 'Bananas', 'Strawberries'],
  snacks: ['Goldfish Crackers', 'Pretzels', 'Granola Bars', 'Trail Mix', 'Chips', 'Cookies'],
  other: ['Sunscreen', 'First Aid Kit', 'Hand Sanitizer'],
};

export function SnackHub({ eventId, currentUserId, isAdmin = false }: SnackHubProps) {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customItem, setCustomItem] = useState('');
  const [quantity, setQuantity] = useState(1);

  const { data: snackItems = [], isLoading } = useQuery<SnackItem[]>({
    queryKey: ['/api/events', eventId, 'snacks'],
  });

  const { data: allergies = [] } = useQuery<string[]>({
    queryKey: ['/api/events', eventId, 'allergies'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { category: string; item_name: string; quantity_needed: number; is_custom: boolean }) => {
      return apiRequest('POST', `/api/events/${eventId}/snacks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'snacks'] });
      setIsAddOpen(false);
      setSelectedCategory('');
      setCustomItem('');
      setQuantity(1);
      toast({ title: 'Item added', description: 'Snack item has been added to the list.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' });
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (snackId: string) => {
      return apiRequest('POST', `/api/snacks/${snackId}/claim`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'snacks'] });
      toast({ title: 'Claimed!', description: "You've signed up to bring this item." });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to claim item', variant: 'destructive' });
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: async (snackId: string) => {
      return apiRequest('POST', `/api/snacks/${snackId}/unclaim`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'snacks'] });
      toast({ title: 'Unclaimed', description: 'Item has been unclaimed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to unclaim item', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (snackId: string) => {
      return apiRequest('DELETE', `/api/snacks/${snackId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'snacks'] });
      toast({ title: 'Deleted', description: 'Item has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    },
  });

  const handleAddSuggestedItem = (category: string, itemName: string) => {
    createMutation.mutate({ category, item_name: itemName, quantity_needed: 1, is_custom: false });
  };

  const handleAddCustomItem = () => {
    if (!selectedCategory || !customItem.trim()) return;
    createMutation.mutate({
      category: selectedCategory,
      item_name: customItem.trim(),
      quantity_needed: quantity,
      is_custom: true,
    });
  };

  const totalItems = snackItems.length;
  const claimedItems = snackItems.filter(item => item.claimed_by).length;
  const progressPercent = totalItems > 0 ? (claimedItems / totalItems) * 100 : 0;

  const groupedItems = CATEGORIES.map(cat => ({
    ...cat,
    items: snackItems.filter(item => item.category === cat.id),
  }));

  const uniqueAllergies = Array.from(new Set(allergies.filter(Boolean)));

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Loading snack list...</div>;
  }

  return (
    <div className="space-y-4">
      {uniqueAllergies.length > 0 && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Allergy Alert</AlertTitle>
          <AlertDescription className="text-amber-700">
            Athletes registered for this event have reported the following allergies:{' '}
            <strong>{uniqueAllergies.join(', ')}</strong>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
            <span>Snack List Progress</span>
            <span>{claimedItems} of {totalItems} items claimed</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-snack">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Snack Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Quick Add Suggestions</label>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_ITEMS[selectedCategory]?.map(item => (
                        <Button
                          key={item}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddSuggestedItem(selectedCategory, item)}
                          disabled={createMutation.isPending}
                          data-testid={`button-suggest-${item.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium mb-2 block">Or Add Custom Item</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Item name"
                        value={customItem}
                        onChange={e => setCustomItem(e.target.value)}
                        data-testid="input-custom-item"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        className="w-20"
                        data-testid="input-quantity"
                      />
                      <Button
                        onClick={handleAddCustomItem}
                        disabled={!customItem.trim() || createMutation.isPending}
                        data-testid="button-add-custom"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {totalItems === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No snack items yet. Click "Add Item" to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedItems.filter(g => g.items.length > 0).map(group => {
            const Icon = group.icon;
            return (
              <Card key={group.id}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className={`p-1.5 rounded ${group.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {group.label}
                    <Badge variant="secondary" className="ml-auto">
                      {group.items.filter(i => i.claimed_by).length}/{group.items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {group.items.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          item.claimed_by ? 'bg-green-50 border-green-200' : 'bg-background'
                        }`}
                        data-testid={`snack-item-${item.id}`}
                      >
                        <div className="flex items-center gap-2">
                          {item.claimed_by ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                          )}
                          <span className={item.claimed_by ? 'text-green-800' : ''}>
                            {item.item_name}
                            {item.quantity_needed > 1 && (
                              <span className="text-muted-foreground ml-1">x{item.quantity_needed}</span>
                            )}
                          </span>
                          {item.claimed_by_name && (
                            <span className="text-sm text-green-600">
                              ({item.claimed_by_name})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {item.claimed_by === currentUserId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => unclaimMutation.mutate(item.id)}
                              disabled={unclaimMutation.isPending}
                              data-testid={`button-unclaim-${item.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Unclaim
                            </Button>
                          ) : !item.claimed_by ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => claimMutation.mutate(item.id)}
                              disabled={claimMutation.isPending}
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              data-testid={`button-claim-${item.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              I'll bring it
                            </Button>
                          ) : null}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                              className="text-destructive"
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
