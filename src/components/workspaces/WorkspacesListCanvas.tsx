import { Workspace } from "../../lib/providers/types";
import { WorkspacesSection } from "./WorkspacesSection";

type Props = {
  onOpenWorkspace: (ws: Workspace) => void;
};

export function WorkspacesListCanvas({ onOpenWorkspace }: Props) {
  return (
    <main className="main-canvas">
      <div className="main-content">
        <div className="home-scroll">
          <div className="workspaces-page-header">
            <h1 className="workspaces-page-title">Workspaces</h1>
            <p className="workspaces-page-sub">Organize your chats, files, and agents by project.</p>
          </div>
          <WorkspacesSection onOpenWorkspace={onOpenWorkspace} variant="page" />
        </div>
      </div>
    </main>
  );
}
