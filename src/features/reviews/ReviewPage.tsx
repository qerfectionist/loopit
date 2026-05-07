import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Loader2 } from 'lucide-react';
import { Shell } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { useAppStore } from '@/stores/appStore';
import { useExchange } from '@/hooks/useExchanges';
import { useSubmitReview, useHasReviewed } from '@/hooks/useReviews';
import { triggerHaptic } from '@/lib/telegram';

export const ReviewPage = () => {
  const { id: exchangeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { data: exchange, isLoading } = useExchange(exchangeId);
  const { data: alreadyReviewed } = useHasReviewed(exchangeId, currentUser?.id);
  const submitReview = useSubmitReview();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  const reviewedId = exchange
    ? exchange.initiator_id === currentUser?.id
      ? exchange.responder_id
      : exchange.initiator_id
    : null;

  const handleSubmit = () => {
    if (!exchangeId || !currentUser?.id || !reviewedId || rating === 0) return;
    triggerHaptic('success');

    submitReview.mutate(
      {
        exchange_id: exchangeId,
        reviewer_id: currentUser.id,
        reviewed_id: reviewedId,
        rating,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          navigate(-1);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Shell hideNav>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </Shell>
    );
  }

  if (alreadyReviewed) {
    return (
      <Shell hideNav>
        <div className="flex flex-col items-center justify-center h-screen px-5 text-center">
          <Star size={48} className="text-warning mb-4" />
          <h2 className="text-[18px] font-bold mb-2">Already Reviewed</h2>
          <p className="text-[14px] text-text-secondary mb-6">
            You&apos;ve already submitted a review for this exchange.
          </p>
          <Button variant="primary" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell hideNav>
      <div className="flex flex-col min-h-dvh">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-bg-primary/80 backdrop-blur-lg z-20">
          <button
            onClick={() => { triggerHaptic('light'); navigate(-1); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-tertiary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[17px] font-semibold">Leave a Review</h1>
        </div>

        <div className="flex-1 px-5 py-6 space-y-6">
          {/* Star Rating */}
          <Card className="p-6 text-center">
            <h2 className="text-[16px] font-semibold mb-2">How was the exchange?</h2>
            <p className="text-[13px] text-text-secondary mb-5">
              Rate your experience with this exchange
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  whileTap={{ scale: 0.85 }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => {
                    triggerHaptic('light');
                    setRating(star);
                  }}
                  className="p-1"
                >
                  <Star
                    size={36}
                    className={`transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'text-warning fill-warning'
                        : 'text-text-muted'
                    }`}
                  />
                </motion.button>
              ))}
            </div>
            {rating > 0 && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[13px] text-text-secondary mt-3"
              >
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Great'}
                {rating === 5 && 'Excellent!'}
              </motion.p>
            )}
          </Card>

          {/* Comment */}
          <div>
            <label className="text-[14px] font-medium mb-2 block">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl text-[14px] bg-bg-tertiary text-text-primary placeholder-text-muted border border-border focus:border-accent outline-none transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <Button
            variant="primary"
            className="w-full"
            icon={<Star size={18} />}
            disabled={rating === 0 || submitReview.isPending}
            onClick={handleSubmit}
          >
            {submitReview.isPending ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </div>
    </Shell>
  );
};
