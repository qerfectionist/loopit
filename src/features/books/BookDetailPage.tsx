import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Repeat2, DollarSign, Star, MessageCircle, Share2, Heart, Loader2 } from 'lucide-react';
import { Shell } from '@/components/layout';
import { Button, Avatar, Badge, Card } from '@/components/ui';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { conditionLabels, conditionColors, formatRelativeTime } from '@/lib/utils';
import { useItem } from '@/hooks/useItems';
import { useLikeItem } from '@/hooks/useMatches';
import { useAppStore } from '@/stores/appStore';
import { useState } from 'react';

const getCoverGradient = (title: string) => {
  const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const gradients = [
    'from-indigo-600/50 to-purple-900/50',
    'from-rose-600/50 to-pink-900/50',
    'from-emerald-600/50 to-teal-900/50',
    'from-amber-600/50 to-orange-900/50',
    'from-cyan-600/50 to-sky-900/50',
    'from-violet-600/50 to-fuchsia-900/50',
  ];
  return gradients[hash % gradients.length]!;
};

export const BookDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { data: book, isLoading } = useItem(id);
  const likeItem = useLikeItem();
  const [liked, setLiked] = useState(false);

  if (isLoading) {
    return (
      <Shell hideNav>
        <div className="flex items-center justify-center h-dvh">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </Shell>
    );
  }

  if (!book) {
    return (
      <Shell hideNav>
        <div className="flex flex-col items-center justify-center h-dvh">
          <BookOpen size={48} className="text-text-muted mb-3" />
          <p className="text-[15px] text-text-secondary">Book not found</p>
          <Button variant="ghost" onClick={() => navigate('/')} className="mt-3">Go back</Button>
        </div>
      </Shell>
    );
  }

  const isOwner = book.user_id === currentUser?.id;
  const hasImage = book.images && book.images.length > 0 && book.images[0];

  const handleLike = () => {
    if (!currentUser || liked || isOwner) return;
    setLiked(true);
    triggerNotification('success');
    likeItem.mutate({
      likerItemId: null,
      ownerItemId: book.id,
    });
  };

  return (
    <Shell hideNav>
      {/* Hero image / gradient */}
      <div className={`relative h-56 ${hasImage ? '' : `bg-gradient-to-br ${getCoverGradient(book.title)}`} flex items-center justify-center overflow-hidden`}>
        {hasImage ? (
          <img src={book.images[0]} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={56} className="text-white/20" />
        )}
        {/* Back button */}
        <button
          onClick={() => { triggerHaptic('light'); navigate(-1); }}
          className="absolute top-4 left-4 w-10 h-10 glass rounded-full flex items-center justify-center z-10"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button className="w-10 h-10 glass rounded-full flex items-center justify-center">
            <Share2 size={18} className="text-white" />
          </button>
          {!isOwner && (
            <button
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                liked
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'glass text-white'
              }`}
              onClick={handleLike}
              disabled={liked}
            >
              <Heart size={18} className={liked ? 'fill-current' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-5 -mt-6 relative z-10"
      >
        {/* Main info card */}
        <Card className="mb-4">
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1">
              <h1 className="text-[22px] font-bold leading-tight">{book.title}</h1>
              <p className="text-[15px] text-text-secondary mt-0.5">{book.author}</p>
            </div>
            <Badge
              variant={book.exchange_type === 'exchange' ? 'accent' : book.exchange_type === 'sell' ? 'warning' : 'success'}
              size="md"
            >
              {book.exchange_type === 'exchange' ? '↔ Exchange' : book.exchange_type === 'sell' ? `$${book.price}` : '↔ / $'}
            </Badge>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="default" size="sm">
              <span className={conditionColors[book.condition]}>{conditionLabels[book.condition]}</span>
            </Badge>
            {book.isbn && (
              <Badge variant="default" size="sm">ISBN: {book.isbn}</Badge>
            )}
            <Badge variant="default" size="sm">{formatRelativeTime(book.created_at)}</Badge>
          </div>
        </Card>

        {/* Description */}
        {book.description && (
          <Card className="mb-4">
            <h3 className="text-[13px] font-medium text-text-muted uppercase tracking-wider mb-2">Description</h3>
            <p className="text-[14px] text-text-secondary leading-relaxed">{book.description}</p>
          </Card>
        )}

        {/* Image gallery */}
        {book.images && book.images.length > 1 && (
          <Card className="mb-4">
            <h3 className="text-[13px] font-medium text-text-muted uppercase tracking-wider mb-3">Photos</h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {book.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`${book.title} photo ${i + 1}`}
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                />
              ))}
            </div>
          </Card>
        )}

        {/* Owner */}
        {book.user && (
          <Card className="mb-4" onClick={() => { triggerHaptic('light'); }}>
            <h3 className="text-[13px] font-medium text-text-muted uppercase tracking-wider mb-3">Listed by</h3>
            <div className="flex items-center gap-3">
              <Avatar name={book.user.first_name} lastName={book.user.last_name} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">{book.user.first_name} {book.user.last_name}</span>
                  {book.user.rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Star size={12} className="text-warning fill-warning" />
                      <span className="text-[12px] font-medium">{book.user.rating}</span>
                    </div>
                  )}
                </div>
                <p className="text-[12px] text-text-muted">
                  @{book.user.username} · {book.user.total_exchanges} exchanges
                </p>
                {book.user.bio && (
                  <p className="text-[13px] text-text-secondary mt-1">{book.user.bio}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Action buttons */}
        {!isOwner && (
          <div className="flex gap-3 pb-10">
            {(book.exchange_type === 'exchange' || book.exchange_type === 'both') && (
              <Button
                variant="primary"
                fullWidth
                size="lg"
                icon={<Repeat2 size={18} />}
                onClick={() => {
                  handleLike();
                }}
              >
                Propose Exchange
              </Button>
            )}
            {(book.exchange_type === 'sell' || book.exchange_type === 'both') && (
              <Button
                variant="secondary"
                fullWidth
                size="lg"
                icon={<DollarSign size={18} />}
                onClick={() => { triggerHaptic('medium'); }}
              >
                Buy ${book.price}
              </Button>
            )}
            <Button
              variant="ghost"
              size="lg"
              icon={<MessageCircle size={18} />}
              onClick={() => { triggerHaptic('light'); }}
              className="flex-shrink-0"
            />
          </div>
        )}
      </motion.div>
    </Shell>
  );
};
