import React, { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { BalanceChange, ChangeCategory } from '../types';

interface GroupedDataViewProps {
  data: BalanceChange[];
  category: ChangeCategory;
}

export default function GroupedDataView({ data, category }: GroupedDataViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [nationFilter, setNationFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Filter data for the current category
  const categoryData = useMemo(() => data.filter(d => d.category === category), [data, category]);

  // Extract unique values for filters
  const nations = useMemo(() => Array.from(new Set(categoryData.map(d => d.nation))).filter(Boolean).sort(), [categoryData]);
  const tiers = useMemo(() => Array.from(new Set(categoryData.map(d => d.tier))).filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b)), [categoryData]);
  const types = useMemo(() => Array.from(new Set(categoryData.map(d => d.type))).filter(Boolean).sort(), [categoryData]);
  const versions = useMemo(() => Array.from(new Set(categoryData.map(d => d.version))).filter(Boolean).sort((a, b) => parseFloat(b) - parseFloat(a)), [categoryData]);

  // Apply filters
  const filteredData = useMemo(() => {
    return categoryData.filter(item => {
      const matchSearch = item.targetName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.attribute.toLowerCase().includes(searchTerm.toLowerCase());
      const matchNation = nationFilter ? item.nation === nationFilter : true;
      const matchTier = tierFilter ? item.tier === tierFilter : true;
      const matchType = typeFilter ? item.type === typeFilter : true;
      const matchVersion = versionFilter ? item.version === versionFilter : true;

      return matchSearch && matchNation && matchTier && matchType && matchVersion;
    });
  }, [categoryData, searchTerm, nationFilter, tierFilter, typeFilter, versionFilter]);

  // Group by targetName
  const groupedData = useMemo(() => {
    const groups: Record<string, BalanceChange[]> = {};
    filteredData.forEach(item => {
      if (!groups[item.targetName]) {
        groups[item.targetName] = [];
      }
      groups[item.targetName].push(item);
    });
    return groups;
  }, [filteredData]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getTrendColor = (trend?: string) => {
    switch (trend) {
      case 'buff': return 'text-emerald-600 font-medium';
      case 'nerf': return 'text-red-600 font-medium';
      case 'neutral': return 'text-gray-600';
      default: return 'text-gray-900';
    }
  };

  const showNationAndTier = category === 'ship' || nations.length > 0 || tiers.length > 0;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Filters Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
              placeholder={`搜索${category === 'ship' ? '船名' : category === 'mechanic' ? '机制' : '名称'}或属性...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {showNationAndTier && (
              <>
                <select
                  className="block w-32 pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
                  value={nationFilter}
                  onChange={(e) => setNationFilter(e.target.value)}
                >
                  <option value="">所有系别</option>
                  {nations.map(n => <option key={n} value={n}>{n}</option>)}
                </select>

                <select
                  className="block w-28 pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                >
                  <option value="">所有等级</option>
                  {tiers.map(t => <option key={t} value={t}>{t}级</option>)}
                </select>
              </>
            )}

            {types.length > 0 && (
              <select
                className="block w-32 pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">所有类型</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            <select
              className="block w-32 pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
            >
              <option value="">所有版本</option>
              {versions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Grouped Cards Section */}
      <div className="flex-1 overflow-y-auto pb-8">
        {Object.keys(groupedData).length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {Object.entries(groupedData).map(([targetName, changes]) => {
              const isExpanded = expandedGroups[targetName] !== false; // Default to expanded
              const firstItem = changes[0];
              
              return (
                <div key={targetName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200">
                  {/* Card Header */}
                  <div 
                    className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleGroup(targetName)}
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900">{targetName}</h3>
                      <div className="flex gap-2 text-xs font-medium text-slate-600">
                        {firstItem.tier && <span className="bg-slate-200/80 px-2.5 py-1 rounded-md">{firstItem.tier}级</span>}
                        {firstItem.nation && <span className="bg-slate-200/80 px-2.5 py-1 rounded-md">{firstItem.nation}</span>}
                        {firstItem.type && <span className="bg-slate-200/80 px-2.5 py-1 rounded-md">{firstItem.type}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-medium bg-white px-2 py-1 rounded border border-slate-200">
                        {changes.length} 项改动
                      </span>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>

                  {/* Card Body (Table) */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">属性</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/5">修改前数值</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/5">修改后数值</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">版本</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">备注</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {changes.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3 text-sm text-slate-900 font-medium">{item.attribute}</td>
                              <td className="px-6 py-3 text-sm text-slate-500">{item.oldValue}</td>
                              <td className={`px-6 py-3 text-sm ${getTrendColor(item.trend)}`}>{item.newValue}</td>
                              <td className="px-6 py-3 text-sm text-slate-500">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                  {item.version}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-sm text-slate-500">{item.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
            <Filter className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-lg font-medium text-slate-600">没有找到符合条件的记录</p>
            <p className="text-sm mt-1">请尝试调整筛选条件，或在“数据管理”中导入数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
