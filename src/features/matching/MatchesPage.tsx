import { motion } from 'framer-motion';
import { Repeat2, Check, X, ChevronRight, Sparkles } from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Card, Avatar, Badge, Button } from '@/components/ui';
import { triggerHaptic, triggerNotification } from '@/lib/telegram';
import { useNavigate } from 'react-router-dom';
import { useMatches, useAcceptMatch, useDeclineMatch } from '@/hooks/useMatches';
import { useAppStore } from '@/stores/appStore';
import type { Match } from '@/types';


const MatchCard = ({ match, index }: { match: Match; index: number }) => {
  const navigate = useNavigate();
  const acceptMatch = useAcceptMatch();
  const declineMatch = useDeclineMatch();

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card
        className="relative overflow-hidden cursor-default active:scale-100"
        padding={false}
      >
        {/* Match score glow */}
        {match.score >= 90 && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-12 translate-x-12 blur-2xl pointer-events-none" />
        )}

        <div className="p-4">
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
                  <span className="font-medium text-accent">{match.score}% Match</span>
                  <span className="mx-1">·</span>
                  <span>★ {match.partner?.rating?.toFixed(1) || '5.0'}</span>
                </div>
              </div>
            </div>
            
            {match.status !== 'pending' && match.conversation_id && (
              <button 
                className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                onClick={() => {
                  triggerHaptic('light');
                  navigate(`/chat/${match.conversation_id}`);
                }}
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {/* Exchange visualization */}
          <div className="bg-bg-tertiary rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0 bg-bg-secondary rounded-lg p-2.5 border border-border/50">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-semibold">You Give</p>
                <p className="text-[13px] font-medium truncate">{match.offered_item?.title || 'Your Item'}</p>
              </div>
              <div className="flex-shrink-0 text-text-muted/40">
                <Repeat2 size={16} />
              </div>
              <div className="flex-1 min-w-0 bg-accent/5 rounded-lg p-2.5 border border-accent/10">
                <p className="text-[10px] text-accent uppercase tracking-wider mb-1 font-semibold">You Get</p>
                <p className="text-[13px] font-medium truncate text-accent">{match.wanted_item?.title || 'Their Item'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {match.status === 'pending' && (
          <div className="px-4 pb-4 flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={declineMatch.isPending}
              onClick={() => {
                triggerHaptic('medium');
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
      </Card>
    </motion.div>
  );
};

export const MatchesPage = () => {
  const currentUser = useAppStore(s => s.currentUser);
  const navigate = useNavigate();
  const { data: matches, isLoading } = useMatches(currentUser?.id);

  const displayMatches = matches || [];

  return (
    <Shell>
      <PageHeader
        title="Matches"
        subtitle={isLoading ? 'Loading matches...' : `${displayMatches.length} potential exchanges`}
      />

      <div className="px-5 pb-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          displayMatches.map((match, index) => (
            <MatchCard key={match.id} match={match} index={index} />
          ))
        )}

        {!isLoading && displayMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-accent-soft rounded-2xl flex items-center justify-center mb-4">
              <Repeat2 size={28} className="text-accent" />
            </div>
            <p className="text-[16px] font-medium mb-1">No matches yet</p>
            <p className="text-[13px] text-text-secondary max-w-[240px]">
              Add more books and wishlists to increase your chances of finding a match
            </p>
            <Button variant="primary" size="md" className="mt-4" onClick={() => navigate('/add-book')}>
              Add Books
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
};
