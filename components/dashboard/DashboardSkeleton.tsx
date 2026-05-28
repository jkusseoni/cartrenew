'use client'

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header skeleton */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="h-8 w-40 bg-gray-200 rounded-lg" />
            <div className="h-8 w-8 bg-gray-200 rounded-full" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl p-5 h-28" />
          ))}
        </div>

        {/* Quick actions skeleton */}
        <div className="bg-gray-200 rounded-xl h-32 mb-8" />

        {/* Table skeleton */}
        <div className="bg-gray-200 rounded-xl h-96" />
      </main>
    </div>
  )
}