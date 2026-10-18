import { createBrowserRouter } from 'react-router';
import { Briefcase, LayoutDashboard, ListChecks, MapPinned, QrCode, Users } from 'lucide-react';
import { RequireRole, Home } from './guards.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { StudentShell } from '../components/layout/StudentShell.jsx';
import { LoginPage, RegisterPage } from '../pages/auth/AuthPages.jsx';
import { DashboardPage } from '../pages/dashboard/Dashboard.jsx';
import { MapPage } from '../pages/dashboard/MapPage.jsx';
import { IssuesPage } from '../pages/issues/IssuesPage.jsx';
import { IssueDetailPage } from '../pages/issues/IssueDetail.jsx';
import { UsersPage } from '../pages/users/UsersPage.jsx';
import { MyReportsPage } from '../pages/student/MyReports.jsx';
import { ReportIssuePage } from '../pages/student/ReportIssue.jsx';
import { FixedFeedPage } from '../pages/student/FixedFeed.jsx';
import { JobsPage } from '../pages/technician/JobsPage.jsx';
import { NotFoundPage } from '../pages/NotFound.jsx';
import { LocationsPage } from '../pages/locations/LocationsPage.jsx';
import { PrintSheetPage } from '../pages/locations/PrintSheet.jsx';

export const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/issues', label: 'Issues', icon: ListChecks },
  { to: '/map', label: 'Map', icon: MapPinned },
  { to: '/locations', label: 'Locations', icon: QrCode },
  { to: '/users', label: 'Users', icon: Users },
];

const TECH_NAV = [{ to: '/jobs', label: 'My jobs', icon: Briefcase }];

export const routes = [
  { path: '/', element: <Home /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <RequireRole roles={['admin']} />,
    children: [
      {
        element: <AppShell nav={ADMIN_NAV} searchable issueBase="/issues" />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/issues', element: <IssuesPage /> },
          { path: '/issues/:id', element: <IssueDetailPage /> },
          { path: '/map', element: <MapPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/locations', element: <LocationsPage /> },
        ],
      },
      // Outside the shell so the sheet prints without navigation chrome
      { path: '/locations/print', element: <PrintSheetPage /> },
    ],
  },
  {
    element: <RequireRole roles={['technician']} />,
    children: [
      {
        element: (
          <AppShell
            nav={TECH_NAV}
            issueBase="/jobs"
            footerNote="Tip: the FixIt Campus app shows your jobs with SLA countdowns and lets you resolve with an after photo on site."
          />
        ),
        children: [
          { path: '/jobs', element: <JobsPage /> },
          { path: '/jobs/:id', element: <IssueDetailPage backTo="/jobs" backLabel="My jobs" /> },
        ],
      },
    ],
  },
  {
    element: <RequireRole roles={['student']} />,
    children: [
      {
        element: <StudentShell />,
        children: [
          { path: '/my-reports', element: <MyReportsPage /> },
          {
            path: '/my-reports/:id',
            element: <IssueDetailPage backTo="/my-reports" backLabel="My reports" />,
          },
          { path: '/report', element: <ReportIssuePage /> },
          { path: '/fixed', element: <FixedFeedPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
