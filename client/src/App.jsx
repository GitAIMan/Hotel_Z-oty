import { useState, createContext, useContext } from 'react';
import InvoiceList from './components/InvoiceList';
import SettlementList from './components/SettlementList';
import TransactionHistory from './components/TransactionHistory';
import { FileText, DollarSign, Clock, LayoutDashboard, Building2, TableProperties } from 'lucide-react';

// Context for Entity (Hotel)
export const EntityContext = createContext();

function App() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [entity, setEntity] = useState('zloty_gron'); // 'zloty_gron' or 'srebrny_bucznik'

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center gap-3 px-8 py-5 text-lg font-medium transition-all duration-300 overflow-hidden
        ${activeTab === id
          ? 'text-gold-700 bg-gold-50/50'
          : 'text-gray-500 hover:text-gold-600 hover:bg-white/50'
        }
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gold-500 transition-transform duration-300 ${activeTab === id ? 'scale-y-100' : 'scale-y-0'}`} />
      <Icon size={24} className={activeTab === id ? 'text-gold-600' : 'text-gray-400'} />
      <span className="font-serif tracking-wide">{label}</span>
    </button>
  );

  return (
    <EntityContext.Provider value={{ entity, setEntity }}>
      <div className="min-h-screen bg-gray-50 bg-subtle-pattern text-gray-800 font-sans selection:bg-gold-200">

        {/* Top Navigation Bar */}
        <nav className="glass-card sticky top-0 z-50 border-b border-gold-100">
          <div className="max-w-[95%] mx-auto px-4 lg:px-8 py-3 lg:py-6 flex flex-col lg:flex-row items-center justify-between gap-4">

            {/* Logo Area */}
            <div className="flex items-center gap-4 lg:gap-6 w-full lg:w-auto justify-between lg:justify-start">
              <div className="flex items-center gap-4 lg:gap-6">
                <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-gold-gradient flex items-center justify-center shadow-lg shadow-gold-500/20">
                  <LayoutDashboard className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight font-serif">
                    <span className="text-gold-gradient">Złoty Groń</span>
                  </h1>
                  <p className="text-[10px] lg:text-sm text-gold-600 font-bold tracking-[0.25em] uppercase mt-1">System Rozliczeń AI</p>
                </div>
              </div>
            </div>

            {/* Entity Switcher */}
            <div className="flex bg-gray-100/50 p-1 rounded-xl border border-gray-200 w-full lg:w-auto">
              <button
                onClick={() => setEntity('zloty_gron')}
                className={`flex-1 lg:flex-none justify-center px-4 py-2 lg:px-6 lg:py-3 rounded-lg text-sm lg:text-base font-medium transition-all duration-300 flex items-center gap-2 lg:gap-3
                  ${entity === 'zloty_gron'
                    ? 'bg-white text-gold-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Building2 size={16} className="lg:w-5 lg:h-5" />
                <span className="whitespace-nowrap">Złoty Groń</span>
              </button>
              <button
                onClick={() => setEntity('srebrny_bucznik')}
                className={`flex-1 lg:flex-none justify-center px-4 py-2 lg:px-6 lg:py-3 rounded-lg text-sm lg:text-base font-medium transition-all duration-300 flex items-center gap-2 lg:gap-3
                  ${entity === 'srebrny_bucznik'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Building2 size={16} className="lg:w-5 lg:h-5" />
                <span className="whitespace-nowrap">Srebrny Bucznik</span>
              </button>
            </div>

          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-[95%] mx-auto px-4 lg:px-8 py-6 lg:py-12 pb-24 lg:pb-12">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
            {/* Sidebar Navigation (Desktop) */}
            <div className="hidden lg:block lg:col-span-2">
              <div className="glass-card rounded-2xl overflow-hidden sticky top-36">
                <div className="p-8 border-b border-gray-100 bg-gold-50/30">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Menu Główne</p>
                </div>
                <div className="flex flex-col">
                  <TabButton id="invoices" label="Faktury" icon={FileText} />
                  <TabButton id="settlements" label="Rozliczenia" icon={DollarSign} />
                  <TabButton id="history" label="Transakcje" icon={TableProperties} />
                  <TabButton id="logs" label="Logi Systemu" icon={Clock} />
                </div>
                <div className="p-8 mt-4 border-t border-gray-100">
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-lg">
                    <p className="text-xs text-gray-400 mb-2">Status AI</p>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="font-medium text-base">Claude 4.5 Sonnet</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">Ready for Analysis</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-10">
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'invoices' && <InvoiceList entity={entity} />}
                {activeTab === 'settlements' && <SettlementList entity={entity} />}
                {activeTab === 'history' && <TransactionHistory entity={entity} />}
                {activeTab === 'logs' && <HistoryList entity={entity} />}
              </div>
            </div>
          </div>

        </main>


        {/* Bottom Navigation (Mobile) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gold-100 p-2 flex justify-around items-center lg:hidden z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-20 ${activeTab === 'invoices' ? 'text-gold-600 bg-gold-50' : 'text-gray-400'}`}
          >
            <FileText size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Faktury</span>
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-20 ${activeTab === 'settlements' ? 'text-gold-600 bg-gold-50' : 'text-gray-400'}`}
          >
            <DollarSign size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Rozlicz</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-20 ${activeTab === 'history' ? 'text-gold-600 bg-gold-50' : 'text-gray-400'}`}
          >
            <TableProperties size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Transakcje</span>
          </button>
        </div>

      </div>
    </EntityContext.Provider >
  );
}

export default App;
