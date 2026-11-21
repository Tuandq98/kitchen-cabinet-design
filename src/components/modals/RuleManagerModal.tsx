import React, { useState } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import { DesignRule } from '../../types';
import {
  X,
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  Sliders,
  Check,
} from 'lucide-react';

interface RuleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RuleManagerModal: React.FC<RuleManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    rules,
    toggleRule,
    updateRuleConfig,
    importRules,
    resetRulesToDefault,
  } = useKitchenStore();

  const [activeRuleId, setActiveRuleId] = useState<string>(rules[0]?.id || '');
  const activeRule = rules.find((r) => r.id === activeRuleId);

  // Temporary config edit
  const [configParams, setConfigParams] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (activeRule) {
      setConfigParams({ ...activeRule.config });
    }
  }, [activeRuleId, rules]);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    if (activeRule) {
      updateRuleConfig(activeRule.id, configParams);
      alert('Đã cập nhật tham số quy tắc thành công!');
    }
  };

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(rules, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'kitchen-design-rules.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          importRules(parsed);
          alert(`Đã nạp thành công ${parsed.length} quy tắc từ JSON!`);
        }
      } catch (err) {
        alert('File JSON không hợp lệ: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Quản lý Quy tắc Thiết kế (Design Rule Engine)
              </h3>
              <p className="text-[11px] text-slate-400">
                Tùy biến ràng buộc cứng (Hard Constraints), điểm ưu tiên (Soft Constraints) và tham số kiểm tra
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Rules List (Left) */}
          <div className="w-1/2 border-r border-slate-800 flex flex-col p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-300">
              Danh sách Quy tắc ({rules.length})
            </span>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {/* Nhóm 1 */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block px-1">
                  1. Ràng buộc cứng & Vị trí Hệ tủ đứng
                </span>
                {rules
                  .filter((r) =>
                    [
                      'RULE_01',
                      'RULE_OVERFLOW',
                      'RULE_02',
                      'RULE_06',
                      'RULE_07',
                      'RULE_08',
                      'RULE_10',
                    ].includes(r.code)
                  )
                  .map((rule) => (
                    <div
                      key={rule.id}
                      onClick={() => setActiveRuleId(rule.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition ${
                        activeRuleId === rule.id
                          ? 'bg-slate-800/90 border-red-500 shadow-md ring-1 ring-red-500/20'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-red-500/20 text-red-400 border border-red-500/30">
                              BẮT BUỘC
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {rule.code}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-200">
                            {rule.name}
                          </h4>
                        </div>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRule(rule.id);
                          }}
                          className="w-4 h-4 accent-red-500 rounded cursor-pointer mt-0.5"
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* Nhóm 2 */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block px-1">
                  2. Khoảng cách & Bố trí đối trọng NKBA
                </span>
                {rules
                  .filter((r) => ['RULE_09', 'RULE_05', 'RULE_03'].includes(r.code))
                  .map((rule) => (
                    <div
                      key={rule.id}
                      onClick={() => setActiveRuleId(rule.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition ${
                        activeRuleId === rule.id
                          ? 'bg-slate-800/90 border-amber-500 shadow-md ring-1 ring-amber-500/20'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {rule.code === 'RULE_09' ? 'ĐỐI TRỌNG CÂN ĐỐI' : 'ƯU TIÊN (SOFT)'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {rule.code}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-200">
                            {rule.name}
                          </h4>
                        </div>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRule(rule.id);
                          }}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer mt-0.5"
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* Nhóm 3 */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block px-1">
                  3. Dây chuyền thao tác & Khoang phụ trợ
                </span>
                {rules
                  .filter((r) => ['RULE_04A', 'RULE_04B', 'RULE_04C', 'RULE_04D'].includes(r.code))
                  .map((rule) => (
                    <div
                      key={rule.id}
                      onClick={() => setActiveRuleId(rule.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition ${
                        activeRuleId === rule.id
                          ? 'bg-slate-800/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {rule.code === 'RULE_04D' ? 'THỨ TỰ (ORDER)' : 'LIỀN KỀ'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {rule.code}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-200">
                            {rule.name}
                          </h4>
                        </div>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRule(rule.id);
                          }}
                          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer mt-0.5"
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* Nhóm 4 */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block px-1">
                  4. Quy tắc Tủ Trên (Upper Cabinets)
                </span>
                {rules
                  .filter((r) =>
                    [
                      'RULE_U01',
                      'RULE_U02',
                      'RULE_U03',
                      'RULE_U04',
                      'RULE_U05',
                    ].includes(r.code)
                  )
                  .map((rule) => (
                    <div
                      key={rule.id}
                      onClick={() => setActiveRuleId(rule.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition ${
                        activeRuleId === rule.id
                          ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/20'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                rule.severity === 'ERROR'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              }`}
                            >
                              {rule.severity === 'ERROR' ? 'BẮT BUỘC' : 'CĂN TIM / ƯU TIÊN'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {rule.code}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-200">
                            {rule.name}
                          </h4>
                        </div>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRule(rule.id);
                          }}
                          className="w-4 h-4 accent-sky-500 rounded cursor-pointer mt-0.5"
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* Nhóm 5: Quy tắc khác (nếu có bất kỳ quy tắc nào ngoài các nhóm trên) */}
              {rules.filter(
                (r) =>
                  ![
                    'RULE_01',
                    'RULE_OVERFLOW',
                    'RULE_02',
                    'RULE_06',
                    'RULE_07',
                    'RULE_08',
                    'RULE_10',
                    'RULE_09',
                    'RULE_05',
                    'RULE_03',
                    'RULE_04A',
                    'RULE_04B',
                    'RULE_04C',
                    'RULE_04D',
                    'RULE_U01',
                    'RULE_U02',
                    'RULE_U03',
                    'RULE_U04',
                    'RULE_U05',
                  ].includes(r.code)
              ).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block px-1">
                    5. Quy tắc bổ sung khác
                  </span>
                  {rules
                    .filter(
                      (r) =>
                        ![
                          'RULE_01',
                          'RULE_OVERFLOW',
                          'RULE_02',
                          'RULE_06',
                          'RULE_07',
                          'RULE_08',
                          'RULE_09',
                          'RULE_05',
                          'RULE_03',
                          'RULE_04A',
                          'RULE_04B',
                          'RULE_04C',
                          'RULE_04D',
                          'RULE_U01',
                          'RULE_U02',
                          'RULE_U03',
                          'RULE_U04',
                          'RULE_U05',
                        ].includes(r.code)
                    )
                    .map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => setActiveRuleId(rule.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition ${
                          activeRuleId === rule.id
                            ? 'bg-slate-800/90 border-purple-500 shadow-md ring-1 ring-purple-500/20'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                {rule.severity}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                {rule.code}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-200">
                              {rule.name}
                            </h4>
                          </div>
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleRule(rule.id);
                            }}
                            className="w-4 h-4 accent-purple-500 rounded cursor-pointer mt-0.5"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất JSON</span>
                </button>
                <label className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Nạp JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                onClick={resetRulesToDefault}
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mặc định</span>
              </button>
            </div>
          </div>

          {/* Config Editor (Right) */}
          <div className="w-1/2 p-4 flex flex-col space-y-4 overflow-y-auto">
            {activeRule ? (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                      {activeRule.code}
                    </span>
                    <h4 className="text-sm font-bold text-slate-100">
                      {activeRule.name}
                    </h4>
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed text-[11px]">
                    {activeRule.description}
                  </p>
                </div>

                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <h5 className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tham số cấu hình linh hoạt</span>
                  </h5>

                  {/* Render dynamic inputs based on rule */}
                  {activeRule.type === 'MIN_DISTANCE' && (
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Khoảng cách tối thiểu an toàn (mm)
                      </label>
                      <input
                        type="number"
                        step="50"
                        min="100"
                        max="2000"
                        value={configParams.minDistanceMm ?? 300}
                        onChange={(e) =>
                          setConfigParams({
                            ...configParams,
                            minDistanceMm: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                      />
                    </div>
                  )}

                  {activeRule.type === 'WORK_TRIANGLE' && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-slate-400 block mb-1">
                          Chu vi tối thiểu tam giác NKBA (mm)
                        </label>
                        <input
                          type="number"
                          step="100"
                          value={configParams.minPerimeterMm ?? 3500}
                          onChange={(e) =>
                            setConfigParams({
                              ...configParams,
                              minPerimeterMm: Number(e.target.value),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">
                          Chu vi tối đa tam giác NKBA (mm)
                        </label>
                        <input
                          type="number"
                          step="100"
                          value={configParams.maxPerimeterMm ?? 8500}
                          onChange={(e) =>
                            setConfigParams({
                              ...configParams,
                              maxPerimeterMm: Number(e.target.value),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                        />
                      </div>
                    </div>
                  )}

                  {activeRule.type === 'ADJACENCY' && (
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Khoảng cách tối đa cho phép (mm)
                      </label>
                      <input
                        type="number"
                        step="50"
                        value={configParams.maxDistanceMm ?? 900}
                        onChange={(e) =>
                          setConfigParams({
                            ...configParams,
                            maxDistanceMm: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                      />
                    </div>
                  )}

                  {activeRule.type === 'COOKTOP_EDGE_CLEARANCE' && (
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Khoảng cách đệm tối thiểu tới mép ngoài cùng (mm)
                      </label>
                      <input
                        type="number"
                        step="50"
                        min="100"
                        max="1000"
                        value={configParams.minEdgeClearanceMm ?? 300}
                        onChange={(e) =>
                          setConfigParams({
                            ...configParams,
                            minEdgeClearanceMm: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                      />
                    </div>
                  )}

                  {activeRule.type === 'COOKTOP_NEAR_TALL_UNIT' && (
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Khoảng cách an toàn tối thiểu tới vách tủ cao (mm)
                      </label>
                      <input
                        type="number"
                        step="50"
                        min="100"
                        max="1000"
                        value={configParams.minDistanceMm ?? 300}
                        onChange={(e) =>
                          setConfigParams({
                            ...configParams,
                            minDistanceMm: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                      />
                    </div>
                  )}

                  {Object.keys(configParams).length === 0 && (
                    <div className="text-slate-500 italic py-2">
                      Quy tắc này không yêu cầu tham số bổ sung.
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSaveConfig}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu thay đổi tham số</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
