import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Heart, BookOpen, Loader2 } from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Card, Button, Input, Badge } from '@/components/ui';
import { triggerHaptic, triggerNotification, showConfirm } from '@/lib/telegram';
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from '@/hooks/useWishlist';
import { useAppStore } from '@/stores/appStore';

export const WishlistPage = () => {
  const currentUser = useAppStore((s) => s.currentUser);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  const { data: items = [], isLoading } = useWishlist(currentUser?.id);
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  const handleAdd = () => {
    if (!newTitle.trim() || !currentUser) return;
    triggerNotification('success');
    addToWishlist.mutate(
      {
        user_id: currentUser.id,
        title: newTitle.trim(),
        author: newAuthor.trim() || undefined,
        category: 'book',
        priority: 0,
      },
      {
        onSuccess: () => {
          setNewTitle('');
          setNewAuthor('');
          setShowAdd(false);
        },
      }
    );
  };

  const handleRemove = async (id: string) => {
    const ok = await showConfirm('Remove this book from your wishlist?');
    if (!ok) return;
    triggerHaptic('medium');
    removeFromWishlist.mutate(id);
  };

  return (
    <Shell hideNav>
      <PageHeader
        title="Wishlist"
        subtitle={
          isLoading
            ? 'Loading...'
            : `${items.length} books you're looking for`
        }
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => {
              triggerHaptic('light');
              setShowAdd(!showAdd);
            }}
          >
            Add
          </Button>
        }
      />

      <div className="px-5 pb-6">
        {/* Add form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="mb-4">
                <div className="space-y-3">
                  <Input
                    label="Book Title"
                    placeholder="What book are you looking for?"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <Input
                    label="Author (optional)"
                    placeholder="Author name"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleAdd}
                      disabled={!newTitle.trim() || addToWishlist.isPending}
                    >
                      {addToWishlist.isPending ? 'Adding...' : 'Add to Wishlist'}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowAdd(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16, scale: 0.95 }}
                    transition={{ delay: index * 0.05, duration: 0.25 }}
                  >
                    <Card className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent-soft rounded-xl flex items-center justify-center flex-shrink-0">
                        <Heart size={18} className="text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold truncate">{item.title}</p>
                        {item.author && (
                          <p className="text-[13px] text-text-secondary truncate">{item.author}</p>
                        )}
                      </div>
                      {item.priority > 0 && (
                        <Badge variant="accent" size="sm">Priority</Badge>
                      )}
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={removeFromWishlist.isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error-soft transition-colors flex-shrink-0 disabled:opacity-50"
                      >
                        <Trash2 size={16} className="text-text-muted hover:text-error" />
                      </button>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-bg-secondary rounded-2xl flex items-center justify-center mb-4 border border-border">
                  <BookOpen size={28} className="text-text-muted" />
                </div>
                <p className="text-[16px] font-medium mb-1">Your wishlist is empty</p>
                <p className="text-[13px] text-text-secondary max-w-[240px]">
                  Add books you&apos;re looking for and we&apos;ll find matches for you
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
};
