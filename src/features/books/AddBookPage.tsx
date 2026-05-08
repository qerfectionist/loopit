import { useState, useRef } from 'react';
import { compressImage } from '@/lib/compressImage';
import { isBarcodeDetectorSupported } from '@/lib/isbn';
import { ISBNScanner } from '@/components/ISBNScanner';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Plus, X, Loader2, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shell } from '@/components/layout';
import { Button, Input } from '@/components/ui';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { useAppStore } from '@/stores/appStore';
import { useCreateItem, useUploadImage } from '@/hooks/useItems';
import type { ItemCondition, ExchangeType } from '@/types';

const CONDITIONS: { value: ItemCondition; label: string; emoji: string }[] = [
  { value: 'new', label: 'New', emoji: '✨' },
  { value: 'like_new', label: 'Like New', emoji: '📗' },
  { value: 'good', label: 'Good', emoji: '📘' },
  { value: 'fair', label: 'Fair', emoji: '📙' },
];

const EXCHANGE_TYPES: { value: ExchangeType; label: string; desc: string }[] = [
  { value: 'exchange', label: 'Exchange Only', desc: 'Trade for another book' },
  { value: 'sell', label: 'Sell', desc: 'Set a price' },
  { value: 'both', label: 'Either', desc: 'Trade or sell' },
];

const MAX_IMAGES = 3;

export const AddBookPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<ItemCondition>('good');
  const [exchangeType, setExchangeType] = useState<ExchangeType>('exchange');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Image state
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

    // Generate previews immediately from originals (fast)
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Compress before storing — runs in background via WebWorker
    setUploadingImage(true);
    const compressed = await Promise.all(newFiles.map(compressImage));
    setUploadingImage(false);

    setImageFiles((prev) => [...prev, ...compressed]);

    // Reset input
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

    // 1. Upload images if any
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
        const msg = err instanceof Error ? err.message : 'Image upload failed';
        console.error('[AddBook] Image upload failed:', err);
        setUploadError(msg);
        triggerNotification('error');
        setUploadingImage(false);
        setLoading(false);
        return; // abort — don't create item with broken images
      }
      setUploadingImage(false);
    }

    // 2. Create item
    createItemMutation.mutate(
      {
        user_id: currentUser!.id,
        category: 'book',
        title: title.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        condition,
        exchange_type: exchangeType,
        price: (exchangeType === 'sell' || exchangeType === 'both') && price ? parseFloat(price) : undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
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
        }
      }
    );
  };

  const handleScanResult = (book: import('@/lib/isbn').BookInfo) => {
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description);
    setShowScanner(false);
    triggerNotification('success');
  };

  return (
    <Shell hideNav>
      {/* ISBN Scanner overlay */}
      {showScanner && (
        <ISBNScanner
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border">
        <button
          onClick={() => { triggerHaptic('light'); navigate(-1); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[18px] font-semibold">Add Book</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 py-5 space-y-5"
      >
        {/* Photo upload */}
        <div>
          <label className="text-[13px] font-medium text-text-secondary mb-2 block">
            Photos ({imageFiles.length}/{MAX_IMAGES})
          </label>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <AnimatePresence>
              {imagePreviews.map((preview, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative flex-shrink-0"
                >
                  <img
                    src={preview}
                    alt={`Preview ${i + 1}`}
                    className="w-20 h-20 rounded-xl object-cover border border-border"
                  />
                  <button
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center shadow-md"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {imageFiles.length < MAX_IMAGES && (
              <button
                onClick={handleAddImage}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-1 transition-colors flex-shrink-0"
              >
                <Camera size={20} className="text-text-muted" />
                <span className="text-[10px] text-text-muted">Add</span>
              </button>
            )}
          </div>
          {uploadError && (
            <p className="text-[12px] text-error mt-1">{uploadError}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[13px] font-medium text-text-secondary">Title</label>
            {canScan && (
              <button
                onClick={() => { triggerHaptic('light'); setShowScanner(true); }}
                className="flex items-center gap-1 text-accent text-[13px] font-medium"
              >
                <ScanLine size={14} />
                Scan ISBN
              </button>
            )}
          </div>
          <Input placeholder="Book title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <Input label="Author" placeholder="Author name" value={author} onChange={(e) => setAuthor(e.target.value)} />


        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-text-secondary">Description</label>
          <textarea
            placeholder="Tell others about this book..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-3 rounded-xl text-[15px] bg-bg-tertiary text-text-primary placeholder-text-muted border border-border focus:border-accent outline-none transition-colors resize-none"
          />
        </div>

        {/* Condition selector */}
        <div>
          <label className="text-[13px] font-medium text-text-secondary mb-2 block">Condition</label>
          <div className="grid grid-cols-4 gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => { triggerHaptic('light'); setCondition(c.value); }}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                  condition === c.value
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                <span className="text-[16px]">{c.emoji}</span>
                <span className="text-[11px] font-medium">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Exchange type */}
        <div>
          <label className="text-[13px] font-medium text-text-secondary mb-2 block">Exchange Type</label>
          <div className="space-y-2">
            {EXCHANGE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { triggerHaptic('light'); setExchangeType(t.value); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  exchangeType === t.value
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-bg-secondary hover:bg-bg-tertiary'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  exchangeType === t.value ? 'border-accent' : 'border-text-muted'
                }`}>
                  {exchangeType === t.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                </div>
                <div>
                  <p className="text-[14px] font-medium">{t.label}</p>
                  <p className="text-[12px] text-text-muted">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {(exchangeType === 'sell' || exchangeType === 'both') && (
          <Input label="Price" placeholder="0.00" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        )}

        {/* Submit */}
        <div className="pt-2 pb-8">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            loading={loading}
            disabled={!canSubmit}
            onClick={handleSubmit}
            icon={loading && uploadingImage ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          >
            {loading && uploadingImage ? 'Uploading photos...' : loading ? 'Adding...' : 'Add Book'}
          </Button>
        </div>
      </motion.div>
    </Shell>
  );
};
