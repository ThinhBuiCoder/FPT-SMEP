import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 bg-mesh">
      <Sidebar />
      <div className="ml-[260px] flex flex-col min-h-screen transition-all duration-300">
        <Navbar />
        <main className="flex-1 p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
