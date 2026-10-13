import { SkillsListView } from "./_components/SkillsListView";

/* Route: /skills (Skills list + "select a skill" hint pane). Thin route entry —
   the view, its modals, styles and helpers live under _components/. */
export default function SkillsPage() {
  return <SkillsListView />;
}
