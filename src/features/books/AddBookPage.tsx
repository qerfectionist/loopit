import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  DollarSign,
  Loader2,
  Plus,
  Repeat2,
  ScanLine,
  X,
} from 'lucide-react';
import { compressImage } from '@/lib/compressImage';
import { isBarcodeDetectorSupported } from '@/lib/isbn';
import { ISBNScanner } from '@/components/ISBNScanner';
import { Shell } from '@/components/layout';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { useAppStore } from '@/stores/appStore';
import { useCreateItem, useUploadImage } from '@/hooks/useItems';
import type { ExchangeType, ItemCondition } from '@/types';

const CONDITIONS: { value: ItemCondition; label: string; accent: string }[] = [
  { value: 'new', label: 'Новое', accent: 'bg-emerald-500' },
  { value: 'like_new', label: 'Как новое', accent: 'bg-lime-500' },
  { value: 'good', label: 'Хорошее', accent: 'bg-sky-500' },
  { value: 'fair', label: 'Нормальное', accent: 'bg-orange-500' },
];

const EXCHANGE_TYPES: {
  value: ExchangeType;
  label: string;
  desc: string;
  icon: typeof Repeat2;
}[] = [
  {
    value: 'exchange',
    label: 'Только обмен',
    desc: 'Обменять на другую книгу',
    icon: Repeat2,
  },
  {
    value: 'sell',
    label: 'Продажа',
    desc: 'Указать цену',
    icon: DollarSign,
  },
  {
    value: 'both',
    label: 'Обмен или продажа',
    desc: 'Подходит оба варианта',
    icon: BookOpen,
  },
];

const GENRES = [
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
] as const;

export type BookGenre = (typeof GENRES)[number]['value'];

const MAX_IMAGES = 3;
const fieldClass =
  'w-full rounded-[22px] border border-[#e4e7ec] bg-[#f8fafc] px-4 text-[16px] text-[#101828] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[#0b6b31] focus:bg-white';

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-2 block text-[14px] font-semibold text-[#667085]">{children}</label>
);

