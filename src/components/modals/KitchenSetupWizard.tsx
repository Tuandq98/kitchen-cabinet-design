import React, { useState } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import { KitchenShape, ModuleCategory } from '../../types';
import {
  ChefHat,
  Layers,
  Flame,
  Droplets,
  Refrigerator,
  Microwave,
  Archive,
  UtensilsCrossed,
  Sparkles,
  Check,
  CheckSquare2,
  Square,
  ArrowRight,
  Ruler,
  X,
} from 'lucide-react';

interface KitchenSetupWizardProps {
  isOpen: boolean;
  onClose?: () => void;
}

interface ShapePreset {
  lengthA: number;
  depthA: number;
  lengthB: number;
  depthB: number;
  lengthC: number;
  depthC: number;
  selectedCodes: string[];
}

const INITIAL_SHAPE_PRESETS: Record<KitchenShape, ShapePreset> = {
  I: {
    lengthA: 3600,
    depthA: 600,
    lengthB: 2400,
    depthB: 600,
    lengthC: 2400,
    depthC: 600,
    selectedCodes: ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01'],
  },
  L: {
    lengthA: 3000,
    depthA: 600,
    lengthB: 2400,
    depthB: 600,
    lengthC: 2400,
    depthC: 600,
    selectedCodes: ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01', 'K01'],
  },
  U: {
    lengthA: 2700,
    depthA: 600,
    lengthB: 2400,
    depthB: 600,
    lengthC: 2400,
    depthC: 600,
    selectedCodes: ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01', 'K01'],
  },
};

