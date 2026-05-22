export default function Inbox() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-6xl mb-4">📧</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Coming Soon</h2>
        <p className="text-gray-500 dark:text-white/50 mb-8 max-w-sm">
          Your unified inbox will be here. Connect your email accounts to manage everything in one place.
        </p>
        <button
          disabled
          className="px-6 py-3 bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/30 rounded-xl font-semibold cursor-not-allowed"
        >
          Connect Email
        </button>
      </div>

      {/* Mock layout preview */}
      <div className="mt-8 space-y-4 opacity-30 pointer-events-none">
        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <h3 className="text-gray-500 dark:text-white/60 font-semibold mb-3">Inbox Preview</h3>
          <div className="space-y-2">
            {[
              { from: 'John Doe', subject: 'Project Update', time: '10:30 AM' },
              { from: 'Lisa Kim', subject: 'Design Review', time: '9:15 AM' },
              { from: 'GitHub', subject: 'New Pull Request', time: 'Yesterday' },
            ].map((email, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-[#e7f900]/20 flex items-center justify-center text-sm text-[#e7f900]">
                  {email.from[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-500 dark:text-white/50 text-sm truncate">{email.from}</p>
                  <p className="text-gray-400 dark:text-white/30 text-xs truncate">{email.subject}</p>
                </div>
                <span className="text-gray-300 dark:text-white/20 text-xs">{email.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
