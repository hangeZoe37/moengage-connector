import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import {
  OverviewPage,
  MessagesPage,
  MessageDetailPage,
  ClientsPage,
  DlrEventsPage,
  SettingsPage,
  LoginPage,
  ConnectorSelectionPage,
  ChannelSelectionPage,
  WabaDashboardPage,
} from './pages';
import { getToken } from './api';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  return getToken() ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/connectors" element={<PrivateRoute><ConnectorSelectionPage /></PrivateRoute>} />
      <Route path="/channels" element={<PrivateRoute><ChannelSelectionPage /></PrivateRoute>} />
      <Route path="/waba" element={<PrivateRoute><WabaDashboardPage /></PrivateRoute>} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<MessageDetailPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/dlr-events" element={<DlrEventsPage />} />
      </Route>
    </Routes>
  );
}
