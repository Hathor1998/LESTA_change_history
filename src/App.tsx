import React, { useEffect, useMemo, useState } from 'react';
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

function HeaderMetaCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-lg px-4 py-3">
      <div className="text-slate-400 text-xs">{title}</div>
      <div className="font-medium text-white mt-1">{value}</div>
    </div>
  );
}

export default function App() {
  const showLocalTools = import.meta.env.DEV;
  const [activeTab, setActiveTab] = useState<TabType>('ship');
  const [isMobileCompact, setIsMobileCompact] = useState(false);
  const { records, meta } = balanceData;

  const categoryCounts = useMemo(() => ({
    ship: meta.categoryCounts.ship ?? 0,
    mechanic: meta.categoryCounts.mechanic ?? 0,
    misc: meta.categoryCounts.misc ?? 0,
  }), [meta.categoryCounts]);

  const trendSummary = useMemo(() => {
    const counts = meta.trendCounts ?? { buff: 0, nerf: 0, neutral: 0, adjustment: 0 };
    return `↑ ${counts.buff}  ↓ ${counts.nerf}  • ${counts.neutral + counts.adjustment}`;
  }, [meta.trendCounts]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (window.innerWidth >= 768 || currentScrollY <= 8) {
        setIsMobileCompact(false);
      } else if (currentScrollY > lastScrollY && currentScrollY > 72) {
        setIsMobileCompact(true);
      } else if (currentScrollY < lastScrollY) {
        setIsMobileCompact(false);
      }
      lastScrollY = currentScrollY;
    };
    const handleResize = () => window.innerWidth >= 768 && setIsMobileCompact(false);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`transition-all duration-300 ${isMobileCompact ? 'py-3' : 'py-4'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-blue-600 p-2 rounded-lg shadow-inner shrink-0">
                <Anchor className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold tracking-tight truncate">改动总览</h1>
                {!isMobileCompact && (
                  <>
                    <p className="hidden md:block text-sm text-slate-200 mt-0.5">WoWS 平衡改动总览</p>
                    <p className="hidden md:block text-xs text-slate-400 font-medium tracking-wide">World of Warships Balance Changes</p>
                  </>
                )}
              </div>
            </div>

            <div className={`${isMobileCompact ? 'hidden' : 'block'} mt-4 space-y-4`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 text-sm w-full">
                <HeaderMetaCard title="当前版本号" value={meta.currentVersion} />
                <HeaderMetaCard title="官方公告范围" value={meta.officialData ? `${meta.officialData.announcementCount} 篇 / 近两年` : `${meta.recordCount} 条记录`} />
                <HeaderMetaCard title="自动判定（增强 / 削弱 / 平调）" value={trendSummary} />
                <HeaderMetaCard title="数据生成时间" value={new Date(meta.generatedAt).toLocaleString('zh-CN', { hour12: false })} />
                <HeaderMetaCard title="最近维护日期" value={meta.lastUpdated || '未设置'} />
              </div>

              <nav className="flex gap-2 overflow-x-auto pb-1">
                {(['ship', 'mechanic', 'misc'] as ChangeCategory[]).map((category) => {
                  const Icon = TAB_ICON_MAP[category];
                  const isActive = activeTab === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setActiveTab(category)}
                      className={`shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{CATEGORY_LABELS[category]}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${isActive ? 'bg-blue-500/60' : 'bg-slate-700 text-slate-200'}`}>{categoryCounts[category]}</span>
                    </button>
                  );
                })}
                {showLocalTools && (
                  <button
                    onClick={() => setActiveTab('manage')}
                    className={`shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'manage' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                  >
                    <Database className="h-4 w-4" />
                    <span>本地工具</span>
                  </button>
                )}
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {activeTab === 'ship' && <GroupedDataView data={records} category="ship" />}
        {activeTab === 'mechanic' && <GroupedDataView data={records} category="mechanic" />}
        {activeTab === 'misc' && <GroupedDataView data={records} category="misc" />}
        {showLocalTools && activeTab === 'manage' && <DataManageView data={records} meta={meta} />}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-slate-400 text-sm">
        <p>正式数据来自官方公告数据库与 `data/raw/*.tsv` 镜像，前端只读取生成数据。</p>
        <p className="mt-1">{showLocalTools ? '当前为本地开发模式，可使用数据导入和数据管理工具。' : '当前为生产浏览模式，不提供任何在线修改入口。'}</p>
      </footer>
    </div>
  );
}