export const AddBookPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<ItemCondition>('good');
  const [exchangeType, setExchangeType] = useState<ExchangeType>('exchange');
  const [price, setPrice] = useState('');
  const [genre, setGenre] = useState<BookGenre | ''>('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isbn, setIsbn] = useState('');

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const currentUser = useAppStore((s) => s.currentUser);
  const createItemMutation = useCreateItem();
  const uploadImage = useUploadImage();
  const [showScanner, setShowScanner] = useState(false);
  const canScan = isBarcodeDetectorSupported();

  const canSubmit = title.trim().length > 0 && !!currentUser && !uploadingImage;

  const handleAddImage = () => {
    if (imageFiles.length >= MAX_IMAGES) return;
    triggerHaptic('light');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const newFiles = files.slice(0, remaining);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    setUploadingImage(true);
    const compressed = await Promise.all(newFiles.map(compressImage));
    setUploadingImage(false);

    setImageFiles((prev) => [...prev, ...compressed]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    triggerHaptic('light');
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    triggerHaptic('medium');

    let imageUrls: string[] = [];
    if (imageFiles.length > 0) {
      setUploadingImage(true);
      const uploadPromises = imageFiles.map((file) =>
        uploadImage.mutateAsync({ userId: currentUser!.id, file })
      );

      try {
        imageUrls = await Promise.all(uploadPromises);
        setUploadError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Не удалось загрузить фото';
        console.error('[AddBook] Image upload failed:', err);
        setUploadError(msg);
        triggerNotification('error');
        setUploadingImage(false);
        setLoading(false);
        return;
      }
      setUploadingImage(false);
    }

    createItemMutation.mutate(
      {
        user_id: currentUser!.id,
        category: 'book',
        title: title.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        isbn: isbn || undefined,
        condition,
        exchange_type: exchangeType,
        price:
          (exchangeType === 'sell' || exchangeType === 'both') && price
            ? parseFloat(price)
            : undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        metadata: genre ? { genre } : undefined,
      },
      {
        onSuccess: () => {
          triggerNotification('success');
          setLoading(false);
          navigate(-1);
        },
        onError: () => {
          triggerNotification('error');
          setLoading(false);
        },
      }
    );
  };

  const handleScanResult = (book: import('@/lib/isbn').BookInfo) => {
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description);
    setIsbn(book.isbn);
    setShowScanner(false);
    triggerNotification('success');
  };

  return (
    <Shell hideNav className="bg-white text-[#101828]">
      {showScanner && (
        <ISBNScanner
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="mx-auto min-h-[var(--loopit-viewport-stable-height)] w-full max-w-[480px] bg-white">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#f2f4f7] bg-white/95 px-5 py-3 backdrop-blur">
          <button
            aria-label="Назад"
            onClick={() => {
              triggerHaptic('light');
              navigate(-1);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#101828] transition-colors hover:bg-[#f2f4f7]"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-[19px] font-bold leading-tight">Добавить книгу</h1>
            <p className="text-[13px] text-[#667085]">Заполните карточку для обмена</p>
          </div>
        </header>

        <main className="space-y-6 px-5 pb-36 pt-5">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <FieldLabel>Фото книги</FieldLabel>
                <p className="text-[13px] text-[#98a2b3]">
                  До {MAX_IMAGES} фото, лучше обложку крупно
                </p>
              </div>
              <span className="text-[13px] font-semibold text-[#667085]">
                {imageFiles.length}/{MAX_IMAGES}
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {imagePreviews.map((preview, i) => (
                <div key={`${preview}-${i}`} className="relative shrink-0">
                  <img
                    src={preview}
                    alt={`Фото книги ${i + 1}`}
                    className="h-24 w-24 rounded-[20px] border border-[#e4e7ec] object-cover"
                  />
                  <button
                    aria-label="Удалить фото"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] text-white shadow-lg"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}

              {imageFiles.length < MAX_IMAGES && (
                <button
                  onClick={handleAddImage}
                  className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[#101828] bg-white text-[#344054] transition-colors hover:bg-[#f8fafc]"
                >
                  <Camera size={23} />
                  <span className="text-[13px] font-semibold">Добавить</span>
                </button>
              )}
            </div>

            {uploadError && (
              <p className="mt-2 text-[13px] font-medium text-[#b42318]">{uploadError}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </section>

          <section className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <FieldLabel>Название</FieldLabel>
                {canScan && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setShowScanner(true);
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-[#d0d5dd] px-3 py-1.5 text-[13px] font-semibold text-[#0b6b31]"
                  >
                    <ScanLine size={15} />
                    ISBN
                  </button>
                )}
              </div>
              <input
                placeholder="Название книги"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${fieldClass} h-14`}
              />
            </div>

            <div>
              <FieldLabel>Автор</FieldLabel>
              <input
                placeholder="Имя автора"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className={`${fieldClass} h-14`}
              />
            </div>

            <div>
              <FieldLabel>Описание</FieldLabel>
              <textarea
                placeholder="Расскажите о книге, состоянии и заметках"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={`${fieldClass} min-h-[116px] resize-none py-4`}
              />
            </div>
          </section>

          <section>
            <FieldLabel>
              Жанр <span className="font-medium text-[#98a2b3]">(необязательно)</span>
            </FieldLabel>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {GENRES.map((g) => {
                const selected = genre === g.value;
                return (
                  <button
                    key={g.value}
                    onClick={() => {
                      triggerHaptic('light');
                      setGenre(selected ? '' : g.value);
                    }}
                    className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
                      selected
                        ? 'border-[#0b6b31] bg-[#eaf6ee] text-[#0b6b31]'
                        : 'border-[#e4e7ec] bg-white text-[#475467]'
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FieldLabel>Состояние</FieldLabel>
            <div className="grid grid-cols-4 gap-2">
              {CONDITIONS.map((c) => {
                const selected = condition === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => {
                      triggerHaptic('light');
                      setCondition(c.value);
                    }}
                    className={`flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-[20px] border px-2 text-center transition-colors ${
                      selected
                        ? 'border-[#0b6b31] bg-[#eaf6ee] text-[#0b6b31]'
                        : 'border-[#e4e7ec] bg-white text-[#475467]'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-[4px] ${c.accent}`} />
                    <span className="text-[12px] font-bold leading-tight">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FieldLabel>Тип объявления</FieldLabel>
            <div className="space-y-3">
              {EXCHANGE_TYPES.map((type) => {
                const selected = exchangeType === type.value;
                const Icon = type.icon;

                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      triggerHaptic('light');
                      setExchangeType(type.value);
                    }}
                    className={`flex w-full items-center gap-3 rounded-[22px] border p-4 text-left transition-colors ${
                      selected
                        ? 'border-[#0b6b31] bg-[#eaf6ee]'
                        : 'border-[#e4e7ec] bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        selected ? 'bg-[#0b6b31] text-white' : 'bg-[#f2f4f7] text-[#667085]'
                      }`}
                    >
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold text-[#101828]">
                        {type.label}
                      </span>
                      <span className="block text-[14px] text-[#667085]">{type.desc}</span>
                    </span>
                    {selected && <Check size={20} className="text-[#0b6b31]" />}
                  </button>
                );
              })}
            </div>
          </section>

          {(exchangeType === 'sell' || exchangeType === 'both') && (
            <section>
              <FieldLabel>Цена</FieldLabel>
              <input
                placeholder="0"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`${fieldClass} h-14`}
              />
            </section>
          )}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#f2f4f7] bg-white/95 backdrop-blur">
          <div className="mx-auto w-full max-w-[480px] px-5 pb-[calc(var(--loopit-safe-bottom)+16px)] pt-3">
            <button
              disabled={!canSubmit || loading}
              onClick={handleSubmit}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-[#0b6b31] text-[17px] font-bold text-white shadow-[0_12px_30px_rgba(11,107,49,0.22)] transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
            >
              {loading || uploadingImage ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Plus size={21} />
              )}
              {uploadingImage
                ? 'Загружаю фото...'
                : loading
                  ? 'Добавляю...'
                  : 'Добавить книгу'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
};
