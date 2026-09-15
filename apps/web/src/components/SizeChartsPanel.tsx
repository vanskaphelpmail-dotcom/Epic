import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Ruler, Edit3, RotateCcw } from 'lucide-react';
import type { AppConfig } from '../types';
import {
  SIZE_CHART_OPTIONS,
  SIZE_CHARTS,
  STANDARD_ADULT_COLUMNS,
  getAllSizeCharts,
  normalizeCustomChart,
  type SizeChartDef,
  type SizeChartRow,
} from '../lib/sizeCharts';
import { confirmAsync, toast } from './UiFeedback';
import { api, isApiEnabled, getToken } from '../lib/apiClient';

interface SizeChartsPanelProps {
  appConfig: AppConfig;
  onUpdateConfig: (next: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  onRequireStaffLogin?: () => void;
}

const BUILTIN_IDS = new Set(SIZE_CHART_OPTIONS.map((c) => c.id));

function deepCloneChart(chart: SizeChartDef): SizeChartDef {
  return {
    ...chart,
    columns: chart.columns.map((c) => ({ ...c })),
    sizeOptions: [...chart.sizeOptions],
    rows: chart.rows.map((r) => ({ ...r })),
  };
}

/** Built-ins + any Neon/custom overrides (overrides win by id). */
function seedEditableCharts(customCharts?: AppConfig['customSizeCharts']): SizeChartDef[] {
  return getAllSizeCharts(customCharts).map(deepCloneChart);
}

/**
 * Admin Size Charts page — edit built-in and custom measurement charts, then Update Charts.
 */
export const SizeChartsPanel: React.FC<SizeChartsPanelProps> = ({
  appConfig,
  onUpdateConfig,
  onRequireStaffLogin,
}) => {
  const [draft, setDraft] = useState<SizeChartDef[]>(() =>
    seedEditableCharts(appConfig.customSizeCharts),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (dirty) return;
    setDraft(seedEditableCharts(appConfig.customSizeCharts));
  }, [appConfig.customSizeCharts, dirty]);

  const updateRow = (index: number, patch: Partial<SizeChartDef>) => {
    setDraft((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Keep stable ids for built-in charts so product assignments stay valid
        if (patch.label && !BUILTIN_IDS.has(row.id) && !patch.id) {
          next.id = String(patch.label)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
        return next;
      }),
    );
    setDirty(true);
  };

