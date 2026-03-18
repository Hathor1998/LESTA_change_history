import React, { useState, useEffect } from 'react';
import { Ship, Database, Anchor, Settings, Wrench } from 'lucide-react';
import GroupedDataView from './components/GroupedDataView';
import DataManageView from './components/DataManageView';
import { BalanceChange, ChangeCategory } from './types';
import { initialData } from './data/initialData';

type TabType = 'ship' | 'mechanic' | 'misc' | 'manage';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('ship');
  const [data, setData] = useState<BalanceChange[]>([]);

  useEffect(() => {
    const storedData = localStorage.getItem('wows_balance_data');
    if (storedData) {
      try {
        setData(JSON.parse(storedData));
      } catch (e) {
        console.error('Failed to parse stored data', e);
        setData(initialData);
      }
    } else {
      setData(initialData);
    }
  }, []);

  const handleSaveData = (parsedData: BalanceChange[], category: ChangeCategory, mode: 'replace' | 'append') => {
    let newData = [...data];
    if (mode === 'replace') {
      newData = newData.filter(d => d.category !== category);
      newData = [...newData, ...parsedData];
    } else {
      newData = [...newData, ...parsedData];
    }
    setData(newData);
    localStorage.setItem('wows_balance_data', JSON.stringify(newData));
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between h-auto md:h-16 py-4 md:py-0 items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-blue-600 p-2 rounded-lg shadow-inner">
                <Anchor className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">战舰世界历史平衡性调整查询</h1>
                <p className="text-xs text-slate-400 font-medium tracking-wide">World of Warships Balance Changes</p>
              </div>
            </div>
            
            {/* Tabs */}
            <nav className="flex flex-wrap justify-center space-x-1 bg-slate-800 p-1 rounded-lg w-full md:w-auto">
              <button
                onClick={() => setActiveTab('ship')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'ship'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Ship className="h-4 w-4" />
                <span>舰船改动</span>
              </button>
              <button
                onClick={() => setActiveTab('mechanic')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'mechanic'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>机制改动</span>
              </button>
              <button
                onClick={() => setActiveTab('misc')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'misc'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Wrench className="h-4 w-4" />
                <span>杂项改动</span>
              </button>
              <div className="w-px h-6 bg-slate-700 mx-1 self-center hidden sm:block"></div>
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'manage'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Database className="h-4 w-4" />
                <span>数据管理</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'ship' && <GroupedDataView data={data} category="ship" />}
        {activeTab === 'mechanic' && <GroupedDataView data={data} category="mechanic" />}
        {activeTab === 'misc' && <GroupedDataView data={data} category="misc" />}
        {activeTab === 'manage' && <DataManageView data={data} onSave={handleSaveData} />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-slate-400 text-sm">
        <p>数据仅供参考，具体以游戏内实际数据为准。</p>
        <p className="mt-1">支持从 Excel 复制粘贴，随时更新版本数据。</p>
      </footer>
    </div>
  );
}
