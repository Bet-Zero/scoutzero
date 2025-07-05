import { Routes, Route, Navigate } from 'react-router-dom';
import PlayerTableView from '@/pages/PlayerTableView';
import PlayerProfileView from '@/pages/PlayerProfileView';
import TeamRosterView from '@/pages/TeamRosterView';
import RosterExportView from '@/pages/RosterExportView';
import ListManager from '@/pages/ListManager';
import ListsHome from '@/pages/ListsHome';
import TierMakerView from '@/pages/TierMakerView';
import TierListsHome from '@/pages/TierListsHome';
import RostersHome from '@/pages/RostersHome';
import SiteLayout from '@/components/layout/SiteLayout';
import NotFound from '@/pages/NotFound';
import ListPresentationView from '@/pages/ListPresentationView';

const App = () => {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Navigate to="/players" replace />} />
        <Route path="/players" element={<PlayerTableView />} />
        <Route path="/profiles" element={<PlayerProfileView />} />
        <Route path="/roster/:rosterId?" element={<TeamRosterView />} />
        <Route path="/roster-export/:rosterId" element={<RosterExportView />} />
        <Route path="/rosters" element={<RostersHome />} />
        <Route path="/lists" element={<ListsHome />} />
        <Route path="/lists/:listId" element={<ListManager />} />
        <Route path="/list-presentation" element={<ListPresentationView />} />
        <Route path="/tier-lists" element={<TierListsHome />} />
        <Route path="/tier-maker" element={<TierMakerView />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
