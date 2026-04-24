import React, { useMemo, useState } from 'react';
import { Anchor, Database, Settings, Ship, Wrench } from 'lucide-react';
import GroupedDataView from './components/GroupedDataView';
import DataManageView from './components/DataManageView';
import { CATEGORY_LABELS } from './data/schema.ts';
import type { ChangeCategory, GeneratedBalanceData } from './types.ts';
import rawBalanceData from './data/generated/balanceChanges.json';

type TabType = ChangeCategory | 'manage';

const balanceData = rawBalanceData as GeneratedBalanceData;

const TAB_ICON_MAP: Record<ChangeCategory, React.ComponentType<{ className?: string }>> = {
  ship: Ship,
  mechanic: Settings,
  misc: Wrench,
};

export default function App() {
  const showLocalTools = import.meta.env.DEV;
  const [activeTab, setActiveTab] = useState<TabType>('ship');
  const { records, meta } = balanceData;

  const categoryCounts = useMemo(() => ({
    ship: meta.categoryCounts.ship ?? 0,
    mechanic: meta.categoryCounts.mechanic ?? 0,
    misc: meta.categoryCounts.misc ?? 0,
  }), [meta.categoryCounts]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-inner">
                <Anchor className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">WoWS 平衡改动总览</h1>
                <p className="text-xs text-slate-400 font-medium tracking-wide">World of ships Balance Changes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm w-full lg:w-auto">
              <div className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="text-slate-400 text-xs">当前版本号</div>
                <div className="text-lg font-semibold text-white mt-1">{meta.currentVersion}</div>
              </div>
              <div className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="text-slate-400 text-xs">数据生成时间</div>
                <div className="font-medium text-white mt-1">{new Date(meta.generatedAt).toLocaleString('zh-CN', { hour12: false })}</div>
              </div>
              <div className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="text-slate-400 text-xs">最近维护日期</div>
                <div className="font-medium text-white mt-1">{meta.lastUpdated || '未设置'}</div>
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 pb-4">
            {(['ship', 'mechanic', 'misc'] as ChangeCategory[]).map((category) => {
              const Icon = TAB_ICON_MAP[category];
              const isActive = activeTab === category;

              return (
                <button
                  key={category}
                  onClick={() => setActiveTab(category)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{CATEGORY_LABELS[category]}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${isActive ? 'bg-blue-500/60' : 'bg-slate-700 text-slate-200'}`}>
                    {categoryCounts[category]}
                  </span>
                </button>
              );
            })}

            {showLocalTools && (
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'manage'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Database className="h-4 w-4" />
                <span>本地工具</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'ship' && <GroupedDataView data={records} category="ship" />}
        {activeTab === 'mechanic' && <GroupedDataView data={records} category="mechanic" />}
        {activeTab === 'misc' && <GroupedDataView data={records} category="misc" />}
        {showLocalTools && activeTab === 'manage' && <DataManageView data={records} meta={meta} />}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-slate-400 text-sm">
        <p>正式真源来自 `data/raw/*.tsv` 与 `data/config/site.json`，前端只读取生成数据。</p>
        <p className="mt-1">
          {showLocalTools
            ? '当前为本地开发模式，可使用数据导入与数据管理工具。'
            : '当前为生产浏览模式，不提供任何本地写入或维护入口。'}
        </p>
      </footer>
    </div>
  );
}
