import { Component, useEffect, useRef, type ReactNode } from 'react';
import { createHashRouter, Link, NavLink, Outlet, RouterProvider, useLocation } from 'react-router';
import { useApp } from './AppContext.tsx';
import { acceptUpdate, usePwa } from './pwa.ts';
import { HomePage } from '../features/home/HomePage.tsx';
import { NewQuestionPage } from '../features/question/NewQuestionPage.tsx';
import { CastPage } from '../features/casting/CastPage.tsx';
import { ResultPage } from '../features/result/ResultPage.tsx';
import { JournalPage } from '../features/journal/JournalPage.tsx';
import { ExamplePage, FigurePage, LearnPage } from '../features/learn/LearnPages.tsx';
import { HousesPage } from '../features/learn/HousesPage.tsx';
import { PracticePage } from '../features/learn/PracticePage.tsx';
import { SettingsPage } from '../features/settings/SettingsPage.tsx';
import { SharedPage } from '../features/shared/SharedPage.tsx';
import { TryPage } from '../features/learn/TryPage.tsx';
import { CustomsPage } from '../features/learn/CustomsPage.tsx';
import { CorrespondencesPage } from '../features/learn/CorrespondencesPage.tsx';
import { BrandMark, NavIcon } from '../components/Decor.tsx';

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    // No state dump: private text must not be shown in or sent with an error report.
    return <ErrorFallback />;
  }
}

function ErrorFallback() {
  const { L } = useApp();
  return (
    <div className="notice is-error" role="alert">
      <h1>{L('這個畫面發生錯誤', 'Something went wrong on this screen')}</h1>
      <p>{L('已保存的記錄不受影響。請回首頁或重新整理頁面。', 'Saved records are not affected. Go back to the home page or reload.')}</p>
      <Link to="/">{L('回首頁', 'Home')}</Link>
    </div>
  );
}

/** One tap switches the whole interface; each language is named in itself. */
function LanguageSwitch() {
  const { lang, updateSetting } = useApp();
  const other = lang === 'en' ? 'zh-TW' : 'en';
  return (
    <button type="button" className="lang-switch" lang={other} onClick={() => { updateSetting('language', other).catch(() => undefined); }}>
      {other === 'en' ? 'English' : '中文'}
    </button>
  );
}

function Layout() {
  const { repo, L } = useApp();
  const pwa = usePwa();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand"><BrandMark />{L('地占沙盤', 'Geomancy Sand Tray')}</Link>
        <nav aria-label={L('主要導覽', 'Main navigation')}>
          <NavLink to="/new"><NavIcon name="new" />{L('新增占問', 'New question')}</NavLink>
          <NavLink to="/journal"><NavIcon name="journal" />{L('日誌', 'Journal')}</NavLink>
          <NavLink to="/learn"><NavIcon name="learn" />{L('教學', 'Learn')}</NavLink>
          <NavLink to="/settings"><NavIcon name="settings" />{L('設定', 'Settings')}</NavLink>
          <LanguageSwitch />
        </nav>
      </header>
      {repo.mode === 'memory' && (
        <p className="notice is-error banner" role="status">{L('暫存模式：這個瀏覽器目前無法使用本機儲存。記錄只留在這個分頁，關閉後就會消失；需要保留請在結果頁或設定匯出。',
          'Temporary mode: this browser cannot use local storage right now. Records stay only in this tab and disappear when it closes; export them from the result page or settings to keep them.')}</p>
      )}
      {pwa.needRefresh && pwa.busy.length === 0 && (
        <p className="notice banner" role="status">
          {L('有新版本可以使用。', 'A new version is available.')}<button type="button" onClick={acceptUpdate}>{L('更新並重新載入', 'Update and reload')}</button>
        </p>
      )}
      <main id="main" ref={main} tabIndex={-1}>
        <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
      </main>
      <footer className="site-footer">
        <p>{L('測試版・基礎象徵解讀（內容草稿，未經專家審校）。解讀提供象徵與反思，不能取代實際資訊與專業意見。',
          'Beta · basic symbolic reading (draft content, not expert-reviewed). Readings offer symbols and reflection; they do not replace real information or professional advice.')}</p>
      </footer>
    </>
  );
}

function NotFound() {
  const { L } = useApp();
  return (
    <div className="card">
      <h1>{L('找不到頁面', 'Page not found')}</h1>
      <p>{L('這個網址沒有對應的內容。', 'Nothing lives at this address.')}</p>
      <p><Link to="/">{L('回首頁', 'Home')}</Link>　<Link to="/journal">{L('日誌', 'Journal')}</Link></p>
    </div>
  );
}

// Hash routing: works on any static host and offline. Routes carry only local random IDs,
// except #/shared, which carries a chart the user chose to share (DECISIONS D40).
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/new', element: <NewQuestionPage /> },
      { path: '/cast/:id', element: <CastPage /> },
      { path: '/result/:id', element: <ResultPage /> },
      { path: '/journal', element: <JournalPage /> },
      { path: '/learn', element: <LearnPage /> },
      { path: '/learn/example', element: <ExamplePage /> },
      { path: '/learn/houses', element: <HousesPage /> },
      { path: '/learn/practice', element: <PracticePage /> },
      { path: '/learn/try', element: <TryPage /> },
      { path: '/learn/customs', element: <CustomsPage /> },
      { path: '/learn/correspondences', element: <CorrespondencesPage /> },
      { path: '/learn/:figureId', element: <FigurePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/shared', element: <SharedPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