export const KitchenSetupWizard: React.FC<KitchenSetupWizardProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    layout,
    catalog,
    initKitchenLayout,
  } = useKitchenStore();

  const [shape, setShape] = useState<KitchenShape>(layout.shape || 'I');
  const [shapePresets, setShapePresets] = useState<Record<KitchenShape, ShapePreset>>(INITIAL_SHAPE_PRESETS);

  // Kích thước cạnh & danh sách khoang của kiểu bếp đang chọn
  const currentPreset = shapePresets[shape];
  const lengthA = currentPreset.lengthA;
  const depthA = currentPreset.depthA;
  const lengthB = currentPreset.lengthB;
  const depthB = currentPreset.depthB;
  const lengthC = currentPreset.lengthC;
  const depthC = currentPreset.depthC;
  const selectedBaseCodes = currentPreset.selectedCodes;

  const updateCurrentPreset = (partial: Partial<ShapePreset>) => {
    setShapePresets((prev) => ({
      ...prev,
      [shape]: {
        ...prev[shape],
        ...partial,
      },
    }));
  };

  const setLengthA = (val: number) => updateCurrentPreset({ lengthA: val });
  const setDepthA = (val: number) => updateCurrentPreset({ depthA: val });
  const setLengthB = (val: number) => updateCurrentPreset({ lengthB: val });
  const setDepthB = (val: number) => updateCurrentPreset({ depthB: val });
  const setLengthC = (val: number) => updateCurrentPreset({ lengthC: val });
  const setDepthC = (val: number) => updateCurrentPreset({ depthC: val });

  if (!isOpen) return null;

  // Lọc chỉ lấy các khoang tủ dưới từ catalog
  const baseCatalogModules = catalog.filter((m) => m.tier !== 'upper');

  const handleShapeChange = (newShape: KitchenShape) => {
    setShape(newShape);
    if (newShape === 'I') {
      // Bếp chữ I không có góc nối, tự động loại bỏ K01
      const currentCodes = shapePresets[newShape]?.selectedCodes || [];
      const cleaned = currentCodes.filter((c) => c !== 'K01');
      updateCurrentPreset({ selectedCodes: cleaned });
    }
  };

  const toggleCode = (code: string) => {
    // 3 khoang trụ cột F01, S01, B01 là bắt buộc
    if (['F01', 'S01', 'B01'].includes(code)) return;
    // Bếp chữ I không thể chọn khoang góc nối
    if (shape === 'I' && code === 'K01') return;

    const nextCodes = selectedBaseCodes.includes(code)
      ? selectedBaseCodes.filter((c) => c !== code)
      : [...selectedBaseCodes, code];
    updateCurrentPreset({ selectedCodes: nextCodes });
  };

  const handleSelectNKBA = () => {
    const defaultCodes = shape === 'I'
      ? ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01']
      : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01', 'K01'];
    updateCurrentPreset({ selectedCodes: defaultCodes });
  };

  const handleSelectMinimal = () => {
    updateCurrentPreset({ selectedCodes: ['F01', 'S01', 'B01'] });
  };

  const handleSelectAll = () => {
    const allCodes = baseCatalogModules
      .filter((m) => shape !== 'I' || m.code !== 'K01')
      .map((m) => m.code);
    updateCurrentPreset({ selectedCodes: allCodes });
  };

  const handleStartDesign = () => {
    initKitchenLayout({
      shape,
      edgeA: { length: Number(lengthA), depth: Number(depthA) },
      edgeB: shape === 'L' || shape === 'U' ? { length: Number(lengthB), depth: Number(depthB) } : undefined,
      edgeC: shape === 'U' ? { length: Number(lengthC), depth: Number(depthC) } : undefined,
      baseModuleCodes: selectedBaseCodes,
    });
    onClose?.();
  };

  const getCategoryIcon = (category: ModuleCategory) => {
    switch (category) {
      case 'cooking':
        return <Flame className="w-3.5 h-3.5 text-red-400" />;
      case 'sink':
        return <Droplets className="w-3.5 h-3.5 text-sky-400" />;
      case 'refrigeration':
        return <Refrigerator className="w-3.5 h-3.5 text-blue-400" />;
      case 'appliance':
        return <Microwave className="w-3.5 h-3.5 text-purple-400" />;
      case 'storage':
        return <Archive className="w-3.5 h-3.5 text-amber-400" />;
      case 'prep':
        return <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[94vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Khởi tạo Mặt bằng & Chọn Khoang Tủ Dưới</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                  BƯỚC 1 / 2
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Chọn mẫu dáng bếp, nhập kích thước tường và chọn các khoang công năng tủ dưới mong muốn
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-slate-200 text-xs">
          {/* PHẦN 1: CHỌN MẪU BẾP */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">
                1
              </span>
              <span>Chọn Kiểu Dáng Bếp</span>
            </label>

            <div className="grid grid-cols-3 gap-3">
              {/* Bếp chữ I */}
              <button
                type="button"
                onClick={() => handleShapeChange('I')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  shape === 'I'
                    ? 'bg-sky-500/15 border-sky-400 shadow-md shadow-sky-500/10 ring-1 ring-sky-400'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-100">Bếp Chữ I</span>
                  {shape === 'I' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                {/* Visual Diagram chữ I */}
                <div className="h-10 bg-slate-900/90 rounded-lg p-2 flex items-center border border-slate-800 mb-2">
                  <div className="w-full h-3 rounded bg-sky-500/60 border border-sky-400" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Thiết kế thẳng 1 vách tường, tối ưu căn hộ chung cư & nhà phố hiện đại.
                </p>
              </button>

              {/* Bếp chữ L */}
              <button
                type="button"
                onClick={() => handleShapeChange('L')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  shape === 'L'
                    ? 'bg-sky-500/15 border-sky-400 shadow-md shadow-sky-500/10 ring-1 ring-sky-400'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-100">Bếp Chữ L</span>
                  {shape === 'L' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                {/* Visual Diagram chữ L */}
                <div className="h-10 bg-slate-900/90 rounded-lg p-1.5 flex flex-col justify-between border border-slate-800 mb-2">
                  <div className="w-full h-2.5 rounded bg-sky-500/60 border border-sky-400" />
                  <div className="w-3 h-4 rounded bg-sky-500/60 border border-sky-400 -mt-1" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Thiết kế góc vuông 2 vách tường, tam giác công năng rộng rãi chuẩn NKBA.
                </p>
              </button>

              {/* Bếp chữ U */}
              <button
                type="button"
                onClick={() => handleShapeChange('U')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  shape === 'U'
                    ? 'bg-sky-500/15 border-sky-400 shadow-md shadow-sky-500/10 ring-1 ring-sky-400'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-100">Bếp Chữ U</span>
                  {shape === 'U' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                {/* Visual Diagram chữ U */}
                <div className="h-10 bg-slate-900/90 rounded-lg p-1.5 flex items-stretch border border-slate-800 mb-2">
                  <div className="w-2.5 h-full rounded-l bg-sky-500/60 border border-sky-400" />
                  <div className="flex-1 h-2.5 rounded-t bg-sky-500/60 border border-sky-400 self-start" />
                  <div className="w-2.5 h-full rounded-r bg-sky-500/60 border border-sky-400" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Thiết kế bao quanh 3 vách tường, tối đa diện tích lưu trữ và bàn chuẩn bị.
                </p>
              </button>
            </div>
          </div>

          {/* PHẦN 2: ĐIỀN KÍCH CỠ CẠNH TƯỜNG */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              <span>Kích Thước Cạnh Bếp (mm)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Cạnh A */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sky-400">Cạnh Chính (Cạnh A)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Tường chính</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Dài (mm)</label>
                    <input
                      type="number"
                      min={2400}
                      max={10000}
                      step={50}
                      value={lengthA}
                      onChange={(e) => setLengthA(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Sâu (mm)</label>
                    <input
                      type="number"
                      min={550}
                      max={700}
                      step={10}
                      value={depthA}
                      onChange={(e) => setDepthA(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-300 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cạnh B */}
              {(shape === 'L' || shape === 'U') && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-400">Cạnh Vuông Góc (Cạnh B)</span>
                    <span className="text-[10px] text-slate-500 font-mono">Bên trái</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Dài (mm)</label>
                      <input
                        type="number"
                        min={1500}
                        max={10000}
                        step={50}
                        value={lengthB}
                        onChange={(e) => setLengthB(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Sâu (mm)</label>
                      <input
                        type="number"
                        min={550}
                        max={700}
                        step={10}
                        value={depthB}
                        onChange={(e) => setDepthB(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cạnh C */}
              {shape === 'U' && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-amber-400">Cạnh Đối Diện (Cạnh C)</span>
                    <span className="text-[10px] text-slate-500 font-mono">Bên phải</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Dài (mm)</label>
                      <input
                        type="number"
                        min={1500}
                        max={10000}
                        step={50}
                        value={lengthC}
                        onChange={(e) => setLengthC(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Sâu (mm)</label>
                      <input
                        type="number"
                        min={550}
                        max={700}
                        step={10}
                        value={depthC}
                        onChange={(e) => setDepthC(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PHẦN 3: CHỌN KHOANG CÔNG NĂNG TỦ DƯỚI */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">
                  3
                </span>
                <span>Chọn Khoang Công Năng Tủ Dưới ({selectedBaseCodes.length} khoang đã chọn)</span>
              </label>

              {/* Preset buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectNKBA}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition"
                >
                  Chuẩn NKBA
                </button>
                <button
                  type="button"
                  onClick={handleSelectMinimal}
                  className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Tối giản
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Tất cả
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {baseCatalogModules.map((mod) => {
                const isCornerDisabled =
                  shape === 'I' && (mod.code === 'K01' || mod.category === 'corner');
                const isSelected = !isCornerDisabled && selectedBaseCodes.includes(mod.code);
                const isRequired = ['F01', 'S01', 'B01'].includes(mod.code);

                return (
                  <div
                    key={mod.id}
                    onClick={() => {
                      if (!isCornerDisabled) toggleCode(mod.code);
                    }}
                    className={`p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                      isCornerDisabled
                        ? 'opacity-40 bg-slate-950/20 border-slate-900 cursor-not-allowed'
                        : isSelected
                        ? 'bg-sky-500/10 border-sky-500/50 text-slate-100 shadow-sm cursor-pointer'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCornerDisabled ? (
                        <Square className="w-4 h-4 text-slate-700" />
                      ) : isSelected ? (
                        <CheckSquare2 className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-300">
                          {mod.code}
                        </span>
                        {isRequired && (
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 rounded">
                            Bắt buộc
                          </span>
                        )}
                        {isCornerDisabled && (
                          <span className="text-[9px] font-semibold text-amber-400/80 bg-amber-500/10 px-1 rounded border border-amber-500/20">
                            Chỉ bếp L/U
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-xs truncate">{mod.name}</h5>
                      <span className="text-[10px] text-slate-500">
                        {mod.variants.map((v) => v.width).join(', ')}mm
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            Bước 1: Tủ dưới sẽ được tạo và sắp xếp tối ưu theo quy tắc công thái học.
          </div>
          <button
            onClick={handleStartDesign}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center gap-2 transition active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Tạo Tủ Dưới & Bắt Đầu Thiết Kế ➔</span>
          </button>
        </div>
      </div>
    </div>
  );
};
