import { useQueryClient } from '@tanstack/react-query';
import { Repeat2, Check, X, ChevronRight, Sparkles, BookOpen, Heart, ArrowRight } from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Card, Avatar, Badge, Button, SkeletonMatchCard, PullToRefresh } from '@/components/ui';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { useNavigate } from 'react-router-dom';
import { useMatches, useAcceptMatch, useDeclineMatch, useLikeItem } from '@/hooks/useMatches';
import { useWishlistMatches } from '@/hooks/useWishlist';
import { useUserItems } from '@/hooks/useItems';
import { useAppStore } from '@/stores/appStore';
import type { Match, WishlistMatch } from '@/types';


// ─────────────────────────────────────────────────────────────────────
// MatchCard — existing bidirectional match
// ─────────────────────────────────────────────────────────────────────

const MatchCard = ({ match, index }: { match: Match; index: number }) => {
  const navigate = useNavigate();
  const acceptMatch = useAcceptMatch();
  const declineMatch = useDeclineMatch();

  return (
    <div
      className="animate-book-card"
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <Card className="relative overflow-hidden cursor-default active:scale-100" padding={false}>
        {/* High-score glow */}
        {match.score >= 90 && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-12 translate-x-12 blur-2xl pointer-events-none" />
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={match.partner?.first_name || 'User'}
                lastName={match.partner?.last_name || undefined}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[15px] font-semibold">
                    {match.partner?.first_name || 'Unknown'} {match.partner?.last_name || ''}
                  </span>
                  {match.status === 'pending' && (
                    <Badge variant="accent" size="sm">New</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[12px] text-text-muted">
                  <Sparkles size={12} className="text-accent" />
                  <span>{match.score}% match · ★ {match.partner?.rating?.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {match.status === 'accepted' && (
              <button
                className="flex items-center gap-1 text-[12px] font-medium text-accent active:scale-95 transition-transform"
                onClick={() => {
                  triggerHaptic('light');
                  if (match.conversation_id) navigate(`/chat/${match.conversation_id}`);
                }}
              >
                Chat <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* Book exchange cards */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-bg-tertiary rounded-xl p-2.5">
              <p className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wide">You offer</p>
              {match.offered_item?.images?.[0] ? (
                <img
                  src={match.offered_item.images[0]}
                  alt={match.offered_item.title}
                  className="w-full h-16 object-cover rounded-lg mb-1.5"
                />
              ) : (
                <div className="w-full h-16 bg-bg-secondary rounded-lg flex items-center justify-center mb-1.5">
                  <BookOpen size={20} className="text-text-muted" />
                </div>
              )}
              <p className="text-[11px] font-medium line-clamp-2 leading-tight">
                {match.offered_item?.title || 'Unknown'}
              </p>
            </div>

            <div className="bg-bg-tertiary rounded-xl p-2.5">
              <p className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wide">They offer</p>
              {match.wanted_item?.images?.[0] ? (
                <img
                  src={match.wanted_item.images[0]}
                  alt={match.wanted_item.title}
                  className="w-full h-16 object-cover rounded-lg mb-1.5"
                />
              ) : (
                <div className="w-full h-16 bg-bg-secondary rounded-lg flex items-center justify-center mb-1.5">
                  <BookOpen size={20} className="text-text-muted" />
                </div>
              )}
              <p className="text-[11px] font-medium line-clamp-2 leading-tight">
                {match.wanted_item?.title || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Actions */}
          {match.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                disabled={declineMatch.isPending}
                onClick={() => {
                  triggerHaptic('light');
                  declineMatch.mutate(match.id);
                }}
              >
                <X size={18} className="mr-1.5 text-error" />
                Pass
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                disabled={acceptMatch.isPending}
                onClick={() => {
                  triggerNotification('success');
                  acceptMatch.mutate(match.id, {
                    onSuccess: (conversationId) => {
                      if (conversationId) navigate(`/chat/${conversationId}`);
                    },
                  });
                }}
              >
                <Check size={18} className="mr-1.5" />
                Accept
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────
// WishlistSuggestionCard — found via wishlist keyword matching
// ─────────────────────────────────────────────────────────────────────

const WishlistSuggestionCard = ({
  suggestion,
  index,
  onConnect,
  isConnecting,
}: {
  suggestion: WishlistMatch;
  index: number;
  onConnect: () => void;
  isConnecting: boolean;
}) => (
  <div className="animate-book-card" style={{ animationDelay: `${index * 0.07}s` }}>
    <Card padding={false} className="overflow-hidden border-accent/20 relative">
      {/* Wishlist badge ribbon */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-accent/30" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            name={suggestion.other_first_name}
            lastName={suggestion.other_last_name ?? undefined}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[15px] font-semibold truncate">
                {suggestion.other_first_name} {suggestion.other_last_name ?? ''}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[12px] text-accent">
              <Heart size={11} className="fill-current" />
              <span>Wishlist match · ★ {suggestion.other_rating?.toFixed(1)}</span>
            </div>
          </div>
          <Badge variant="accent" size="sm">💫 New</Badge>
        </div>

        {/* Book pair */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-accent-soft/40 rounded-xl p-2.5 border border-accent/10">
            <p className="text-[10px] text-accent mb-1.5 font-medium uppercase tracking-wide">They want ↓</p>
            {suggestion.my_item_images?.[0] ? (
              <img
                src={suggestion.my_item_images[0]}
                alt={suggestion.my_item_title}
                className="w-full h-16 object-cover rounded-lg mb-1.5"
              />
            ) : (
              <div className="w-full h-16 bg-bg-tertiary rounded-lg flex items-center justify-center mb-1.5">
                <BookOpen size={20} className="text-text-muted" />
              </div>
            )}
            <p className="text-[11px] font-medium line-clamp-2 leading-tight">{suggestion.my_item_title}</p>
          </div>

          <div className="bg-bg-tertiary rounded-xl p-2.5">
            <p className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wide">You want ↓</p>
            {suggestion.their_item_images?.[0] ? (
              <img
                src={suggestion.their_item_images[0]}
                alt={suggestion.their_item_title}
                className="w-full h-16 object-cover rounded-lg mb-1.5"
              />
            ) : (
              <div className="w-full h-16 bg-bg-secondary rounded-lg flex items-center justify-center mb-1.5">
                <BookOpen size={20} className="text-text-muted" />
              </div>
            )}
            <p className="text-[11px] font-medium line-clamp-2 leading-tight">{suggestion.their_item_title}</p>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          className="w-full"
          disabled={isConnecting}
          onClick={() => { triggerNotification('success'); onConnect(); }}
        >
          <ArrowRight size={16} className="mr-1.5" />
          Send Match Request
        </Button>
      </div>
    </Card>
  </div>
);


// ─────────────────────────────────────────────────────────────────────
// MatchesPage — main page
// ─────────────────────────────────────────────────────────────────────

export const MatchesPage = () => {
  const currentUser = useAppStore(s => s.currentUser);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: matches, isLoading: matchesLoading } = useMatches(currentUser?.id);
  const { data: wishlistMatches = [], isLoading: wishlistLoading } = useWishlistMatches(currentUser?.id);
  const { data: myItems } = useUserItems(currentUser?.id);
  const likeItem = useLikeItem();

  const displayMatches = matches ?? [];
  const isLoading = matchesLoading || wishlistLoading;

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['matches', currentUser?.id] }),
      queryClient.invalidateQueries({ queryKey: ['wishlist-matches', currentUser?.id] }),
    ]);
  };

  const handleWishlistConnect = (suggestion: WishlistMatch) => {
    if (!currentUser) return;
    const myFirstItem = myItems?.[0] ?? null;
    likeItem.mutate({
      likerUserId: currentUser.id,
      likerItemId: myFirstItem?.id ?? null,
      ownerUserId: suggestion.other_user_id,
      ownerItemId: suggestion.their_item_id,
    });
  };

  const totalCount = displayMatches.length + wishlistMatches.length;

  return (
    <Shell>
      <PageHeader
        title="Matches"
        subtitle={
          isLoading
            ? 'Finding matches...'
            : `${totalCount} potential exchange${totalCount !== 1 ? 's' : ''}`
        }
      />

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-5 pb-6 space-y-3">

          {/* Loading skeletons */}
          {isLoading && (
            <>
              <SkeletonMatchCard />
              <SkeletonMatchCard />
              <SkeletonMatchCard />
            </>
          )}

          {/* Wishlist-based suggestions */}
          {!isLoading && wishlistMatches.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <Heart size={14} className="text-accent fill-current" />
                <span className="text-[13px] font-semibold text-accent">Wishlist Matches</span>
                <span className="text-[12px] text-text-muted ml-auto">{wishlistMatches.length} found</span>
              </div>
              {wishlistMatches.map((s, i) => (
                <WishlistSuggestionCard
                  key={`${s.other_user_id}-${s.their_item_id}`}
                  suggestion={s}
                  index={i}
                  onConnect={() => handleWishlistConnect(s)}
                  isConnecting={likeItem.isPending}
                />
              ))}
            </>
          )}

          {/* Regular matches divider */}
          {!isLoading && displayMatches.length > 0 && wishlistMatches.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Sparkles size={14} className="text-text-muted" />
              <span className="text-[13px] font-semibold text-text-secondary">Other Matches</span>
            </div>
          )}

          {/* Regular matches */}
          {!isLoading && displayMatches.map((match, index) => (
            <MatchCard key={match.id} match={match} index={index} />
          ))}

          {/* Empty state */}
          {!isLoading && totalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-accent-soft rounded-2xl flex items-center justify-center mb-4">
                <Repeat2 size={28} className="text-accent" />
              </div>
              <p className="text-[16px] font-medium mb-1">No matches yet</p>
              <p className="text-[13px] text-text-secondary max-w-[240px]">
                Add books and fill your wishlist to find matching readers nearby
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" size="sm" onClick={() => navigate('/wishlist')}>
                  My Wishlist
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/add-book')}>
                  Add Books
                </Button>
              </div>
            </div>
          )}
        </div>
      </PullToRefresh>
    </Shell>
  );
};
