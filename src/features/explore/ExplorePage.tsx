import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  ArrowUpRight,
  BookOpen,
  Filter,
  Heart,
  Loader2,
  MapPin,
  Plus,
  Repeat2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import { Shell } from '@/components/layout';
import { Avatar, Button, PullToRefresh, SkeletonCard } from '@/components/ui';
import { useExchanges } from '@/hooks/useExchanges';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDebounce } from '@/hooks/useDebounce';
import { useInfiniteItems, useItemsCount, useUserItems } from '@/hooks/useItems';
import { useLikeItem, useMatches } from '@/hooks/useMatches';
import { formatDistance, haversineKm } from '@/lib/geo';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import type { Item, ItemCondition } from '@/types';

const conditionLabelsRu: Record<string, string> = {
  new: 'Новое',
  like_new: 'Как новое',
  good: 'Хорошее',
  fair: 'Нормальное',
};

const CONDITION_FILTERS: { value: ItemCondition | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новое' },
  { value: 'like_new', label: 'Как новое' },
  { value: 'good', label: 'Хорошее' },
  { value: 'fair', label: 'Нормальное' },
];

const GENRE_FILTERS = [
  { value: 'fiction', label: 'Художественная' },
  { value: 'non-fiction', label: 'Нон-фикшн' },
  { value: 'sci-fi', label: 'Фантастика' },
  { value: 'fantasy', label: 'Фэнтези' },
  { value: 'mystery', label: 'Детектив' },
  { value: 'romance', label: 'Романтика' },
  { value: 'thriller', label: 'Триллер' },
  { value: 'biography', label: 'Биография' },
  { value: 'history', label: 'История' },
  { value: 'science', label: 'Наука' },
  { value: 'self-help', label: 'Саморазвитие' },
  { value: 'children', label: 'Детская' },
];

const getCoverGradient = (title: string) => {
  const hash = title.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const gradients = [
    'from-emerald-100 to-lime-50',
    'from-amber-100 to-orange-50',
    'from-sky-100 to-emerald-50',
    'from-rose-100 to-stone-50',
  ];
  return gradients[hash % gradients.length]!;
};

const getExchangeLabel = (item: Item) => {
  if (item.exchange_type === 'sell') return item.price ? `${item.price}` : 'Продажа';
  if (item.exchange_type === 'both') return 'Обмен / продажа';
  return 'Обмен';
};

