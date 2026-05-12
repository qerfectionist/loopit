import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, BookOpen, ArrowUpRight, Sparkles, Heart, Filter, X, MapPin, ArrowUpDown, Loader2 } from 'lucide-react';

import { Shell } from '@/components/layout';
import { Card, Badge, Button, Avatar, SkeletonCard, PullToRefresh } from '@/components/ui';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { conditionLabels, conditionColors } from '@/lib/utils';
import { useInfiniteItems, useUserItems, useItemsCount } from '@/hooks/useItems';
import { useDebounce } from '@/hooks/useDebounce';
import { useMatches, useLikeItem } from '@/hooks/useMatches';
import { useExchanges } from '@/hooks/useExchanges';
import { useAppStore } from '@/stores/appStore';
import { useGeolocation } from '@/hooks/useGeolocation';

import { haversineKm, formatDistance } from '@/lib/geo';
import type { Item, ItemCondition } from '@/types';

const CONDITION_FILTERS: { value: ItemCondition | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: '✨ New' },
  { value: 'like_new', label: '📗 Like New' },
  { value: 'good', label: '📘 Good' },
  { value: 'fair', label: '📙 Fair' },
];

const GENRE_FILTERS = [
  { value: 'fiction', label: '📖 Fiction' },
  { value: 'non-fiction', label: '📚 Non-Fiction' },
  { value: 'sci-fi', label: '🚀 Sci-Fi' },
  { value: 'fantasy', label: '🧙 Fantasy' },
  { value: 'mystery', label: '🔍 Mystery' },
  { value: 'romance', label: '💕 Romance' },
  { value: 'thriller', label: '😱 Thriller' },
  { value: 'biography', label: '👤 Biography' },
  { value: 'history', label: '🏛️ History' },
  { value: 'science', label: '🔬 Science' },
  { value: 'self-help', label: '💡 Self-Help' },
  { value: 'children', label: '🧒 Children' },
];

/** Book cover gradient based on title hash */
const getCoverGradient = (title: string) => {
  const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const gradients = [
    'from-indigo-600/40 to-purple-800/40',
    'from-rose-600/40 to-pink-800/40',
    'from-emerald-600/40 to-teal-800/40',
    'from-amber-600/40 to-orange-800/40',
    'from-cyan-600/40 to-sky-800/40',
    'from-violet-600/40 to-fuchsia-800/40',
  ];
  return gradients[hash % gradients.length]!;
};

