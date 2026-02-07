import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermission, setupForegroundMessageHandler, isPushNotificationSupported, getNotificationPermissionStatus } from '@/lib/push-notifications';
import { useToast } from '@/hooks/use-toast';

const DISMISS_KEY = 'notification_prompt_dismissed';

export function NotificationPrompt() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!user) return;

    const permissionStatus = getNotificationPermissionStatus();
    if (permissionStatus === 'granted' || permissionStatus === 'denied' || permissionStatus === 'unsupported') {
      setVisible(false);
      return;
    }

    if (!isPushNotificationSupported()) {
      setVisible(false);
      return;
    }

    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        setupForegroundMessageHandler((notification) => {
          toast({
            title: notification.title,
            description: notification.body,
          });
        });
        toast({ title: 'Notifications enabled', description: 'You will now receive alerts for new messages and updates.' });
        setVisible(false);
      } else {
        const status = getNotificationPermissionStatus();
        if (status === 'denied') {
          toast({ title: 'Notifications blocked', description: 'Your browser blocked notifications. You can enable them in your browser settings.', variant: 'destructive' });
          setVisible(false);
        }
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    } finally {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Card className="mx-6 mt-4 p-4" data-testid="notification-prompt">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-full bg-primary/10 p-2">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" data-testid="text-notification-prompt-title">
            Stay updated with push notifications
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Get instant alerts when you receive new messages, bulletin posts, and important updates from your club.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={enabling}
              data-testid="button-enable-notifications"
            >
              <Bell className="h-4 w-4 mr-1" />
              {enabling ? 'Enabling...' : 'Enable Notifications'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              data-testid="button-dismiss-notifications"
            >
              Not Now
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          className="flex-shrink-0"
          data-testid="button-close-notification-prompt"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
