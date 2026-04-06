import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import {
  OverviewPage,
  MessagesPage,
  MessageDetailPage,
  ClientsPage,
  DlrEventsPage,
  SettingsPage,
} from './pages';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<MessageDetailPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/dlr-events" element={<DlrEventsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