const getResultTitle = (searchQuery: string, sortByDistance: boolean) => {
  if (searchQuery.trim()) return `Результаты: ${searchQuery.trim()}`;
  return sortByDistance ? 'Ближе всего' : 'Книги рядом';
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
  const image = book.images?.[0];

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('light');
        navigate(`/book/${book.id}`);
      }}
      className="animate-book-card overflow-hidden rounded-2xl border border-[#e6e8ed] bg-white text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] active:scale-[0.99]"
      style={{ animationDelay: `${Math.min(index, 11) * 0.05}s` }}
    >
      <div className={cn('relative flex h-[150px] items-center justify-center bg-gradient-to-br', !image && getCoverGradient(book.title))}>
        {image ? (
          <img src={image} alt={book.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <BookOpen size={46} className="text-[#0b6b35]/35" />
        )}

        <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[12px] font-semibold text-[#0b6b35] shadow-sm backdrop-blur">
          <Repeat2 size={14} />
          {getExchangeLabel(book)}
        </span>

        <button
          type="button"
          className={cn(
            'absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/45 shadow-sm backdrop-blur transition',
            isLiked ? 'bg-[#e83e75] text-white' : 'bg-white/88 text-[#344054]',
            isLiking ? 'opacity-70' : 'active:scale-95',
          )}
          onClick={onLike}
          disabled={isLiking || isLiked}
          aria-label="Добавить в избранное"
        >
          <Heart size={18} className={isLiked ? 'fill-current' : ''} />
        </button>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-1 text-[17px] font-bold leading-tight text-[#101828]">{book.title}</h3>
        <p className="mt-1 line-clamp-1 text-[14px] text-[#667085]">{book.author ?? 'Автор не указан'}</p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={book.user?.first_name ?? '?'} lastName={book.user?.last_name} size="sm" />
            <div className="min-w-0">
              <p className="line-clamp-1 text-[13px] font-medium text-[#344054]">{book.user?.first_name ?? 'Пользователь'}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#667085]">
                {distance !== undefined ? (
                  <>
                    <MapPin size={12} />
                    {formatDistance(distance)}
                  </>
                ) : (
                  <>★ {book.user?.rating?.toFixed(1) ?? '0.0'}</>
                )}
              </p>
            </div>
          </div>

          <span className="shrink-0 text-[12px] font-semibold text-[#0b6b35]">
            {conditionLabelsRu[book.condition] ?? 'Состояние'}
          </span>
        </div>
      </div>
    </button>
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
    genre: genreFilter || undefined,
  });

  const { data: myItems } = useUserItems(currentUser?.id);
  const { data: matches = [] } = useMatches(currentUser?.id);
  const { data: exchanges = [] } = useExchanges(currentUser?.id);
  const { data: totalItems = 0 } = useItemsCount();
  const likeItem = useLikeItem();

  const allItems = useMemo(() => (infiniteData?.pages ?? []).flat(), [infiniteData]);

  const filteredBooks = useMemo(() => {
    const otherUsersBooks = allItems.filter((book) => book.user_id !== currentUser?.id);

    if (!sortByDistance || !coords) return otherUsersBooks;

    return [...otherUsersBooks].sort((a, b) => {
      const locA = a.user?.location as { lat: number; lng: number } | null;
      const locB = b.user?.location as { lat: number; lng: number } | null;
      const dA = locA ? haversineKm(coords.lat, coords.lng, locA.lat, locA.lng) : Infinity;
      const dB = locB ? haversineKm(coords.lat, coords.lng, locB.lat, locB.lng) : Infinity;
      return dA - dB;
    });
  }, [allItems, currentUser?.id, sortByDistance, coords]);

  const getDistance = (book: Item): number | undefined => {
    if (!coords) return undefined;
    const loc = book.user?.location as { lat: number; lng: number } | null;
    if (!loc) return undefined;
    return haversineKm(coords.lat, coords.lng, loc.lat, loc.lng);
  };

  const pendingMatches = matches.filter((m) => m.status === 'pending').length;
  const completedExchanges = exchanges.filter((e) => e.status === 'completed').length;

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
    <Shell className="bg-white text-[#101828]">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-white pb-7">
        <header className="sticky top-0 z-20 bg-white/92 px-5 pb-3 pt-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-[25px] font-bold text-[#2d7a45]"
                aria-label="Loopit"
              >
                <Repeat2 size={25} />
                Loopit
              </button>
              <p className="mt-1 text-[14px] text-[#667085]">Обмен книгами рядом с вами</p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/add-book')}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#08642f] px-4 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(8,100,47,0.22)] active:scale-[0.98]"
            >
              <Plus size={18} />
              Добавить
            </button>
          </div>
        </header>

        <section className="px-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={21} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]" />
              <input
                id="search-books"
                type="text"
                placeholder="Книги, авторы..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[#eaecf0] bg-[#f8fafc] pl-12 pr-10 text-[16px] text-[#101828] outline-none transition focus:border-[#0b6b35] focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]"
                  aria-label="Очистить поиск"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowFilters((v) => !v);
              }}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-2xl border transition',
                showFilters || conditionFilter !== 'all' || genreFilter
                  ? 'border-[#0b6b35] bg-[#eaf6ee] text-[#0b6b35]'
                  : 'border-[#eaecf0] bg-[#f8fafc] text-[#667085]',
              )}
              aria-label="Фильтры"
            >
              <Filter size={21} />
            </button>
          </div>

          {coords && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[#667085]">
              <MapPin size={14} className="text-[#0b6b35]" />
              Локация используется примерно, без показа точного адреса.
            </p>
          )}

          <div
            className={cn(
              'overflow-hidden transition-[max-height,opacity] duration-300 ease-out',
              showFilters ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="flex gap-2 overflow-x-auto pb-1 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CONDITION_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setConditionFilter(filter.value);
                  }}
                  className={cn(
                    'shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition',
                    conditionFilter === filter.value
                      ? 'border-[#0b6b35] bg-[#0b6b35] text-white'
                      : 'border-[#eaecf0] bg-white text-[#667085]',
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setGenreFilter('');
                }}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition',
                  !genreFilter ? 'border-[#0b6b35] bg-[#0b6b35] text-white' : 'border-[#eaecf0] bg-white text-[#667085]',
                )}
              >
                Все жанры
              </button>
              {GENRE_FILTERS.map((genre) => (
                <button
                  key={genre.value}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setGenreFilter(genreFilter === genre.value ? '' : genre.value);
                  }}
                  className={cn(
                    'shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition',
                    genreFilter === genre.value
                      ? 'border-[#0b6b35] bg-[#0b6b35] text-white'
                      : 'border-[#eaecf0] bg-white text-[#667085]',
                  )}
                >
                  {genre.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pt-4">
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                navigate('/matches');
              }}
              className="rounded-2xl border border-[#dce7ff] bg-[#f4f7ff] p-3 text-left active:scale-[0.98]"
            >
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#4357d5]">
                <Sparkles size={15} />
                Матчи
              </p>
              <p className="mt-2 text-[24px] font-bold text-[#4357d5]">{pendingMatches}</p>
            </button>

            <div className="rounded-2xl border border-[#eaecf0] bg-white p-3 text-left">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#667085]">
                <BookOpen size={15} />
                Доступно
              </p>
              <p className="mt-2 text-[24px] font-bold text-[#101828]">{totalItems}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                navigate('/exchanges');
              }}
              className="rounded-2xl border border-[#e3efe7] bg-white p-3 text-left active:scale-[0.98]"
            >
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#667085]">
                <ArrowUpRight size={15} className="text-[#0b6b35]" />
                Обмены
              </p>
              <p className="mt-2 text-[24px] font-bold text-[#0b6b35]">{completedExchanges}</p>
            </button>
          </div>
        </section>

        <PullToRefresh onRefresh={handleRefresh}>
          <section className="px-5 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-[#101828]">{getResultTitle(searchQuery, sortByDistance)}</h2>
              <div className="flex items-center gap-2">
                {coords && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSortByDistance((v) => !v);
                    }}
                    className={cn(
                      'flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-semibold transition',
                      sortByDistance
                        ? 'border-[#0b6b35] bg-[#eaf6ee] text-[#0b6b35]'
                        : 'border-[#eaecf0] bg-white text-[#667085]',
                    )}
                  >
                    <ArrowUpDown size={13} />
                    {sortByDistance ? 'Ближе' : 'Новые'}
                  </button>
                )}
                <span className="text-[14px] text-[#667085]">{filteredBooks.length} книг</span>
              </div>
            </div>

            {isLoading && (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            )}

            {!isLoading && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {filteredBooks.map((book, index) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      index={index}
                      isLiked={likedIds.has(book.id)}
                      isLiking={likeItem.isPending}
                      onLike={(event) => handleLike(book, event)}
                      distance={getDistance(book)}
                    />
                  ))}
                </div>

                {filteredBooks.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] px-6 py-12 text-center">
                    <BookOpen size={48} className="mb-3 text-[#98a2b3]" />
                    <p className="text-[16px] font-semibold text-[#101828]">Книги не найдены</p>
                    <p className="mt-1 text-[14px] text-[#667085]">
                      {searchQuery ? 'Попробуйте другой запрос' : 'Добавьте первую книгу для обмена'}
                    </p>
                    {!searchQuery && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus size={16} />}
                        className="mt-4"
                        onClick={() => navigate('/add-book')}
                      >
                        Добавить книгу
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            <div ref={sentinelRef} className="h-4" />

            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Loader2 size={22} className="animate-spin text-[#0b6b35]" />
              </div>
            )}
          </section>
        </PullToRefresh>

        <button
          type="button"
          onClick={() => navigate('/add-book')}
          className="fixed bottom-[96px] right-6 z-30 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#08642f] text-white shadow-[0_18px_35px_rgba(8,100,47,0.34)] active:scale-95"
          aria-label="Добавить книгу"
        >
          <Plus size={38} strokeWidth={2.2} />
        </button>
      </div>
    </Shell>
  );
};
