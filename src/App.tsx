import { ChatCard } from "./components/ChatCard";
import type { BotPanel } from "./lib/providers/types";

type Props = {
  bots: BotPanel[];
  onUpdate: (id: number, updates: Partial<BotPanel>) => void;
  onAsk: (id: number) => void;
  onFocus: (id: number) => void;
  onDelete: (id: number) => void;
  onPopOut: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onSummarise: (id: number) => void;
  onSlice: (id: number) => void;
  onRunAsAgent: (id: number) => void;
};

export default function App({ bots, onUpdate, onAsk, onFocus, onDelete, onPopOut, onRename, onSummarise, onSlice, onRunAsAgent }: Props) {
  return (
    <>
      {bots.map(bot => (
        <ChatCard
          key={bot.id}
          bot={bot}
          onUpdate={updates => onUpdate(bot.id, updates)}
          onAsk={() => onAsk(bot.id)}
          onFocus={() => onFocus(bot.id)}
          onDelete={() => onDelete(bot.id)}
          onPopOut={() => onPopOut(bot.id)}
          onRename={newTitle => onRename(bot.id, newTitle)}
          onSummarise={() => onSummarise(bot.id)}
          onSlice={() => onSlice(bot.id)}
          onRunAsAgent={() => onRunAsAgent(bot.id)}
        />
      ))}
    </>
  );
}
