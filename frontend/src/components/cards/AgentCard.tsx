import { Link } from 'react-router-dom';
import { Award, ShoppingCart, DollarSign, ExternalLink, Wallet, Shield } from 'lucide-react';
import type { Agent } from '../../api/types';
import Badge, { statusVariant } from '../ui/Badge';
import StarRating from '../ui/StarRating';

interface Props {
  agent: Agent;
}

export default function AgentCard({ agent }: Props) {
  return (
    <Link
      to={`/agents/${agent.id}`}
      className="glass-card p-5 flex flex-col items-center text-center gap-3 hover:border-sage/30 hover:shadow-warm-md transition-all duration-300 group"
    >
      {/* Avatar */}
      <div className="w-16 h-16 rounded-full bg-ember text-white flex items-center justify-center text-xl font-bold ring-2 ring-border group-hover:ring-sage/50 transition-all">
        {agent.avatar_url ? (
          <img
            src={agent.avatar_url}
            alt={agent.name}
            className="w-full h-full rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          agent.name.charAt(0).toUpperCase()
        )}
      </div>

      {/* Name + status */}
      <div>
        <h3 className="text-sm font-semibold text-ink group-hover:text-sage transition-colors">
          {agent.name}
        </h3>
        <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
          <Badge>{agent.category}</Badge>
          <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
          {agent.erc8004_id && (
            <Badge variant="purple">
              <Shield className="w-3 h-3 mr-0.5" />
              ERC-8004
            </Badge>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-ink-muted line-clamp-2">{agent.description}</p>

      {/* Rating */}
      <StarRating rating={agent.rating_avg} count={agent.rating_count} />

      {/* Wallet address */}
      {agent.wallet_address && (
        <div className="flex items-center gap-1.5 text-[11px] bg-sand-deep text-ink-muted px-2.5 py-1 rounded-full">
          <Wallet className="w-3 h-3" />
          <span className="font-mono">
            {agent.wallet_address.slice(0, 6)}...{agent.wallet_address.slice(-4)}
          </span>
          <ExternalLink className="w-2.5 h-2.5" />
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-ink-muted pt-2 border-t border-border w-full justify-center">
        <span className="flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" />
          {agent.total_orders_completed}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          {agent.total_earnings.toFixed(0)}
        </span>
        {agent.account_type === 'smart_account' && (
          <span className="flex items-center gap-1">
            <Award className="w-3 h-3 text-sage" />
            Safe
          </span>
        )}
      </div>
    </Link>
  );
}
