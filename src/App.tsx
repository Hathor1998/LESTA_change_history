import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Database, Settings, Ship, Wrench } from 'lucide-react';
import GroupedDataView from './components/GroupedDataView';
import DataManageView from './components/DataManageView';
import AppearanceControl from './components/AppearanceControl';
import BottomDock from './components/BottomDock';
import { CATEGORY_LABELS } from './data/schema.ts';
import type { ChangeCategory, GeneratedBalanceData } from './types.ts';
import rawBalanceData from './data/generated/balanceChanges.json';

type TabType = ChangeCategory | 'manage';
const balanceData = rawBalanceData as GeneratedBalanceData;
const categories = [
  { value: 'ship', label: '舰船改动', icon: Ship },
  { value: 'mechanic', label: '机制改动', icon: Settings },
  { value: 'misc', label: '其他改动', icon: Wrench },
] as const;

function MetaCard({ title, value }: { title: string; value: string }) {
  return <div className="meta-card"><span>{title}</span><strong>{value}</strong></div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('ship');
  const [compact, setCompact] = useState(false);
  const manualExpanded = useRef(false);
  const header = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const { records, meta } = balanceData;
  useLayoutEffect(() => {
    const element = header.current!;
    // Measure the full layout in an inert clone, never resize the visible header.
    const measure = () => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.classList.remove('is-compact');
      clone.querySelector('.brand-logo')?.classList.remove('compact');
      clone.inert = true;
      clone.setAttribute('aria-hidden', 'true');
      Object.assign(clone.style, { visibility: 'hidden', pointerEvents: 'none', position: 'absolute', top: '0' });
      document.body.append(clone);
      slot.current!.style.height = `${clone.getBoundingClientRect().height}px`;
      clone.remove();
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  useEffect(() => {
    const scroll = () => {
      const next = window.scrollY;
      if (next <= 8) { manualExpanded.current = false; setCompact(false); }
      else if (next > 100 && !manualExpanded.current) setCompact(true);
    };
    scroll();
    window.addEventListener('scroll', scroll, { passive: true });
    return () => window.removeEventListener('scroll', scroll);
  }, []);
  const navigation = <nav className="category-dock" aria-label="改动分类">
    {categories.map(({ value, label, icon: Icon }) => <button key={value} aria-label={CATEGORY_LABELS[value]} aria-pressed={activeTab === value} className={`category-tab ${activeTab === value ? 'active' : ''}`} onClick={() => setActiveTab(value)}>
      <Icon size={18} /><span className="category-label">{label}</span><span className="category-count">{meta.categoryCounts[value]}</span>
    </button>)}
  </nav>;
  return <div className="app-shell" style={{ overflowAnchor: 'none' }}>
    <div ref={slot} className="header-slot">
    <header ref={header} className={`site-header ${compact ? 'is-compact' : ''}`}>
      <div className="page-width">
        <div className="brand-row">
          <img src={`${import.meta.env.BASE_URL}brand/logo.png`} alt="World of Ships" className={`brand-logo ${compact ? 'compact' : ''}`} />
          <div className="brand-copy"><h1 className="brand-title">World of Ships Balance Changes</h1><p>舰船平衡改动总览</p></div>
          <div className="header-actions"><AppearanceControl /><button className="icon-button" aria-label={compact ? '展开页头' : '折叠页头'} aria-expanded={!compact} onClick={() => {manualExpanded.current = compact; setCompact(!compact);}}><ChevronDown size={20} className={compact ? '' : 'rotate-180'} /></button></div>
        </div>
        <div className="meta-grid">
          <MetaCard title="当前版本" value={meta.currentVersion} />
          <MetaCard title="公告档案" value={`${meta.officialData?.announcementCount ?? 0} 篇 · ${meta.recordCount} 条记录`} />
          <MetaCard title="数据生成" value={new Date(meta.generatedAt).toLocaleString('zh-CN', { hour12: false })} />
          <MetaCard title="最近维护" value={meta.lastUpdated || '未设置'} />
        </div>
        {import.meta.env.DEV && <button className="local-tool-button" onClick={() => setActiveTab(activeTab === 'manage' ? 'ship' : 'manage')}><Database size={16} />{activeTab === 'manage' ? '返回浏览' : '本地工具'}</button>}
      </div>
    </header>
    </div>
    <main className="page-width main-content">
      {activeTab !== 'manage' && <GroupedDataView key={activeTab} data={records} category={activeTab} navigation={navigation} />}
      {import.meta.env.DEV && activeTab === 'manage' && <><DataManageView data={records} meta={meta} /><BottomDock>{navigation}</BottomDock></>}
    </main>
    <footer className="site-footer">World of Ships Balance Changes<span>官方公告与仓库数据 · 只读浏览</span></footer>
  </div>;
}
