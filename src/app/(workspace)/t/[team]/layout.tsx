import { NotAvailable } from "@/components/ui/layout";
import { findTeam, requireViewer } from "@/server/auth/viewer";

/**
 * Team routes resolve the slug against the viewer's authorized teams only.
 * Unknown and private teams produce the same response, so a URL can't be used
 * to discover that a team exists.
 */
export default async function TeamLayout({ children, params }: LayoutProps<"/t/[team]">) {
  const { team: slug } = await params;
  const viewer = await requireViewer();
  if (!findTeam(viewer, slug)) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <NotAvailable />
      </div>
    );
  }
  return children;
}
