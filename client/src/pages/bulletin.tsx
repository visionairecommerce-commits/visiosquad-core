import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone,
  Plus,
  Pin,
  Eye,
  EyeOff,
  Check,
  Trash2,
  Edit,
  Loader2,
  User,
} from 'lucide-react';
import { format } from 'date-fns';

interface Author {
  id: string;
  full_name: string;
  role: string;
}

interface BulletinPost {
  id: string;
  club_id: string;
  team_id?: string;
  program_id?: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
  isRead: boolean;
  isHidden: boolean;
  author: Author;
}

interface Program {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  program_id: string;
}

export default function BulletinPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isStaff = user?.role === 'admin' || user?.role === 'coach';
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editPost, setEditPost] = useState<BulletinPost | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [hideConfirmPost, setHideConfirmPost] = useState<BulletinPost | null>(null);
  
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    program_id: '',
    team_id: '',
    is_pinned: false,
  });

  const { data: posts = [], isLoading } = useQuery<BulletinPost[]>({
    queryKey: ['/api/bulletin'],
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: typeof newPost) => {
      return apiRequest('POST', '/api/bulletin', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bulletin'] });
      setCreateDialogOpen(false);
      setNewPost({ title: '', content: '', program_id: '', team_id: '', is_pinned: false });
      toast({ title: 'Post Created', description: 'Your bulletin post has been published.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create post.', variant: 'destructive' });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof newPost> }) => {
      return apiRequest('PATCH', `/api/bulletin/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bulletin'] });
      setEditPost(null);
      toast({ title: 'Post Updated', description: 'Your changes have been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update post.', variant: 'destructive' });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/bulletin/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bulletin'] });
      setDeletePostId(null);
      toast({ title: 'Post Deleted', description: 'The post has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete post.', variant: 'destructive' });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('POST', `/api/bulletin/${postId}/read`);
    },
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bulletin'] });
      const post = posts.find(p => p.id === postId);
      if (post && !post.isRead) {
        setHideConfirmPost(post);
      }
    },
  });

  const hidePostMutation = useMutation({
    mutationFn: async ({ postId, isHidden }: { postId: string; isHidden: boolean }) => {
      return apiRequest('PATCH', `/api/bulletin/${postId}/hide`, { is_hidden: isHidden });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bulletin'] });
      setHideConfirmPost(null);
      toast({ 
        title: 'Preference Saved', 
        description: 'Your view preference has been updated.' 
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPostMutation.mutate(newPost);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPost) {
      updatePostMutation.mutate({
        id: editPost.id,
        data: {
          title: editPost.title,
          content: editPost.content,
          is_pinned: editPost.is_pinned,
        },
      });
    }
  };

  const visiblePosts = posts.filter(p => !p.isHidden);
  const hiddenPosts = posts.filter(p => p.isHidden);
  const unreadPosts = visiblePosts.filter(p => !p.isRead);
  const readPosts = visiblePosts.filter(p => p.isRead);

  const renderPost = (post: BulletinPost, showActions: boolean = true) => (
    <Card key={post.id} className={`${post.is_pinned ? 'border-primary' : ''}`} data-testid={`bulletin-post-${post.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {post.is_pinned && (
                <Badge variant="default" className="text-xs">
                  <Pin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
              {!post.isRead && (
                <Badge variant="secondary" className="text-xs">New</Badge>
              )}
              {post.isHidden && (
                <Badge variant="outline" className="text-xs">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hidden
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg mt-2">{post.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <User className="h-3 w-3" />
              {post.author?.full_name || 'Staff'} 
              <span className="mx-1">·</span>
              {format(new Date(post.created_at), 'MMM d, yyyy h:mm a')}
            </CardDescription>
          </div>
          {isStaff && showActions && (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditPost(post)}
                data-testid={`button-edit-post-${post.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDeletePostId(post.id)}
                data-testid={`button-delete-post-${post.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
      </CardContent>
      {showActions && (
        <CardFooter className="pt-0 gap-2">
          {!post.isRead ? (
            <Button
              size="sm"
              onClick={() => markReadMutation.mutate(post.id)}
              disabled={markReadMutation.isPending}
              data-testid={`button-mark-read-${post.id}`}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark as Read
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => hidePostMutation.mutate({ postId: post.id, isHidden: !post.isHidden })}
              disabled={hidePostMutation.isPending}
              data-testid={`button-toggle-hide-${post.id}`}
            >
              {post.isHidden ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show on Board
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide from Board
                </>
              )}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Bulletin Board
          </h1>
          <p className="text-muted-foreground">
            Announcements and updates from your club
          </p>
        </div>
        {isStaff && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-post">
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Bulletin Post</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    placeholder="Announcement title..."
                    required
                    data-testid="input-post-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    placeholder="Write your announcement..."
                    rows={6}
                    required
                    data-testid="input-post-content"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Program (Optional)</Label>
                    <Select
                      value={newPost.program_id}
                      onValueChange={(val) => setNewPost({ ...newPost, program_id: val, team_id: '' })}
                    >
                      <SelectTrigger data-testid="select-program">
                        <SelectValue placeholder="All programs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Programs</SelectItem>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Team (Optional)</Label>
                    <Select
                      value={newPost.team_id}
                      onValueChange={(val) => setNewPost({ ...newPost, team_id: val })}
                      disabled={!newPost.program_id}
                    >
                      <SelectTrigger data-testid="select-team">
                        <SelectValue placeholder="All teams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Teams</SelectItem>
                        {teams
                          .filter(t => t.program_id === newPost.program_id)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="pinned"
                    checked={newPost.is_pinned}
                    onCheckedChange={(checked) => setNewPost({ ...newPost, is_pinned: checked })}
                    data-testid="switch-pinned"
                  />
                  <Label htmlFor="pinned">Pin to top of board</Label>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createPostMutation.isPending} data-testid="button-submit-post">
                    {createPostMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Publish Post
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No announcements yet</h3>
            <p className="text-muted-foreground">
              {isStaff 
                ? 'Create your first bulletin post to notify parents and players.'
                : 'Check back later for updates from your club.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">
              Active
              {unreadPosts.length > 0 && (
                <Badge variant="secondary" className="ml-2">{unreadPosts.length} new</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read" data-testid="tab-read">
              Read ({readPosts.length})
            </TabsTrigger>
            <TabsTrigger value="hidden" data-testid="tab-hidden">
              Hidden ({hiddenPosts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {visiblePosts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  All caught up! No new announcements.
                </CardContent>
              </Card>
            ) : (
              visiblePosts.map(post => renderPost(post))
            )}
          </TabsContent>

          <TabsContent value="read" className="space-y-4">
            {readPosts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No read posts yet.
                </CardContent>
              </Card>
            ) : (
              readPosts.map(post => renderPost(post))
            )}
          </TabsContent>

          <TabsContent value="hidden" className="space-y-4">
            {hiddenPosts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hidden posts.
                </CardContent>
              </Card>
            ) : (
              hiddenPosts.map(post => renderPost(post))
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!editPost} onOpenChange={(open) => !open && setEditPost(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          {editPost && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editPost.title}
                  onChange={(e) => setEditPost({ ...editPost, title: e.target.value })}
                  required
                  data-testid="input-edit-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">Content</Label>
                <Textarea
                  id="edit-content"
                  value={editPost.content}
                  onChange={(e) => setEditPost({ ...editPost, content: e.target.value })}
                  rows={6}
                  required
                  data-testid="input-edit-content"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-pinned"
                  checked={editPost.is_pinned}
                  onCheckedChange={(checked) => setEditPost({ ...editPost, is_pinned: checked })}
                  data-testid="switch-edit-pinned"
                />
                <Label htmlFor="edit-pinned">Pin to top of board</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updatePostMutation.isPending} data-testid="button-save-edit">
                  {updatePostMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePostId} onOpenChange={(open) => !open && setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this announcement. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePostId && deletePostMutation.mutate(deletePostId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deletePostMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hideConfirmPost} onOpenChange={(open) => !open && setHideConfirmPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>What would you like to do?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to hide this message from your board or keep it pinned?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHideConfirmPost(null)}>
              Keep Visible
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => hideConfirmPost && hidePostMutation.mutate({ postId: hideConfirmPost.id, isHidden: true })}
              data-testid="button-hide-post"
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Hide from Board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
