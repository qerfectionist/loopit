import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ChevronRight,
  Globe2,
  List,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  Repeat2,
  Share2,
  ShieldCheck,
} from 'lucide-react';

import { Shell } from '@/components/layout';
import { Avatar, Button } from '@/components/ui';
import { useItem, useItems } from '@/hooks/useItems';
import { useLikeItem } from '@/hooks/useMatches';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import type { Item } from '@/types';

const genreLabels: Record<string, string> = {
  fiction: 'Художественная',
  'non-fiction': 'Нон-фикшн',
  'sci-fi': 'Фантастика',
  fantasy: 'Фэнтези',
  mystery: 'Детектив',
  romance: 'Романтика',
  thriller: 'Триллер',
  biography: 'Биография',
  history: 'История',
  science: 'Наука',
  'self-help': 'Саморазвитие',
  children: 'Детская',
};

const conditionLabelsRu: Record<string, string> = {
  new: 'Новое',
  like_new: 'Как новое',
  good: 'Хорошее состояние',
  fair: 'Нормальное состояние',
};

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

const getMetadataValue = (item: Item, key: string) => {
  const value = item.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getGenreLabel = (item: Item) => {
  const genre = getMetadataValue(item, 'genre');
  if (!genre) return 'Не указан';
  return genreLabels[genre] ?? genre;
};

const getLanguageLabel = (item: Item) => getMetadataValue(item, 'language') ?? 'Не указан';

const formatPostedAt = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) {
    return `Сегодня, ${time}`;
  }

  return `${date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}, ${time}`;
};

