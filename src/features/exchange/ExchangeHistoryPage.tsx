import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Repeat2, CheckCircle2, Clock, XCircle, Loader2, Star } from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Card } from '@/components/ui';
import { useAppStore } from '@/stores/appStore';
import { useExchanges } from '@/hooks/useExchanges';
import { formatRelativeTime } from '@/lib/utils';
import { triggerHaptic } from '@/lib/telegram';
import type { ExchangeStatus } from '@/types';

const statusConfig: Record<ExchangeStatus, { label: string; color: string; icon: typeof Clock }> = {
  proposed: { label: 'Proposed', color: 'text-warning', icon: Clock },
  accepted: { label: 'Accepted', color: 'text-accent', icon: CheckCircle2 },
  completed: { label: 'Completed', color: 'text-success', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-error', icon: XCircle },
};

export const ExchangeHistoryPage = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { data: exchanges = [], isLoading } = useExchanges(currentUser?.id);

  return (
    <Shell hideNav>
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 p-2 -ml-2 text-text-primary z-20"
      >
        <ArrowLeft size={24} />
      </button>
      <PageHeader title="Exchange History" />

      <div className="px-5 pb-6 pt-16">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : exchanges.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
              <Repeat2 size={28} className="text-text-muted" />
            </div>
            <h3 className="text-[16px] font-semibold mb-1">No exchanges yet</h3>
            <p className="text-[14px] text-text-secondary max-w-[240px]">
              Match with someone and propose an exchange to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {exchanges.map((exchange, i) => {
              const config = statusConfig[exchange.status];
              const StatusIcon = config.icon;
              const isInitiator = exchange.initiator_id === currentUser?.id;

              return (
                <motion.div
                  key={exchange.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="p-4 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => {
                      triggerHaptic('light');
                      navigate(`/exchange/${exchange.id}`);
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon size={16} className={config.color} />
                        <span className={`text-[13px] font-semibold ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-text-muted">
                        {formatRelativeTime(exchange.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-center">
                        <p className="text-[11px] text-text-muted mb-1">
                          {isInitiator ? 'You give' : 'You receive'}
                        </p>
                        <div className="w-12 h-14 mx-auto rounded-md bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                          <Repeat2 size={18} className="text-accent" />
                        </div>
                      </div>
                      <Repeat2 size={16} className="text-text-muted flex-shrink-0" />
                      <div className="flex-1 text-center">
                        <p className="text-[11px] text-text-muted mb-1">
                          {isInitiator ? 'You receive' : 'You give'}
                        </p>
                        <div className="w-12 h-14 mx-auto rounded-md bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                          <Repeat2 size={18} className="text-success" />
                        </div>
                      </div>
                    </div>

                    {exchange.status === 'completed' && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-1.5 text-[12px] text-accent">
                        <Star size={12} />
                        <span>Leave a review</span>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
};
