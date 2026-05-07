import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, BookOpen, Trash2, Edit2, Loader2 } from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Card, Badge, Button } from '@/components/ui';
import { conditionLabels, conditionColors } from '@/lib/utils';
import { triggerHaptic, showConfirm } from '@/lib/telegram';
import { useAppStore } from '@/stores/appStore';
import { useUserItems, useRemoveItem } from '@/hooks/useItems';


export const MyBooksPage = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  
  const { data: items, isLoading } = useUserItems(currentUser?.id);
  const removeItemMutation = useRemoveItem();

  const handleDelete = (id: string) => {
    triggerHaptic('medium');
    showConfirm('Are you sure you want to remove this book from your listings?').then((confirmed) => {
      if (confirmed) {
        removeItemMutation.mutate(id, {
          onSuccess: () => {
            triggerHaptic('light');
          }
        });
      }
    });
  };

  return (
    <Shell hideNav>
      <PageHeader
        title="My Books"
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => {
              triggerHaptic('light');
              navigate('/add-book');
            }}
          >
            Add
          </Button>
        }
      />
      <button 
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 p-2 -ml-2 text-text-primary z-20"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="px-5 pb-6 pt-16">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="flex flex-col gap-3">
              {items?.map((book, i) => (
                <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="flex items-center gap-4 p-3 relative overflow-hidden">
                  <div className="w-16 h-20 rounded-md bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={24} className="text-accent" />
                  </div>
                  
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={book.status === 'active' ? 'success' : 'default'} size="sm">
                        {book.status}
                      </Badge>
                      <span className={`text-[11px] font-medium ${conditionColors[book.condition]}`}>
                        {conditionLabels[book.condition]}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-semibold leading-tight line-clamp-1 mb-0.5">{book.title}</h3>
                    <p className="text-[13px] text-text-secondary line-clamp-1 mb-2">{book.author}</p>
                    <div className="flex gap-2 mt-auto">
                      <button 
                        className="text-[12px] font-medium text-accent flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-md"
                        onClick={() => navigate(`/book/${book.id}`)}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button 
                        className="text-[12px] font-medium text-error flex items-center gap-1 bg-error/10 px-2 py-1 rounded-md ml-auto"
                        onClick={() => handleDelete(book.id)}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}

            {(!items || items.length === 0) && (
              <div className="py-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
                  <BookOpen size={28} className="text-text-muted" />
                </div>
                <h3 className="text-[16px] font-semibold mb-1">No books listed</h3>
                <p className="text-[14px] text-text-secondary max-w-[240px] mb-6">
                  List your first book to start matching with other readers nearby.
                </p>
                <Button 
                  variant="primary" 
                  icon={<Plus size={18} />}
                  onClick={() => navigate('/add-book')}
                >
                  List a Book
                </Button>
              </div>
            )}
          </div>
          </AnimatePresence>
        )}
      </div>
    </Shell>
  );
};
