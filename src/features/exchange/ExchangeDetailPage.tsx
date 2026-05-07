import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, XCircle, Repeat2, MapPin, Calendar, Loader2, Star } from 'lucide-react';
import { Shell } from '@/components/layout';
import { Card, Button, Badge } from '@/components/ui';
import { useAppStore } from '@/stores/appStore';
import { useExchange, useAcceptExchange, useConfirmExchange, useCancelExchange } from '@/hooks/useExchanges';
import { useHasReviewed } from '@/hooks/useReviews';
import { triggerHaptic, showConfirm } from '@/lib/telegram';
import { formatRelativeTime } from '@/lib/utils';

export const ExchangeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { data: exchange, isLoading } = useExchange(id);
  const acceptExchange = useAcceptExchange();
  const confirmExchange = useConfirmExchange();
  const cancelExchange = useCancelExchange();
  const { data: alreadyReviewed } = useHasReviewed(id, currentUser?.id);

  if (isLoading || !exchange) {
    return (
      <Shell hideNav>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </Shell>
    );
  }

  const isInitiator = exchange.initiator_id === currentUser?.id;
  const myConfirmed = isInitiator ? exchange.initiator_confirmed : exchange.responder_confirmed;
  const partnerConfirmed = isInitiator ? exchange.responder_confirmed : exchange.initiator_confirmed;

  const handleAccept = () => {
    triggerHaptic('light');
    acceptExchange.mutate(exchange.id);
  };

  const handleConfirm = () => {
    if (!currentUser) return;
    triggerHaptic('light');
    confirmExchange.mutate({ exchangeId: exchange.id, userId: currentUser.id });
  };

  const handleCancel = () => {
    triggerHaptic('medium');
    showConfirm('Cancel this exchange?').then((confirmed) => {
      if (confirmed) {
        cancelExchange.mutate(exchange.id);
      }
    });
  };

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
          <h1 className="text-[17px] font-semibold">Exchange Details</h1>
        </div>

        <div className="flex-1 px-5 py-6 space-y-4">
          {/* Status */}
          <Card className="p-5 text-center">
            {exchange.status === 'proposed' && (
              <>
                <Clock size={40} className="text-warning mx-auto mb-3" />
                <h2 className="text-[18px] font-bold mb-1">Exchange Proposed</h2>
                <p className="text-[13px] text-text-secondary">
                  {isInitiator
                    ? 'Waiting for the other person to accept'
                    : 'Someone wants to exchange with you!'}
                </p>
              </>
            )}
            {exchange.status === 'accepted' && (
              <>
                <Repeat2 size={40} className="text-accent mx-auto mb-3" />
                <h2 className="text-[18px] font-bold mb-1">Exchange Accepted</h2>
                <p className="text-[13px] text-text-secondary">
                  Meet up and confirm when the exchange is done
                </p>
              </>
            )}
            {exchange.status === 'completed' && (
              <>
                <CheckCircle2 size={40} className="text-success mx-auto mb-3" />
                <h2 className="text-[18px] font-bold mb-1">Exchange Completed!</h2>
                <p className="text-[13px] text-text-secondary">
                  {exchange.completed_at
                    ? `Completed ${formatRelativeTime(exchange.completed_at)}`
                    : 'Both parties confirmed'}
                </p>
              </>
            )}
            {exchange.status === 'cancelled' && (
              <>
                <XCircle size={40} className="text-error mx-auto mb-3" />
                <h2 className="text-[18px] font-bold mb-1">Exchange Cancelled</h2>
                <p className="text-[13px] text-text-secondary">This exchange was cancelled</p>
              </>
            )}
          </Card>

          {/* Confirmation status */}
          {exchange.status === 'accepted' && (
            <Card className="p-4">
              <h3 className="text-[14px] font-semibold mb-3">Confirmation</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text-secondary">You</span>
                  <Badge variant={myConfirmed ? 'success' : 'default'} size="sm">
                    {myConfirmed ? '✓ Confirmed' : 'Not yet'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text-secondary">Partner</span>
                  <Badge variant={partnerConfirmed ? 'success' : 'default'} size="sm">
                    {partnerConfirmed ? '✓ Confirmed' : 'Not yet'}
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {/* Meetup info */}
          {(exchange.meetup_location || exchange.meetup_time) && (
            <Card className="p-4">
              <h3 className="text-[14px] font-semibold mb-3">Meetup Details</h3>
              {exchange.meetup_location && (
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={14} className="text-accent" />
                  <span className="text-[13px]">{exchange.meetup_location.city}</span>
                </div>
              )}
              {exchange.meetup_time && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-accent" />
                  <span className="text-[13px]">
                    {new Date(exchange.meetup_time).toLocaleDateString('en', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {/* Responder can accept proposed exchange */}
            {exchange.status === 'proposed' && !isInitiator && (
              <Button
                variant="primary"
                className="w-full"
                icon={<CheckCircle2 size={18} />}
                onClick={handleAccept}
              >
                Accept Exchange
              </Button>
            )}

            {/* Both can confirm when accepted */}
            {exchange.status === 'accepted' && !myConfirmed && (
              <Button
                variant="primary"
                className="w-full"
                icon={<CheckCircle2 size={18} />}
                onClick={handleConfirm}
              >
                Confirm Exchange Done
              </Button>
            )}

            {/* Review button after completion */}
            {exchange.status === 'completed' && !alreadyReviewed && (
              <Button
                variant="primary"
                className="w-full"
                icon={<Star size={18} />}
                onClick={() => {
                  triggerHaptic('light');
                  navigate(`/review/${exchange.id}`);
                }}
              >
                Leave a Review
              </Button>
            )}

            {exchange.status === 'completed' && alreadyReviewed && (
              <div className="text-center py-2">
                <p className="text-[13px] text-success flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} /> Review submitted
                </p>
              </div>
            )}

            {/* Cancel (for proposed/accepted) */}
            {(exchange.status === 'proposed' || exchange.status === 'accepted') && (
              <Button
                variant="ghost"
                className="w-full text-error"
                onClick={handleCancel}
              >
                Cancel Exchange
              </Button>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
};
