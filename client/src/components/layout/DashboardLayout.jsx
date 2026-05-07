export default function DashboardLayout({ sidebar, children }) {
  return (
    <div className="relative px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-4 lg:gap-6">
        <aside className="col-span-12 lg:col-span-3">{sidebar}</aside>
        <div className="col-span-12 space-y-6 lg:col-span-9">{children}</div>
      </div>
    </div>
  );
}
