import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Wizard from './components/Wizard';
import InvoiceGenerator from './components/InvoiceGenerator';
import Settings from './components/Settings';
import { LayoutDashboard, Wand2, Calculator, Settings as SettingsIcon, FileText } from 'lucide-react';
import clsx from 'clsx';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Sidebar / Navigation */}
      <nav className="fixed top-0 left-0 h-full w-20 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col items-center py-8 z-50 transition-colors duration-300">
        <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-xl mb-10 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200 dark:shadow-none">
          P
        </div>

        <div className="flex flex-col gap-6 w-full">
          <NavIcon icon={LayoutDashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} tooltip="Transakcije" />
          <NavIcon icon={Wand2} active={activeTab === 'wizard'} onClick={() => setActiveTab('wizard')} tooltip="PO-SD Čarobnjak" />
          <NavIcon icon={FileText} active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} tooltip="Izdavanje Računa" />
          <NavIcon icon={SettingsIcon} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} tooltip="Postavke" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 min-h-screen">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'wizard' && <Wizard />}
        {activeTab === 'invoices' && <InvoiceGenerator />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

const NavIcon = ({ icon: Icon, active, onClick, tooltip }) => (
  <button
    onClick={onClick}
    className={clsx(
      "w-full h-14 flex items-center justify-center transition-all relative group",
      active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
    )}
  >
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 dark:bg-indigo-400 rounded-r-full" />
    )}
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />

    {/* Tooltip */}
    <span className="absolute left-16 bg-slate-800 dark:bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
      {tooltip}
    </span>
  </button>
);

export default App;
