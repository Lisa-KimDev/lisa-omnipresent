import { NavLink, Outlet } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

const tabs = [
  { to: '/creative', icon: '🎨', label: 'Creative' },
  { to: '/tasks', icon: '✅', label: 'Tasks' },
  { to: '/docs', icon: '📁', label: 'Docs' },
  { to: '/inbox', icon: '📧', label: 'Inbox' },
  { to: '/links', icon: '🔗', label: 'Links' },
  { to: '/server', icon: '🖥️', label: 'Server' },
  { to: '/apps', icon: '🎛️', label: 'Apps' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#111111]/90 backdrop-blur-md border-b border-gray-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#111111] dark:text-[#e7f900]">Lisa</h1>
        <ThemeToggle />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#111111]/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10">
        <div
          className="flex items-center overflow-x-auto scrollbar-hide"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-4 text-xs whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'text-[#e7f900]'
                    : 'text-gray-400 dark:text-white/50'
                }`
              }
              style={{ scrollSnapAlign: 'start' }}
            >
              <span className="text-xl mb-0.5">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
