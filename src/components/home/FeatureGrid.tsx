import { FEATURE_CARDS } from "../../data/homeData";

type Props = { onNewChat: () => void };

export function FeatureGrid({ onNewChat }: Props) {
  return (
    <div className="home-feature-grid">
      {FEATURE_CARDS.map(card => (
        <button key={card.label} className="home-feature-card" onClick={onNewChat}>
          <span className="home-feature-icon">{card.icon}</span>
          <span className="home-feature-label">{card.label}</span>
          <span className="home-feature-sub">{card.sub}</span>
        </button>
      ))}
    </div>
  );
}
