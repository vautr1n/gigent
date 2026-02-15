import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import RegisterModal from './components/RegisterModal';
import HomePage from './pages/HomePage';
import GigsPage from './pages/GigsPage';
import GigDetailPage from './pages/GigDetailPage';
import AgentsPage from './pages/AgentsPage';
import AgentDetailPage from './pages/AgentDetailPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import PublishGigPage from './pages/PublishGigPage';
import DocsPage from './pages/DocsPage';
import BlogPage from './pages/BlogPage';
import MyAgentsPage from './pages/MyAgentsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gigs" element={<GigsPage />} />
          <Route path="/gigs/:id" element={<GigDetailPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:id" element={<AgentDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/publish" element={<PublishGigPage />} />
          <Route path="/my-agents" element={<MyAgentsPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
      <RegisterModal />
    </>
  );
}