const BookCard = ({
  book,
  index,
  onLike,
  isLiked,
  isLiking,
  distance,
}: {
  book: Item;
  index: number;
  onLike: (e: React.MouseEvent) => void;
  isLiked: boolean;
  isLiking: boolean;
  distance?: number;
}) => {
  const navigate = useNavigate();
  const hasImage = book.images && book.images.length > 0 && book.images[0];

  return (
    <div className="animate-book-card" style={{ animationDelay: `${Math.min(index, 11) * 0.06}s` }}>
      <Card
        hover
        padding={false}
        className="overflow-hidden"
        onClick={() => {
          triggerHaptic('light');
          navigate(`/book/${book.id}`);
        }}
      >
        {/* Book cover */}
        <div className={`h-36 ${hasImage ? '' : `bg-gradient-to-br ${getCoverGradient(book.title)}`} flex items-center justify-center relative overflow-hidden`}>
          {hasImage ? (
            <img
              src={book.images[0]}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <BookOpen size={40} className="text-white/30" />
          )}
          <div className="absolute top-2.5 right-2.5">
            <Badge variant={book.exchange_type === 'exchange' ? 'accent' : book.exchange_type === 'sell' ? 'warning' : 'success'} size="sm">
              {book.exchange_type === 'exchange' ? '↔' : book.exchange_type === 'sell' ? `$${book.price}` : '↔/$'}
            </Badge>
          </div>
          {/* Like button */}
          <button
            className={`absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isLiked
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-black/30 text-white/70 hover:bg-black/50 hover:text-white'
            } ${isLiking ? 'opacity-70' : 'active:scale-95'}`}
            onClick={onLike}
            disabled={isLiking || isLiked}
          >
            <Heart size={15} className={isLiked ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5">
          <h3 className="text-[15px] font-semibold leading-tight line-clamp-1">
            {book.title}
          </h3>
          <p className="text-[13px] text-text-secondary mt-0.5 line-clamp-1">
            {book.author}
          </p>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5">
              <Avatar
                name={book.user?.first_name ?? '?'}
                lastName={book.user?.last_name}
                size="sm"
              />
              <div className="flex flex-col">
                <span className="text-[12px] text-text-secondary leading-tight">
                  {book.user?.first_name}
                </span>
                {distance !== undefined ? (
                  <span className="text-[10px] text-accent leading-tight flex items-center gap-0.5">
                    <MapPin size={9} />{formatDistance(distance)}
                  </span>
                ) : (
                  <span className="text-[10px] text-text-muted leading-tight">
                    ★ {book.user?.rating?.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            <span className={`text-[11px] font-medium ${conditionColors[book.condition]}`}>
              {conditionLabels[book.condition]}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};


export const ExplorePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<ItemCondition | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [genreFilter, setGenreFilter] = useState('');
  const [sortByDistance, setSortByDistance] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const currentUser = useAppStore((s) => s.currentUser);
  const { coords } = useGeolocation(currentUser?.id);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search — prevents a DB call on every keystroke
  const debouncedSearch = useDebounce(searchQuery, 350);

  const {
    data: infiniteData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteItems({
    search: debouncedSearch || undefined,
    condition: conditionFilter !== 'all' ? conditionFilter : undefined,
  });

  const { data: myItems } = useUserItems(currentUser?.id);
  const { data: matches = [] } = useMatches(currentUser?.id);
  const { data: exchanges = [] } = useExchanges(currentUser?.id);
  const { data: totalItems = 0 } = useItemsCount();

  const likeItem = useLikeItem();

  // Flatten all pages into one array
  const allItems = useMemo(
    () => (infiniteData?.pages ?? []).flat(),
    [infiniteData],
  );

  // Filter out current user's items and blocked users, and apply client-side genre + distance sort
  const filteredBooks = useMemo(() => {
    let mine = allItems.filter((book) => book.user_id !== currentUser?.id);

    if (genreFilter) {
      mine = mine.filter((book) => {
        const g = (book.metadata as { genre?: string } | null)?.genre;
        return g === genreFilter;
      });
    }

    if (!sortByDistance || !coords) return mine;

    return [...mine].sort((a, b) => {
      const locA = a.user?.location as { lat: number; lng: number } | null;
      const locB = b.user?.location as { lat: number; lng: number } | null;
      const dA = locA ? haversineKm(coords.lat, coords.lng, locA.lat, locA.lng) : Infinity;
      const dB = locB ? haversineKm(coords.lat, coords.lng, locB.lat, locB.lng) : Infinity;
      return dA - dB;
    });
  }, [allItems, currentUser?.id, genreFilter, sortByDistance, coords]);

  const getDistance = (book: Item): number | undefined => {
    if (!coords) return undefined;
    const loc = book.user?.location as { lat: number; lng: number } | null;
    if (!loc) return undefined;
    return haversineKm(coords.lat, coords.lng, loc.lat, loc.lng);
  };

  // Stats
  const pendingMatches = matches.filter((m) => m.status === 'pending').length;
  const completedExchanges = exchanges.filter((e) => e.status === 'completed').length;

  // Intersection Observer for infinite scroll sentinel
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const handleLike = (book: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || likedIds.has(book.id)) return;
    triggerNotification('success');
    setLikedIds((prev) => new Set(prev).add(book.id));
    const myFirstItem = myItems?.[0] ?? null;
    likeItem.mutate({
      likerItemId: myFirstItem?.id ?? null,
      ownerItemId: book.id,
    });
  };

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <Shell>
      {/* Header */}
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">
              <span className="gradient-text">Loopit</span>
            </h1>
            <p className="text-[13px] text-text-secondary -mt-0.5">
              Exchange books with people near you
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => navigate('/add-book')}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-3">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              id="search-books"
              type="text"
              placeholder="Search books, authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl text-[14px]
                bg-bg-tertiary text-text-primary placeholder-text-muted
                border border-border focus:border-accent
                outline-none transition-colors duration-150"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => { triggerHaptic('light'); setShowFilters(!showFilters); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
              showFilters || conditionFilter !== 'all'
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-bg-tertiary border-border text-text-muted'
            }`}
          >
            <Filter size={18} />
          </button>
        </div>

        {/* Filters */}
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            showFilters ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex gap-2 pt-2.5 overflow-x-auto scrollbar-hide">
            {CONDITION_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { triggerHaptic('light'); setConditionFilter(f.value); }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap border transition-colors ${
                  conditionFilter === f.value
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => { triggerHaptic('light'); setGenreFilter(''); }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap border transition-colors ${
                genreFilter === ''
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary'
              }`}
            >
              All Genres
            </button>
            {GENRE_FILTERS.map((g) => (
              <button
                key={g.value}
                onClick={() => { triggerHaptic('light'); setGenreFilter(genreFilter === g.value ? '' : g.value); }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap border transition-colors ${
                  genreFilter === g.value
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="px-5 pb-3">
        <div className="flex gap-2">
          <div
            className="flex-1 bg-accent-soft/60 rounded-xl p-3 border border-accent/10 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => { triggerHaptic('light'); navigate('/matches'); }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={14} className="text-accent" />
              <span className="text-[11px] font-medium text-accent-text">New Matches</span>
            </div>
            <span className="text-[20px] font-bold text-accent">{pendingMatches}</span>
          </div>
          <div className="flex-1 bg-bg-secondary rounded-xl p-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen size={14} className="text-text-secondary" />
              <span className="text-[11px] font-medium text-text-secondary">Available</span>
            </div>
            <span className="text-[20px] font-bold">{totalItems}</span>
          </div>
          <div
            className="flex-1 bg-bg-secondary rounded-xl p-3 border border-border cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => { triggerHaptic('light'); navigate('/exchanges'); }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight size={14} className="text-success" />
              <span className="text-[11px] font-medium text-text-secondary">Exchanges</span>
            </div>
            <span className="text-[20px] font-bold text-success">{completedExchanges}</span>
          </div>
        </div>
      </div>

      {/* Book grid — wrapped in PullToRefresh */}
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold">
              {searchQuery ? `Results for "${searchQuery}"` : sortByDistance ? 'Nearest to you' : 'Near you'}
            </h2>
            <div className="flex items-center gap-2">
              {coords && (
                <button
                  onClick={() => { triggerHaptic('light'); setSortByDistance((v) => !v); }}
                  className={`flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    sortByDistance
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-bg-secondary text-text-muted border-border'
                  }`}
                >
                  <ArrowUpDown size={12} />
                  {sortByDistance ? 'Nearest' : 'Recent'}
                </button>
              )}
              <span className="text-[13px] text-text-muted">{filteredBooks.length} books</span>
            </div>
          </div>

          {/* Skeleton loading grid */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Loaded books grid */}
          {!isLoading && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {filteredBooks.map((book, index) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    index={index}
                    isLiked={likedIds.has(book.id)}
                    isLiking={likeItem.isPending}
                    onLike={(e) => handleLike(book, e)}
                    distance={getDistance(book)}
                  />
                ))}
              </div>

              {/* Empty state */}
              {filteredBooks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen size={48} className="text-text-muted mb-3" />
                  <p className="text-[15px] font-medium text-text-secondary">No books found</p>
                  <p className="text-[13px] text-text-muted mt-1">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Be the first to add a book!'}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus size={16} />}
                      className="mt-4"
                      onClick={() => navigate('/add-book')}
                    >
                      Add a Book
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-accent" />
            </div>
          )}
        </div>
      </PullToRefresh>
    </Shell>
  );
};