const SimilarBookCard = ({ item }: { item: Item }) => {
  const navigate = useNavigate();
  const image = item.images?.[0];
  const city = item.user?.location?.city;

  return (
    <button
      onClick={() => {
        triggerHaptic('light');
        navigate(`/book/${item.id}`);
      }}
      className="grid w-[250px] shrink-0 grid-cols-[96px_1fr] overflow-hidden rounded-2xl border border-[#e6e8ed] bg-white text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
    >
      <div className={cn('h-[118px] bg-gradient-to-br', !image && getCoverGradient(item.title))}>
        {image ? (
          <img src={image} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen size={30} className="text-[#0b6b35]/35" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center px-4 py-3">
        <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-[#101828]">{item.title}</p>
        <p className="mt-1 line-clamp-1 text-[13px] text-[#667085]">{item.author ?? 'Автор не указан'}</p>
        <p className="mt-4 flex items-center gap-1 text-[12px] text-[#667085]">
          <MapPin size={14} />
          {city ?? 'Рядом'}
        </p>
      </div>
    </button>
  );
};

export const BookDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { data: book, isLoading } = useItem(id);
  const likeItem = useLikeItem();
  const [liked, setLiked] = useState(false);

  const genre = book ? getMetadataValue(book, 'genre') : null;
  const { data: relatedItems = [] } = useItems({
    category: book?.category,
    genre: genre ?? undefined,
    limit: 8,
  });

  const similarBooks = useMemo(
    () => relatedItems.filter((item) => item.id !== book?.id && item.user_id !== currentUser?.id).slice(0, 6),
    [book?.id, currentUser?.id, relatedItems],
  );

  if (isLoading) {
    return (
      <Shell className="bg-white">
        <div className="flex min-h-dvh items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#0b6b35]" />
        </div>
      </Shell>
    );
  }

  if (!book) {
    return (
      <Shell className="bg-white">
        <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
          <BookOpen size={48} className="mb-3 text-[#98a2b3]" />
          <p className="text-[16px] font-semibold text-[#101828]">Книга не найдена</p>
          <Button variant="ghost" onClick={() => navigate('/')} className="mt-3 text-[#0b6b35]">
            Назад
          </Button>
        </div>
      </Shell>
    );
  }

  const isOwner = book.user_id === currentUser?.id;
  const image = book.images?.[0];
  const owner = book.user;
  const city = owner?.location?.city ?? 'Город не указан';
  const postedAt = formatPostedAt(book.created_at);

  const handleInterest = () => {
    if (!currentUser || liked || isOwner || likeItem.isPending) return;

    setLiked(true);
    likeItem.mutate(
      {
        likerItemId: null,
        ownerItemId: book.id,
      },
      {
        onSuccess: () => triggerNotification('success'),
        onError: () => {
          setLiked(false);
          triggerNotification('error');
        },
      },
    );
  };

  const handleShare = async () => {
    triggerHaptic('light');

    try {
      if (navigator.share) {
        await navigator.share({
          title: book.title,
          text: book.author ?? undefined,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard?.writeText(window.location.href);
      triggerNotification('success');
    } catch {
      triggerNotification('warning');
    }
  };

  return (
    <Shell className="bg-white text-[#101828]">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-white pb-28">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between bg-white/92 px-5 pt-3 backdrop-blur-xl">
          <button
            onClick={() => {
              triggerHaptic('light');
              navigate(-1);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#101828] active:bg-[#f2f4f7]"
            aria-label="Назад"
          >
            <ArrowLeft size={28} strokeWidth={2.2} />
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[17px] font-bold text-[#2d7a45]"
            aria-label="Loopit"
          >
            <Repeat2 size={22} />
            Loopit
          </button>

          <button
            onClick={handleShare}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#101828] active:bg-[#f2f4f7]"
            aria-label="Поделиться"
          >
            <Share2 size={27} strokeWidth={2} />
          </button>
        </header>

        <main className="px-5">
          <section className={cn('overflow-hidden rounded-2xl bg-gradient-to-br', !image && getCoverGradient(book.title))}>
            {image ? (
              <img src={image} alt={book.title} className="h-[270px] w-full object-cover" />
            ) : (
              <div className="flex h-[270px] items-center justify-center">
                <BookOpen size={72} className="text-[#0b6b35]/35" />
              </div>
            )}
          </section>

          <section className="pt-5">
            <h1 className="text-[28px] font-bold leading-tight text-[#101828]">
              {book.title}
            </h1>
            <p className="mt-1 text-[19px] text-[#667085]">{book.author ?? 'Автор не указан'}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#eaf6ee] px-4 text-[15px] font-medium text-[#0b6b35]">
                <Repeat2 size={17} />
                {book.exchange_type === 'sell' ? 'Продажа' : book.exchange_type === 'both' ? 'Обмен / продажа' : 'Обмен'}
              </span>
              <span className="inline-flex h-10 items-center rounded-2xl bg-[#fff4d8] px-4 text-[15px] font-medium text-[#9a6700]">
                {conditionLabelsRu[book.condition] ?? 'Состояние'}
              </span>
              <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#f2f4f7] px-4 text-[15px] font-medium text-[#667085]">
                <MapPin size={17} />
                {city}
              </span>
            </div>

            {book.description && (
              <p className="mt-5 whitespace-pre-line text-[16px] leading-6 text-[#667085]">
                {book.description}
              </p>
            )}
          </section>

          {owner && (
            <button className="mt-6 flex w-full items-center gap-4 rounded-2xl border border-[#e6e8ed] bg-white p-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] active:bg-[#f8fafc]">
              <Avatar name={owner.first_name} lastName={owner.last_name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-semibold text-[#101828]">
                  {owner.first_name} {owner.last_name ?? ''}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[14px] text-[#667085]">
                  <ShieldCheck size={16} className="fill-[#0b6b35] text-[#0b6b35]" />
                  <span className="font-semibold text-[#0b6b35]">{owner.rating.toFixed(1)}</span>
                  <span>· Надежный пользователь</span>
                </p>
                <p className="mt-1 text-[14px] text-[#667085]">{city}</p>
              </div>
              <ChevronRight size={24} className="text-[#667085]" />
            </button>
          )}

          <section className="mt-4 rounded-2xl border border-[#e6e8ed] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="grid grid-cols-2 divide-x divide-[#eaecf0]">
              <div className="space-y-5 pr-4">
                <InfoRow icon={<List size={24} />} label="Жанр" value={getGenreLabel(book)} />
                <InfoRow icon={<MapPin size={25} />} label="Город" value={city} />
              </div>
              <div className="space-y-5 pl-4">
                <InfoRow icon={<Globe2 size={25} />} label="Язык" value={getLanguageLabel(book)} />
                <InfoRow icon={<CalendarClock size={25} />} label="Размещено" value={postedAt} />
              </div>
            </div>
          </section>

          {!isOwner && (
            <section className="mt-5 space-y-3">
              <button
                onClick={handleInterest}
                disabled={liked || likeItem.isPending}
                className="flex h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-[#08642f] text-[18px] font-semibold text-white shadow-[0_14px_30px_rgba(8,100,47,0.28)] transition active:scale-[0.99] disabled:opacity-60"
              >
                {likeItem.isPending ? <Loader2 size={22} className="animate-spin" /> : <Repeat2 size={24} />}
                {liked ? 'Запрос отправлен' : 'Предложить обмен'}
              </button>

              <button
                onClick={handleInterest}
                disabled={liked || likeItem.isPending}
                className="flex h-[58px] w-full items-center justify-center gap-3 rounded-2xl border border-[#d0d5dd] bg-white text-[18px] font-medium text-[#101828] transition active:bg-[#f8fafc] disabled:opacity-60"
              >
                <MessageCircle size={24} />
                Написать
              </button>
            </section>
          )}

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#101828]">Похожие книги рядом</h2>
              <button
                onClick={() => navigate('/')}
                className="text-[15px] font-semibold text-[#08642f]"
              >
                Смотреть все
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {similarBooks.length > 0 ? (
                similarBooks.map((item) => <SimilarBookCard key={item.id} item={item} />)
              ) : (
                <div className="w-full rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] p-5 text-[15px] text-[#667085]">
                  Похожие книги появятся, когда рядом будет больше объявлений.
                </div>
              )}
            </div>
          </section>
        </main>

        <button
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

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-[#667085]">{icon}</div>
    <div className="min-w-0">
      <p className="text-[14px] text-[#667085]">{label}</p>
      <p className="mt-1 truncate text-[16px] text-[#344054]">{value}</p>
    </div>
  </div>
);
