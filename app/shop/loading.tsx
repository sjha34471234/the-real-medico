export default function ShopLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="animate-pulse">
        <div className="h-10 bg-slate-200 rounded w-1/4 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-8" />
        <div className="flex gap-3 mb-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-24 bg-slate-200 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card">
              <div className="w-full h-56 bg-slate-200 rounded-t-2xl" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-8 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
