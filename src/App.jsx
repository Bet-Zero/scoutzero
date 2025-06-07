import { Routes, Route } from 'react-router-dom';
import PlayerTableView from '@/pages/PlayerTableView';
import PlayerProfileView from '@/pages/PlayerProfileView';
import TeamRosterViewer from '@/pages/TeamRosterView';
import RankedListView from '@/pages/RankedListView';
import ListsHome from '@/pages/ListsHome';

const App = () => {
  return (
    <Routes>
      <Route path="/players" element={<PlayerTableView />} />
      <Route path="/profiles" element={<PlayerProfileView />} />
      <Route path="/roster" element={<TeamRosterViewer />} />
      <Route path="/lists/:listId" element={<RankedListView />} />
      <Route path="*" element={<PlayerTableView />} />
      <Route path="/lists" element={<ListsHome />} />
    </Routes>
  );
};

export default App;
