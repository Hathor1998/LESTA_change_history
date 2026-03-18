import React, { useState } from 'react';
import { Save, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BalanceChange, ChangeCategory } from '../types';
import { parseTSV, generateTSV } from '../utils/tsv';

interface DataManageViewProps {
  data: BalanceChange[];
  onSave: (newData: BalanceChange[], category: ChangeCategory, mode: 'replace' | 'append') => void;
}

export default function DataManageView({ data, onSave }: DataManageViewProps) {
  const [tsvInput, setTsvInput] = useState('');
  const [importCategory, setImportCategory] = useState<ChangeCategory>('ship');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

  const handleParseAndSave = () => {
    try {
      if (!tsvInput.trim()) {
        setStatus({ type: 'error', message: '输入内容不能为空' });
        return;
      }
      const parsedData = parseTSV(tsvInput, importCategory);
      if (parsedData.length === 0) {
        setStatus({ type: 'error', message: '未能解析出有效数据，请检查格式' });
        return;
      }
      onSave(parsedData, importCategory, importMode);
      setStatus({ type: 'success', message: `成功导入 ${parsedData.length} 条记录！` });
      setTsvInput('');
    } catch (err) {
      setStatus({ type: 'error', message: '解析失败：' + (err as Error).message });
    }
  };

  const handleExport = () => {
    const categoryData = data.filter(d => d.category === importCategory);
    if (categoryData.length === 0) {
      setStatus({ type: 'error', message: '当前分类下没有数据可导出' });
      return;
    }
    const tsv = generateTSV(categoryData);
    navigator.clipboard.writeText(tsv).then(() => {
      setStatus({ type: 'success', message: `成功复制 ${categoryData.length} 条数据到剪贴板` });
    }).catch(() => {
      setStatus({ type: 'error', message: '复制失败，请手动选择复制' });
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          从 Excel 导入数据
        </h2>
        
        <div className="prose prose-sm text-slate-600 mb-6">
          <p>为了方便随时更新每个版本的数据，您可以直接从 Excel 中复制数据并粘贴到下方文本框中。</p>
          <p className="font-medium text-slate-800">请确保您的 Excel 列顺序如下（共9列）：</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['名称/船名', '系别', '等级', '类型/舰种', '属性', '修改前数值', '修改后数值', '改动版本', '备注'].map((col, i) => (
              <span key={i} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-700">
                {i + 1}. {col}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">注：包含或不包含表头均可，系统会自动识别并跳过表头。对于机制或杂项，没有的列（如系别、等级）请在Excel中留空。</p>
        </div>

        <div className="space-y-4">
          {/* Import Settings */}
          <div className="flex flex-col sm:flex-row gap-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">导入到分类：</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={importCategory === 'ship'} onChange={() => setImportCategory('ship')} className="text-blue-600 focus:ring-blue-500" />
                  舰船改动
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={importCategory === 'mechanic'} onChange={() => setImportCategory('mechanic')} className="text-blue-600 focus:ring-blue-500" />
                  机制改动
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={importCategory === 'misc'} onChange={() => setImportCategory('misc')} className="text-blue-600 focus:ring-blue-500" />
                  杂项改动
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">导入模式：</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="text-blue-600 focus:ring-blue-500" />
                  覆盖当前分类
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="text-blue-600 focus:ring-blue-500" />
                  追加到当前分类
                </label>
              </div>
            </div>
          </div>

          <textarea
            className="w-full h-64 p-4 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-y"
            placeholder="在此处粘贴从 Excel 复制的数据 (TSV格式)..."
            value={tsvInput}
            onChange={(e) => setTsvInput(e.target.value)}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleParseAndSave}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                解析并保存
              </button>
              <button
                onClick={handleExport}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                导出当前分类
              </button>
            </div>

            {status.type !== 'idle' && (
              <div className={`flex items-center gap-2 text-sm font-medium ${status.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {status.message}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">当前数据状态</h3>
        <p className="text-sm text-blue-800">
          系统当前共存储了 <strong>{data.length}</strong> 条记录。
          (舰船: {data.filter(d => d.category === 'ship').length} 条, 
           机制: {data.filter(d => d.category === 'mechanic').length} 条, 
           杂项: {data.filter(d => d.category === 'misc').length} 条)
        </p>
      </div>
    </div>
  );
}
