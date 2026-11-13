import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout.jsx';
import PublicLayout from '../layouts/PublicLayout.jsx';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx';
import AdminContentPage from '../pages/admin/AdminContentPage.jsx';
import AdminLoginPage from '../pages/admin/AdminLoginPage.jsx';
import BusinessAreaServicesManager from '../pages/admin/BusinessAreaServicesManager.jsx';
import { RedirectAuthenticatedAdmin, RequireAdmin } from './AdminRouteGuards.jsx';
import AboutPage from '../pages/public/AboutPage.jsx';
import AcademicPage from '../pages/public/AcademicPage.jsx';
import AcademicCoursePage from '../pages/public/AcademicCoursePage.jsx';
import BlogPage from '../pages/public/BlogPage.jsx';
import ContactPage from '../pages/public/ContactPage.jsx';
import DataAiPage from '../pages/public/DataAiPage.jsx';
import HomePage from '../pages/public/HomePage.jsx';
import PortfolioPage from '../pages/public/PortfolioPage.jsx';
import TechSolutionsPage from '../pages/public/TechSolutionsPage.jsx';
import TeamPage from '../pages/public/TeamPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import PublicContentDetailPage from '../pages/public/PublicContentDetailPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/academic" element={<AcademicPage />} />
        <Route path="/academic/courses/:slug" element={<AcademicCoursePage />} />
        <Route path="/academic/:slug" element={<PublicContentDetailPage type="course" />} />
        <Route path="/tech-solutions" element={<TechSolutionsPage />} />
        <Route path="/data-ai" element={<DataAiPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/portfolio/:slug" element={<PublicContentDetailPage type="project" />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<PublicContentDetailPage type="article" />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route element={<RedirectAuthenticatedAdmin />}>
          <Route path="login" element={<AdminLoginPage />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="company-profile" element={<AdminContentPage resource="company-profile" />} />
          <Route path="settings" element={<section><h1>Settings</h1><p>Settings are not available yet.</p></section>} />
          <Route path="academic" element={<BusinessAreaServicesManager area="academic" />} />
          <Route path="tech-solutions" element={<BusinessAreaServicesManager area="tech-solutions" />} />
          <Route path="data-ai" element={<BusinessAreaServicesManager area="data-ai" />} />
          <Route path="manage/services" element={<Navigate to="/admin/tech-solutions" replace />} />
          <Route path="manage/service-categories" element={<Navigate to="/admin/tech-solutions" replace />} />
          <Route path="manage/:resource" element={<AdminContentPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
