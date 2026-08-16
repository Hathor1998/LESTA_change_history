import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Filter, Search } from 'lucide-react';
import {
  CATEGORY_LABELS,
  CHANGE_TAG_LABELS,
  SHIP_STATUS_LABELS,
} from '../data/schema.ts';
import type { BalanceChange, ChangeCategory, ChangeTag, ShipStatus } from '../types.ts';

interface GroupedDataViewProps {
  data: BalanceChange[];
  category: ChangeCategory;
}

function compareVersionsDesc(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

const romanTiers = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function formatTier(tier: string): string {
  const value = Number.parseInt(tier, 10);
  if (value === 11) return '⭐';
  return romanTiers[value] ?? tier;
}

function isGameVersion(version: string): boolean {
  return /^\d{1,2}\.\d{1,2}$/.test(version);
}

function trendTone(trend: BalanceChange['trend']): string {
  switch (trend) {
    case 'buff':
      return 'text-emerald-600 font-semibold';
    case 'nerf':
      return 'text-red-600 font-semibold';
    case 'neutral':
      return 'text-slate-600 font-medium';
    default:
      return 'text-slate-900 font-medium';
  }
}

function filterVisibleTags(tags: ChangeTag[], shipStatus: ShipStatus): ChangeTag[] {
  return tags.filter((tag) => {
    if (shipStatus === 'released' && tag === 'released-ship') {
      return false;
    }
    if (shipStatus === 'test' && tag === 'test-ship') {
      return false;
    }
    return true;
  });
}

export default function GroupedDataView({ data, category }: GroupedDataViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [nationFilter, setNationFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [shipStatusFilter, setShipStatusFilter] = useState<ShipStatus | ''>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const categoryData = useMemo(() => data.filter((item) => item.category === category), [category, data]);
  const nations = useMemo(() => uniqueStrings(categoryData.map((item) => item.nation)).sort((a, b) => a.localeCompare(b, 'zh-CN')), [categoryData]);
  const tiers = useMemo(() => uniqueStrings(categoryData.map((item) => item.tier)).filter((tier) => /^\d{1,2}$/.test(tier)).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)), [categoryData]);
  const types = useMemo(() => uniqueStrings(categoryData.map((item) => item.type)).sort((a, b) => a.localeCompare(b, 'zh-CN')), [categoryData]);
  const versions = useMemo(() => uniqueStrings(categoryData.map((item) => item.version)).filter(isGameVersion).sort(compareVersionsDesc), [categoryData]);

  const filteredData = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return categoryData.filter((item) => {
      const searchableText = [
        item.targetName,
        item.canonicalName,
        item.previousNames.join(' '),
        item.attribute,
        item.notes,
      ].join(' ').toLowerCase();

      const matchesSearch = !keyword || searchableText.includes(keyword);
      const matchesNation = nationFilter ? item.nation === nationFilter : true;
      const matchesTier = tierFilter ? item.tier === tierFilter : true;
      const matchesType = typeFilter ? item.type === typeFilter : true;
      const matchesVersion = versionFilter ? item.version === versionFilter : true;
      const matchesShipStatus = shipStatusFilter ? item.shipStatus === shipStatusFilter : true;

      return matchesSearch && matchesNation && matchesTier && matchesType && matchesVersion && matchesShipStatus;
    });
  }, [categoryData, nationFilter, searchTerm, shipStatusFilter, tierFilter, typeFilter, versionFilter]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, BalanceChange[]>();
    filteredData.forEach((item) => {
      const key = item.canonicalName || item.targetName;
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    });

    return [...groups.entries()].map(([groupName, changes]) => [groupName, changes.sort((left, right) => compareVersionsDesc(left.version, right.version))] as const);
  }, [filteredData]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((current) => ({ ...current, [groupName]: !current[groupName] }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`搜索${CATEGORY_LABELS[category]}的规范名、曾用名或属性`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {nations.length > 0 && (
              <select className="block w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={nationFilter} onChange={(event) => setNationFilter(event.target.value)}>
                <option value="">全部国籍</option>
                {nations.map((nation) => (
                  <option key={nation} value={nation}>{nation}</option>
                ))}
              </select>
            )}

            {tiers.length > 0 && (
              <select className="block w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
                <option value="">全部等级</option>
                {tiers.map((tier) => (
                  <option key={tier} value={tier}>{formatTier(tier)}</option>
                ))}
              </select>
            )}

            {types.length > 0 && (
              <select className="block w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">全部舰种</option>
                {types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            )}

            {category === 'ship' && (
              <select className="block w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={shipStatusFilter} onChange={(event) => setShipStatusFilter(event.target.value as ShipStatus | '')}>
                <option value="">全部状态</option>
                <option value="released">正式船</option>
                <option value="test">测试船</option>
                <option value="unknown">未知状态</option>
              </select>
            )}

            {versions.length > 0 && (
              <select className="block w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={versionFilter} onChange={(event) => setVersionFilter(event.target.value)}>
                <option value="">全部版本</option>
                {versions.map((version) => (
                  <option key={version} value={version}>{version}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {groupedEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {groupedEntries.map(([groupName, changes]) => {
            const isExpanded = expandedGroups[groupName] !== false;
            const firstItem = changes[0];
            const aliases = uniqueStrings(
              changes.flatMap((item) => [item.targetName, ...item.previousNames]).filter((name) => name !== groupName),
            );
            const tags = filterVisibleTags(uniqueStrings(changes.flatMap((item) => item.tags)) as ChangeTag[], firstItem.shipStatus);

            return (
              <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleGroup(groupName)}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900">{groupName}</h3>
                      {firstItem.nation && <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-600">{firstItem.nation}</span>}
                      {firstItem.tier && <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-600">{formatTier(firstItem.tier)}</span>}
                      {firstItem.type && <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-600">{firstItem.type}</span>}
                      {category === 'ship' && (
                        <span className="bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 text-xs text-blue-700">
                          {SHIP_STATUS_LABELS[firstItem.shipStatus]}
                        </span>
                      )}
                    </div>
                    {(aliases.length > 0 || tags.length > 0) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {aliases.length > 0 && <span>曾用名：{aliases.join(' / ')}</span>}
                        {tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                            {CHANGE_TAG_LABELS[tag]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium bg-white px-2 py-1 rounded border border-slate-200">
                      {changes.length} 条记录
                    </span>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">显示名</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">属性</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">原始值</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">改后数值</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">版本</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">备注</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {changes.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-900">
                              <div className="font-medium">{item.targetName}</div>
                              {item.targetName !== item.canonicalName && (
                                <div className="text-xs text-slate-500 mt-1">规范名：{item.canonicalName}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900 font-medium">{item.attribute}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{item.oldValue}</td>
                            <td className="px-6 py-4 text-sm">
                              <div className={trendTone(item.trend)}>{item.newValue}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                {item.version}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">{item.notes || '-'}</td>
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
          <p className="text-lg font-medium text-slate-600">没有找到符合筛选条件的记录</p>
          <p className="text-sm mt-1">可以尝试清空搜索词、版本或状态筛选后再查看。</p>
        </div>
      )}
    </div>
  );
}