  const addRow = () => {
    const id = `custom-chart-${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      {
        id,
        label: '',
        title: '',
        note: 'N.B: measurements may vary slightly',
        columns: [...STANDARD_ADULT_COLUMNS],
        sizeOptions: ['S', 'M', 'L', 'XL', '2XL'],
        rows: [
          { size: 'S', chest: 36, length: 27 },
          { size: 'M', chest: 38, length: 28 },
          { size: 'L', chest: 40, length: 29 },
          { size: 'XL', chest: 42, length: 30 },
          { size: '2XL', chest: 44, length: 31 },
        ],
      },
    ]);
    setEditingId(id);
    setDirty(true);
  };

  const resetBuiltin = async (index: number) => {
    const chart = draft[index];
    if (!chart || !BUILTIN_IDS.has(chart.id)) return;
    const factory = SIZE_CHARTS[chart.id];
    if (!factory) return;
    const ok = await confirmAsync({
      title: 'Reset chart?',
      message: `Restore “${chart.label}” to the original Epic Vanskap measurements?`,
      confirmText: 'Reset',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    setDraft((prev) => prev.map((row, i) => (i === index ? deepCloneChart(factory) : row)));
    setDirty(true);
    setEditingId(chart.id);
  };

  const removeRow = async (index: number) => {
    const chart = draft[index];
    if (!chart) return;
    if (BUILTIN_IDS.has(chart.id)) {
      await resetBuiltin(index);
      return;
    }
    const label = chart.label?.trim() || 'this chart';
    const ok = await confirmAsync({
      title: 'Delete size chart?',
      message: `Remove “${label}” from the catalog? Click Update Charts to publish.`,
      confirmText: 'Delete',
      cancelText: 'Keep',
      danger: true,
    });
    if (!ok) return;
    setDraft((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
    if (editingId === chart.id) setEditingId(null);
  };

  const handleSave = async () => {
    if (isApiEnabled() && !getToken() && onRequireStaffLogin) {
      onRequireStaffLogin();
      return;
    }
    const cleaned = draft
      .map((c, i) => normalizeCustomChart(c, i))
      .filter((c): c is SizeChartDef => Boolean(c && c.label.trim()));

    if (cleaned.length === 0) {
      toast('Keep at least one named size chart.', 'error');
      return;
    }
    if (cleaned.length !== draft.filter((d) => d.label.trim() || d.title.trim()).length) {
      toast('Each chart needs a name/label.', 'error');
      return;
    }

    setSaving(true);
    try {
      // Persist full editable set (built-in overrides + custom) so storefront uses admin values
      const nextConfig: AppConfig = { ...appConfig, customSizeCharts: cleaned };
      if (isApiEnabled()) {
        await api.updateCmsSettings({ customSizeCharts: cleaned });
      }
      onUpdateConfig(nextConfig);
      setDraft(cleaned.map(deepCloneChart));
      setDirty(false);
      toast('Size charts updated for the whole store.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save size charts', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateCell = (
    chartIndex: number,
    rowIndex: number,
    key: keyof SizeChartRow,
    value: string,
  ) => {
    const chart = draft[chartIndex];
    if (!chart) return;
    const rows = chart.rows.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));
    updateRow(chartIndex, { rows });
  };

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tight text-emerald-950 flex items-center gap-2">
            <Ruler size={16} className="text-emerald-700" /> Size & Measurement Charts
          </h4>
          <p className="text-[11px] text-emerald-700 mt-1 max-w-2xl">
            Edit built-in charts (Player, Fan, Retro, Kids, Customised) or add your own. Click the pencil to
            change measurements, then <strong>Update Charts</strong> to save for all products.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty ? (
            <span className="self-center text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              Unpublished changes
            </span>
          ) : (
            <span className="self-center text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
              Live
            </span>
          )}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-black uppercase cursor-pointer hover:bg-emerald-100 touch-manipulation"
          >
            <Plus size={14} /> Add Chart
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800 text-white text-[10px] font-black uppercase cursor-pointer hover:bg-emerald-900 disabled:opacity-50 touch-manipulation"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Update Charts'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {draft.map((chart, index) => {
          const open = editingId === chart.id;
          const isBuiltin = BUILTIN_IDS.has(chart.id);
          const showAge = chart.columns.some((c) => c.key === 'age');
          return (
            <div key={chart.id} className="border border-emerald-200 rounded-xl p-3 bg-white space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={chart.label}
                  onChange={(e) =>
                    updateRow(index, {
                      label: e.target.value,
                      title: chart.title || e.target.value,
                    })
                  }
                  placeholder="Chart name (e.g. Oversized Fit)"
                  className="flex-1 min-w-[10rem] bg-emerald-50/50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-bold"
                />
                {isBuiltin ? (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                    Built-in · editable
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-600 bg-zinc-50 border border-zinc-200 px-2 py-1 rounded-lg">
                    Custom
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingId(open ? null : chart.id)}
                  className={`p-2 rounded-lg border cursor-pointer touch-manipulation ${
                    open
                      ? 'border-emerald-800 bg-emerald-800 text-white'
                      : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                  }`}
                  title="Edit measurements"
                >
                  <Edit3 size={14} />
                </button>
                {isBuiltin ? (
                  <button
                    type="button"
                    onClick={() => void resetBuiltin(index)}
                    className="p-2 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer touch-manipulation"
                    title="Reset to default"
                  >
                    <RotateCcw size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void removeRow(index)}
                    className="p-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer touch-manipulation"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {open && (
                <div className="space-y-2 pt-1 border-t border-emerald-100">
                  <input
                    type="text"
                    value={chart.title}
                    onChange={(e) => updateRow(index, { title: e.target.value })}
                    placeholder="Title shown on product page"
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-3 py-1.5 text-[11px]"
                  />
                  <input
                    type="text"
                    value={chart.note}
                    onChange={(e) => updateRow(index, { note: e.target.value })}
                    placeholder="Note under the chart"
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-3 py-1.5 text-[11px]"
                  />
                  <p className="text-[10px] text-emerald-700 font-mono">Size options (comma separated)</p>
                  <input
                    type="text"
                    value={chart.sizeOptions.join(', ')}
                    onChange={(e) =>
                      updateRow(index, {
                        sizeOptions: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-3 py-1.5 text-[11px] font-mono"
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] font-mono min-w-[280px]">
                      <thead>
                        <tr className="text-left text-emerald-800">
                          <th className="py-1 pr-2">Size</th>
                          {showAge ? <th className="py-1 pr-2">Age</th> : null}
                          <th className="py-1 pr-2">Chest</th>
                          <th className="py-1">Length</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chart.rows.map((row, ri) => (
                          <tr key={`${chart.id}-r-${ri}`}>
                            <td className="py-1 pr-2">
                              <input
                                value={row.size}
                                onChange={(e) => updateCell(index, ri, 'size', e.target.value)}
                                className="w-14 border border-emerald-200 rounded px-1 py-0.5"
                              />
                            </td>
                            {showAge ? (
                              <td className="py-1 pr-2">
                                <input
                                  value={String(row.age ?? '')}
                                  onChange={(e) => updateCell(index, ri, 'age', e.target.value)}
                                  className="w-28 border border-emerald-200 rounded px-1 py-0.5"
                                />
                              </td>
                            ) : null}
                            <td className="py-1 pr-2">
                              <input
                                value={String(row.chest)}
                                onChange={(e) => updateCell(index, ri, 'chest', e.target.value)}
                                className="w-20 border border-emerald-200 rounded px-1 py-0.5"
                              />
                            </td>
                            <td className="py-1">
                              <input
                                value={String(row.length)}
                                onChange={(e) => updateCell(index, ri, 'length', e.target.value)}
                                className="w-20 border border-emerald-200 rounded px-1 py-0.5"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateRow(index, {
                        rows: [
                          ...chart.rows,
                          showAge
                            ? { size: '', age: '', chest: '', length: '' }
                            : { size: '', chest: '', length: '' },
                        ],
                      })
                    }
                    className="text-[10px] font-bold uppercase text-emerald-800 cursor-pointer"
                  >
                    + Add row
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
