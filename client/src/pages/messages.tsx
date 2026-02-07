import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  MessageSquare, 
  Send, 
  Plus, 
  Users, 
  Loader2,
  User as UserIcon,
  Building2,
  UserSquare2,
  CalendarDays,
  Trash2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  program_id: string;
}

interface Program {
  id: string;
  name: string;
}

interface Event {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
}

interface ChatChannel {
  id: string;
  club_id: string;
  name?: string;
  channel_type: string;
  team_id?: string;
  program_id?: string;
  created_by: string;
  created_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
}

interface Participant {
  id: string;
  channel_id: string;
  user_id: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [audienceType, setAudienceType] = useState<'individual' | 'roster' | 'team' | 'program' | 'event'>('individual');
  const [selectionMode, setSelectionMode] = useState<'person' | 'athlete'>('athlete');
  const [selectedAthlete, setSelectedAthlete] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [chatName, setChatName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels = [], isLoading: channelsLoading } = useQuery<ChatChannel[]>({
    queryKey: ['/api/chat/channels'],
  });

  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ['/api/chat/channels', selectedChannel?.id, 'messages'],
    enabled: !!selectedChannel?.id,
  });

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ['/api/chat/channels', selectedChannel?.id, 'participants'],
    enabled: !!selectedChannel?.id,
  });

  const { data: coaches = [] } = useQuery<User[]>({
    queryKey: ['/api/coaches'],
  });

  const { data: athletes = [] } = useQuery<{id: string; parent_id: string; first_name: string; last_name: string}[]>({
    queryKey: ['/api/athletes'],
  });
  
  const { data: parentUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/parents'],
    enabled: user?.role === 'admin' || user?.role === 'coach',
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
    enabled: user?.role === 'admin' || user?.role === 'coach',
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
    enabled: user?.role === 'admin' || user?.role === 'coach',
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    enabled: user?.role === 'admin' || user?.role === 'coach',
  });

  const clubUsers = [
    ...coaches.map(c => ({ ...c, userType: 'coach' })),
    ...(user?.role === 'admin' || user?.role === 'coach' 
      ? parentUsers.map(p => ({ ...p, userType: 'parent' })) 
      : []),
    ...(user?.role === 'parent' 
      ? coaches.map(c => ({ ...c, userType: 'coach' })) 
      : []),
  ].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', `/api/chat/channels/${selectedChannel?.id}/messages`, { content });
    },
    onSuccess: () => {
      setMessageInput('');
      refetchMessages();
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: { 
      audienceType: 'individual' | 'roster' | 'team' | 'program' | 'event';
      participantIds?: string[];
      teamId?: string;
      programId?: string;
      eventId?: string;
      name?: string;
    }) => {
      // Map audience_type to valid channel_type enum values
      const getChannelType = (audienceType: string) => {
        switch (audienceType) {
          case 'individual': return 'direct';
          case 'roster': return 'group'; // roster uses group channel type
          case 'team': return 'team';
          case 'program': return 'program';
          case 'event': return 'event';
          default: return 'group';
        }
      };
      
      return apiRequest('POST', '/api/chat/channels', {
        channel_type: getChannelType(data.audienceType),
        audience_type: data.audienceType,
        participant_ids: data.participantIds || [],
        team_id: data.teamId,
        program_id: data.programId,
        event_id: data.eventId,
        name: data.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/channels'] });
      setNewChatOpen(false);
      setSelectedRecipient('');
      setSelectedAthlete('');
      setSelectionMode('athlete');
      setAudienceType('individual');
      setSelectedTeam('');
      setSelectedProgram('');
      setSelectedEvent('');
      setChatName('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create conversation',
        description: error.message || 'Please try again or check that the event has registered athletes.',
        variant: 'destructive',
      });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return apiRequest('DELETE', `/api/chat/channels/${channelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/channels'] });
      setSelectedChannel(null);
      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been permanently deleted for all users.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete conversation',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!selectedChannel?.id) return;

    const channel = supabase
      .channel(`messages:${selectedChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        () => {
          refetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannel?.id, refetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && selectedChannel) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };

  const handleCreateChat = () => {
    if (audienceType === 'individual') {
      // When selecting by athlete, find the parent_id and use that
      if (selectionMode === 'athlete' && selectedAthlete) {
        const athlete = athletes.find(a => a.id === selectedAthlete);
        if (athlete?.parent_id) {
          createChannelMutation.mutate({
            audienceType: 'individual',
            participantIds: [athlete.parent_id],
          });
        }
      } else if (selectionMode === 'person' && selectedRecipient) {
        createChannelMutation.mutate({
          audienceType: 'individual',
          participantIds: [selectedRecipient],
        });
      }
    } else if (audienceType === 'team' && selectedTeam) {
      const team = teams.find(t => t.id === selectedTeam);
      createChannelMutation.mutate({
        audienceType: 'team',
        teamId: selectedTeam,
        name: chatName || `${team?.name || 'Team'} Chat`,
      });
    } else if (audienceType === 'roster' && selectedTeam) {
      const team = teams.find(t => t.id === selectedTeam);
      createChannelMutation.mutate({
        audienceType: 'roster',
        teamId: selectedTeam,
        name: chatName || `${team?.name || 'Roster'} Group`,
      });
    } else if (audienceType === 'program' && selectedProgram) {
      const program = programs.find(p => p.id === selectedProgram);
      createChannelMutation.mutate({
        audienceType: 'program',
        programId: selectedProgram,
        name: chatName || `${program?.name || 'Program'} Chat`,
      });
    } else if (audienceType === 'event' && selectedEvent) {
      const event = events.find(e => e.id === selectedEvent);
      createChannelMutation.mutate({
        audienceType: 'event',
        eventId: selectedEvent,
        name: chatName || `${event?.title || 'Event'} Chat`,
      });
    }
  };

  const isStaff = user?.role === 'admin' || user?.role === 'coach';

  const canCreateChat = () => {
    if (audienceType === 'individual') {
      // Staff can select by athlete or person
      if (isStaff && selectionMode === 'athlete') return !!selectedAthlete;
      // Non-staff always use person mode
      if (!isStaff || selectionMode === 'person') return !!selectedRecipient;
    }
    if (audienceType === 'team' || audienceType === 'roster') return !!selectedTeam;
    if (audienceType === 'program') return !!selectedProgram;
    if (audienceType === 'event') return !!selectedEvent;
    return false;
  };

  const getChannelDisplayName = (channel: ChatChannel) => {
    if (channel.name) return channel.name;
    if (channel.channel_type === 'direct') return 'Direct Message';
    if (channel.channel_type === 'team') return 'Team Chat';
    if (channel.channel_type === 'event') return 'Event Chat';
    return 'Group Chat';
  };

  if (channelsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <Card className="w-80 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-new-chat">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {isStaff && (
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Select 
                      value={audienceType} 
                      onValueChange={(value) => {
                        setAudienceType(value as typeof audienceType);
                        setSelectedRecipient('');
                        setSelectedTeam('');
                        setSelectedProgram('');
                        setSelectedEvent('');
                      }}
                    >
                      <SelectTrigger data-testid="select-audience-type">
                        <SelectValue placeholder="Select audience..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4" />
                            Individual (Parent/Coach)
                          </div>
                        </SelectItem>
                        <SelectItem value="roster">
                          <div className="flex items-center gap-2">
                            <UserSquare2 className="h-4 w-4" />
                            Specific Roster/Group
                          </div>
                        </SelectItem>
                        <SelectItem value="team">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Team
                          </div>
                        </SelectItem>
                        <SelectItem value="program">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Full Program
                          </div>
                        </SelectItem>
                        <SelectItem value="event">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Event Roster
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {audienceType === 'individual' && isStaff && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select By</Label>
                      <Select 
                        value={selectionMode} 
                        onValueChange={(value) => {
                          setSelectionMode(value as 'person' | 'athlete');
                          setSelectedRecipient('');
                          setSelectedAthlete('');
                        }}
                      >
                        <SelectTrigger data-testid="select-selection-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="athlete">
                            <div className="flex items-center gap-2">
                              <UserSquare2 className="h-4 w-4" />
                              Athlete (auto-adds parent)
                            </div>
                          </SelectItem>
                          <SelectItem value="person">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4" />
                              Person (Parent/Coach)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectionMode === 'athlete' && (
                      <div className="space-y-2">
                        <Label>Select Athlete</Label>
                        <Select value={selectedAthlete} onValueChange={setSelectedAthlete}>
                          <SelectTrigger data-testid="select-athlete">
                            <SelectValue placeholder="Select an athlete..." />
                          </SelectTrigger>
                          <SelectContent>
                            {athletes
                              .filter(a => a.parent_id)
                              .map((athlete) => (
                                <SelectItem key={athlete.id} value={athlete.id}>
                                  {athlete.first_name} {athlete.last_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Their parent will be automatically added to the conversation.
                        </p>
                      </div>
                    )}

                    {selectionMode === 'person' && (
                      <div className="space-y-2">
                        <Label>Select Person</Label>
                        <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                          <SelectTrigger data-testid="select-recipient">
                            <SelectValue placeholder="Select a person..." />
                          </SelectTrigger>
                          <SelectContent>
                            {clubUsers
                              .filter(u => u.id !== user?.id)
                              .map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.full_name} ({u.role})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {audienceType === 'individual' && !isStaff && (
                  <div className="space-y-2">
                    <Label>Select Person</Label>
                    <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                      <SelectTrigger data-testid="select-recipient">
                        <SelectValue placeholder="Select a person..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clubUsers
                          .filter(u => u.id !== user?.id)
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name} ({u.role})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(audienceType === 'team' || audienceType === 'roster') && (
                  <div className="space-y-2">
                    <Label>Select Team</Label>
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger data-testid="select-team">
                        <SelectValue placeholder="Select a team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {audienceType === 'team' 
                        ? 'All parents of athletes on this team and coaches will be included.' 
                        : 'All parents on this roster will be included.'}
                    </p>
                  </div>
                )}

                {audienceType === 'program' && (
                  <div className="space-y-2">
                    <Label>Select Program</Label>
                    <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                      <SelectTrigger data-testid="select-program">
                        <SelectValue placeholder="Select a program..." />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      All parents of athletes in this program and all coaches will receive messages.
                    </p>
                  </div>
                )}

                {audienceType === 'event' && (
                  <div className="space-y-2">
                    <Label>Select Event</Label>
                    <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                      <SelectTrigger data-testid="select-event">
                        <SelectValue placeholder="Select an event..." />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.title} ({event.event_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      All parents of athletes registered for this event and assigned coaches will receive messages.
                    </p>
                  </div>
                )}

                {audienceType !== 'individual' && (
                  <div className="space-y-2">
                    <Label>Chat Name (Optional)</Label>
                    <Input
                      placeholder="Enter a name for this chat..."
                      value={chatName}
                      onChange={(e) => setChatName(e.target.value)}
                      data-testid="input-chat-name"
                    />
                  </div>
                )}

                <Button 
                  onClick={handleCreateChat} 
                  disabled={!canCreateChat() || createChannelMutation.isPending}
                  className="w-full"
                  data-testid="button-start-conversation"
                >
                  {createChannelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Start Conversation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {channels.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat to begin messaging</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => {
                      setSelectedChannel(channel);
                      setTimeout(() => {
                        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-counts'] });
                      }, 1000);
                    }}
                    className={`w-full p-3 rounded-md text-left transition-colors ${
                      selectedChannel?.id === channel.id
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                    data-testid={`channel-${channel.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {getChannelDisplayName(channel)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(channel.created_at), 'MMM d, yyyy')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  {getChannelDisplayName(selectedChannel)}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {participants.length} participant{participants.length !== 1 ? 's' : ''}
                  </Badge>
                  {user?.role === 'admin' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          data-testid="button-delete-channel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this conversation for all users.
                            All messages will be lost and cannot be recovered.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteChannelMutation.mutate(selectedChannel.id)}
                            className="bg-destructive text-destructive-foreground"
                            data-testid="button-confirm-delete"
                          >
                            {deleteChannelMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isOwnMessage = message.sender_id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              isOwnMessage
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {message.message_type === 'system' ? (
                              <p className="text-xs italic text-muted-foreground">{message.content}</p>
                            ) : (
                              <>
                                <p className="text-sm">{message.content}</p>
                                <p className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {format(new Date(message.created_at), 'h:mm a')}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
              <Separator />
              <form onSubmit={handleSendMessage} className="p-4 flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  data-testid="input-message"
                />
                <Button 
                  type="submit" 
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose a chat from the sidebar or start a new one</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
