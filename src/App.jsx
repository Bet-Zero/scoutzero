import { Routes, Route, Navigate } from 'react-router-dom';
import PlayerTableView from '@/pages/PlayerTableView';
import PlayerProfileView from '@/pages/PlayerProfileView';
import TeamRosterViewer from '@/pages/TeamRosterView';
import RankedListView from '@/pages/RankedListView';
import ListsHome from '@/pages/ListsHome';
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
        <Route path="/roster" element={<TeamRosterViewer />} />
        <Route path="/lists" element={<ListsHome />} />
        <Route path="/lists/:listId" element={<RankedListView />} />
        <Route path="/list-presentation" element={<ListPresentationView />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
