import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Ruler, Edit3 } from 'lucide-react';
import type { AppConfig } from '../types';
import {
  SIZE_CHART_OPTIONS,
  STANDARD_ADULT_COLUMNS,
  normalizeCustomChart,
  type SizeChartDef,
} from '../lib/sizeCharts';
import { confirmAsync, toast } from './UiFeedback';
import { api, isApiEnabled, getToken } from '../lib/apiClient';

interface SizeChartsPanelProps {
  appConfig: AppConfig;
  onUpdateConfig: (next: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  onRequireStaffLogin?: () => void;
}

function cloneCharts(list: SizeChartDef[]): SizeChartDef[] {
  return list.map((c, i) => normalizeCustomChart(c, i)!).filter(Boolean);
}

/**
 * Inventory panel — create / edit / delete custom size & measurement chart formats.
 * Built-in charts (Player, Fan, Retro, …) stay available and are listed read-only.
 */
export const SizeChartsPanel: React.FC<SizeChartsPanelProps> = ({
  appConfig,
  onUpdateConfig,
  onRequireStaffLogin,
}) => {
  const seed =
    Array.isArray(appConfig.customSizeCharts) && appConfig.customSizeCharts.length > 0
      ? cloneCharts(appConfig.customSizeCharts as SizeChartDef[])
      : [];

  const [draft, setDraft] = useState<SizeChartDef[]>(seed);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (dirty) return;
    const next =
      Array.isArray(appConfig.customSizeCharts) && appConfig.customSizeCharts.length > 0
        ? cloneCharts(appConfig.customSizeCharts as SizeChartDef[])
        : [];
    setDraft(next);
  }, [appConfig.customSizeCharts, dirty]);

  const updateRow = (index: number, patch: Partial<SizeChartDef>) => {
    setDraft((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.label && !patch.id) {
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

  const removeRow = async (index: number) => {
    const label = draft[index]?.label?.trim() || 'this chart';
    const ok = await confirmAsync({
      title: 'Delete size chart?',
      message: `Remove “${label}” from the draft list? Click Update Charts to publish.`,
      confirmText: 'Delete',
      cancelText: 'Keep',
      danger: true,
    });
    if (!ok) return;
    setDraft((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    if (isApiEnabled() && !getToken() && onRequireStaffLogin) {
      onRequireStaffLogin();
      return;
    }
    const cleaned = draft
      .map((c, i) => normalizeCustomChart(c, i))
      .filter((c): c is SizeChartDef => Boolean(c && c.label.trim()));

    if (cleaned.length !== draft.filter((d) => d.label.trim() || d.title.trim()).length) {
      toast('Each custom chart needs a name/label.', 'error');
      return;
    }

    setSaving(true);
    try {
      const nextConfig: AppConfig = { ...appConfig, customSizeCharts: cleaned };
      if (isApiEnabled()) {
        await api.updateCmsSettings({ customSizeCharts: cleaned });
      }
      onUpdateConfig(nextConfig);
      setDraft(cleaned);
      setDirty(false);
      setEditingId(null);
      toast('Size charts updated for the whole store.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save size charts', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tight text-emerald-950 flex items-center gap-2">
            <Ruler size={16} className="text-emerald-700" /> Size & Measurement Charts
          </h4>
          <p className="text-[11px] text-emerald-700 mt-1 max-w-2xl">
            Built-in charts (Player, Fan, Retro, Kids, Customised) are always available. Add your own formats
            here — name, edit, or delete — then assign them on products and categories.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-black uppercase cursor-pointer hover:bg-emerald-100"
          >
            <Plus size={14} /> Add Chart
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800 text-white text-[10px] font-black uppercase cursor-pointer hover:bg-emerald-900 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Update Charts'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-2">Built-in (read-only)</p>
        <div className="flex flex-wrap gap-1.5">
          {SIZE_CHART_OPTIONS.map((c) => (
            <span
              key={c.id}
              className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-900"
            >
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {draft.length === 0 ? (
        <p className="text-xs text-emerald-700 font-mono py-4 text-center border border-dashed border-emerald-200 rounded-xl">
          No custom charts yet. Click Add Chart to create a future measurement format.
        </p>
      ) : (
        <div className="space-y-3">
          {draft.map((chart, index) => {
            const open = editingId === chart.id;
            return (
              <div key={chart.id} className="border border-emerald-200 rounded-xl p-3 bg-white space-y-2">
                <div className="flex items-center gap-2">
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
                    className="flex-1 bg-emerald-50/50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingId(open ? null : chart.id)}
                    className="p-2 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                    title="Edit rows"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="p-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
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
                    <p className="text-[10px] text-emerald-700 font-mono">
                      Size options (comma separated)
                    </p>
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
                      <table className="w-full text-[10px] font-mono">
                        <thead>
                          <tr className="text-left text-emerald-800">
                            <th className="py-1 pr-2">Size</th>
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
                                  onChange={(e) => {
                                    const rows = [...chart.rows];
                                    rows[ri] = { ...row, size: e.target.value };
                                    updateRow(index, { rows });
                                  }}
                                  className="w-14 border border-emerald-200 rounded px-1 py-0.5"
                                />
                              </td>
                              <td className="py-1 pr-2">
                                <input
                                  value={String(row.chest)}
                                  onChange={(e) => {
                                    const rows = [...chart.rows];
                                    rows[ri] = { ...row, chest: e.target.value };
                                    updateRow(index, { rows });
                                  }}
                                  className="w-16 border border-emerald-200 rounded px-1 py-0.5"
                                />
                              </td>
                              <td className="py-1">
                                <input
                                  value={String(row.length)}
                                  onChange={(e) => {
                                    const rows = [...chart.rows];
                                    rows[ri] = { ...row, length: e.target.value };
                                    updateRow(index, { rows });
                                  }}
                                  className="w-16 border border-emerald-200 rounded px-1 py-0.5"
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
                          rows: [...chart.rows, { size: '', chest: '', length: '' }],
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
      )}
    </div>
  );
};
