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
import { SettingsPage } from '../features/settings/SettingsPage.tsx';

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    // No state dump: private text must not be shown in or sent with an error report.
    return (
      <div className="notice is-error" role="alert">
        <h1>這個畫面發生錯誤</h1>
        <p>已保存的記錄不受影響。請回首頁或重新整理頁面。</p>
        <Link to="/">回首頁</Link>
      </div>
    );
  }
}

function Layout() {
  const { repo } = useApp();
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
        <Link to="/" className="brand">地占沙盤</Link>
        <nav aria-label="主要導覽">
          <NavLink to="/new">新增占問</NavLink>
          <NavLink to="/journal">日誌</NavLink>
          <NavLink to="/learn">教學</NavLink>
          <NavLink to="/settings">設定</NavLink>
        </nav>
      </header>
      {repo.mode === 'memory' && (
        <p className="notice is-error banner" role="status">暫存模式：這個瀏覽器目前無法使用本機儲存。記錄只留在這個分頁，關閉後就會消失；需要保留請在結果頁或設定匯出。</p>
      )}
      {pwa.needRefresh && pwa.busy.length === 0 && (
        <p className="notice banner" role="status">
          有新版本可以使用。<button type="button" onClick={acceptUpdate}>更新並重新載入</button>
        </p>
      )}
      <main id="main" ref={main} tabIndex={-1}>
        <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
      </main>
      <footer className="site-footer">
        <p>測試版・基礎象徵解讀（內容草稿，未經專家審校）。解讀提供象徵與反思，不能取代實際資訊與專業意見。</p>
      </footer>
    </>
  );
}

function NotFound() {
  return (
    <div className="card">
      <h1>找不到頁面</h1>
      <p>這個網址沒有對應的內容。</p>
      <p><Link to="/">回首頁</Link>　<Link to="/journal">日誌</Link></p>
    </div>
  );
}

// Hash routing: works on any static host and offline. Routes carry only local random IDs.
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
      { path: '/learn/:figureId', element: <FigurePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
