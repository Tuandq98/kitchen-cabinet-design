import React, { useState, useEffect } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import {
  X,
  Check,
  AlertCircle,
  Sparkles,
  Layers,
  Flame,
  Droplets,
  Refrigerator,
  Microwave,
  Archive,
  UtensilsCrossed,
  CheckSquare2,
  Square,
  Wand2,
} from 'lucide-react';
import { ModuleCategory } from '../../types';

interface DimensionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DimensionsModal: React.FC<DimensionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    layout,
    catalog,
    selectedModuleCodes,
    updateEdgeDimensions,
    setSelectedModuleCodes,
    initKitchenLayout,
    runLayoutGenerator,
    setActiveTab,
  } = useKitchenStore();

  const [lengthA, setLengthA] = useState(layout.edgeA.length);
  const [depthA, setDepthA] = useState(layout.edgeA.depth);

  const [lengthB, setLengthB] = useState(layout.edgeB?.length || 2400);
  const [depthB, setDepthB] = useState(layout.edgeB?.depth || 600);

  const [lengthC, setLengthC] = useState(layout.edgeC?.length || 2400);
  const [depthC, setDepthC] = useState(layout.edgeC?.depth || 600);

  // Chỉ lấy danh sách khoang Tủ Dưới
  const baseCatalog = catalog.filter((m) => m.tier !== 'upper');

  // Local state danh sách khoang tủ dưới được chọn
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() => {
    if (layout.placedModules && layout.placedModules.length > 0) {
      return Array.from(new Set(layout.placedModules.map((m) => m.code)));
    }
    const baseCodes = (selectedModuleCodes || []).filter((c) => !c.startsWith('U'));
    return baseCodes.length > 0 ? baseCodes : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01'];
  });

  // Đồng bộ khi modal được mở
  useEffect(() => {
    if (isOpen) {
      setLengthA(layout.edgeA.length);
      setDepthA(layout.edgeA.depth);
      setLengthB(layout.edgeB?.length || 2400);
      setDepthB(layout.edgeB?.depth || 600);
      setLengthC(layout.edgeC?.length || 2400);
      setDepthC(layout.edgeC?.depth || 600);
      const activeCodes =
        layout.placedModules && layout.placedModules.length > 0
          ? Array.from(new Set(layout.placedModules.map((m) => m.code)))
          : (selectedModuleCodes || []).filter((c) => !c.startsWith('U'));
      setSelectedCodes(
        activeCodes.length > 0 ? activeCodes : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01']
      );
    }
  }, [isOpen, layout]);

  if (!isOpen) return null;

  const toggleCode = (code: string) => {
    // 3 khoang trụ cột là bắt buộc
    if (['F01', 'S01', 'B01'].includes(code)) return;
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectNKBA = () => {
    setSelectedCodes(['F01', 'S01', 'B01', 'D01', 'C01', 'SP01']);
  };

  const handleSelectAll = () => {
    setSelectedCodes(baseCatalog.map((m) => m.code));
  };

  const handleSelectMinimal = () => {
    setSelectedCodes(['F01', 'S01', 'B01']);
  };

  const saveConfig = (autoGenerate = false) => {
    const validBaseCodes = selectedCodes.filter((c) => !c.startsWith('U'));
    const finalCodes = validBaseCodes.length > 0 ? validBaseCodes : ['F01', 'S01', 'B01'];

    if (autoGenerate) {
      initKitchenLayout({
        shape: layout.shape,
        edgeA: { length: Number(lengthA), depth: Number(depthA) },
        edgeB:
          layout.shape === 'L' || layout.shape === 'U'
            ? { length: Number(lengthB), depth: Number(depthB) }
            : undefined,
        edgeC:
          layout.shape === 'U'
            ? { length: Number(lengthC), depth: Number(depthC) }
            : undefined,
        baseModuleCodes: finalCodes,
      });

      setTimeout(() => {
        runLayoutGenerator();
        setActiveTab('generator');
      }, 50);
    } else {
      updateEdgeDimensions('edge_A', {
        length: Number(lengthA),
        depth: Number(depthA),
      });

      if (layout.shape === 'L' || layout.shape === 'U') {
        updateEdgeDimensions('edge_B', {
          length: Number(lengthB),
          depth: Number(depthB),
        });
      }

      if (layout.shape === 'U') {
        updateEdgeDimensions('edge_C', {
          length: Number(lengthC),
          depth: Number(depthC),
        });
      }

      setSelectedModuleCodes(finalCodes);
    }

    onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Khai báo Mặt bằng & Lựa chọn Khoang công năng
              </h3>
              <p className="text-[11px] text-slate-400">
                Bếp chữ {layout.shape} • Tự động sinh thiết kế chỉ từ các khoang được chọn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto flex-1 custom-scrollbar">
          {/* PHẦN 1: KÍCH THƯỚC MẶT BẰNG */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <span>1. Kích thước mặt bằng cần thiết kế</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Kiểu: Bếp chữ {layout.shape}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Cạnh A */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
                <h4 className="font-bold text-sky-400 flex items-center justify-between">
                  <span>Cạnh chính (Cạnh A)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Dọc ngang</span>
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">
                      Chiều dài (mm)
                    </label>
                    <input
                      type="number"
                      min="1200"
                      max="10000"
                      step="50"
                      value={lengthA}
                      onChange={(e) => setLengthA(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">
                      Chiều sâu (mm)
                    </label>
                    <input
                      type="number"
                      min="500"
                      max="1000"
                      step="10"
                      value={depthA}
                      onChange={(e) => setDepthA(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cạnh B (L hoặc U) */}
              {(layout.shape === 'L' || layout.shape === 'U') && (
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
                  <h4 className="font-bold text-emerald-400 flex items-center justify-between">
                    <span>Cạnh vuông góc (Cạnh B)</span>
                    <span className="text-[10px] text-slate-500 font-mono">Bên trái</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">
                        Chiều dài (mm)
                      </label>
                      <input
                        type="number"
                        min="1200"
                        max="10000"
                        step="50"
                        value={lengthB}
                        onChange={(e) => setLengthB(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">
                        Chiều sâu (mm)
                      </label>
                      <input
                        type="number"
                        min="500"
                        max="1000"
                        step="10"
                        value={depthB}
                        onChange={(e) => setDepthB(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cạnh C (U) */}
              {layout.shape === 'U' && (
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5 md:col-span-2">
                  <h4 className="font-bold text-amber-400 flex items-center justify-between">
                    <span>Cạnh đối diện (Cạnh C)</span>
                    <span className="text-[10px] text-slate-500 font-mono">Bên phải</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">
                        Chiều dài (mm)
                      </label>
                      <input
                        type="number"
                        min="1200"
                        max="10000"
                        step="50"
                        value={lengthC}
                        onChange={(e) => setLengthC(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">
                        Chiều sâu (mm)
                      </label>
                      <input
                        type="number"
                        min="500"
                        max="1000"
                        step="10"
                        value={depthC}
                        onChange={(e) => setDepthC(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PHẦN 2: CHỌN KHOANG CÔNG NĂNG TỦ DƯỚI */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <span>2. Chọn khoang công năng Tủ Dưới ({selectedCodes.length} khoang đã chọn)</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Thiết kế tủ dưới sẽ chỉ chọn và bố trí những khoang công năng bạn đánh dấu bên dưới.
                </p>
              </div>

              {/* Nút chọn nhanh */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSelectNKBA}
                  className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-[10px] font-medium transition"
                  title="Bếp + Chậu + Tủ lạnh + Máy rửa bát + Dao thớt + Gia vị"
                >
                  Chuẩn NKBA
                </button>
                <button
                  type="button"
                  onClick={handleSelectMinimal}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition"
                  title="Chỉ 3 khoang trụ cột"
                >
                  Cơ bản
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition"
                  title="Chọn toàn bộ tủ dưới"
                >
                  Tất cả
                </button>
              </div>
            </div>

            {/* Grid khoang công năng Tủ Dưới */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {baseCatalog.map((mod) => {
                const isChecked = selectedCodes.includes(mod.code);
                const isMandatory = ['B01', 'S01', 'F01'].includes(mod.code);
                const variantsText = mod.variants.map((v) => `${v.width}mm`).join(', ');

                return (
                  <div
                    key={mod.id}
                    onClick={() => toggleCode(mod.code)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                      isChecked
                        ? 'bg-slate-800/80 border-sky-500/50 shadow-sm ring-1 ring-sky-500/20'
                        : 'bg-slate-950/40 border-slate-800/70 hover:border-slate-700 text-slate-500 opacity-70'
                    }`}
                  >
                    {/* Checkbox icon */}
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare2 className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    {/* Color dot & category icon */}
                    <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 border border-slate-700/80">
                      {getCategoryIcon(mod.category)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold"
                          style={{
                            backgroundColor: `${mod.color}25`,
                            color: mod.color,
                            border: `1px solid ${mod.color}40`,
                          }}
                        >
                          {mod.code}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            mod.tier === 'upper'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {mod.tier === 'upper' ? 'Tủ Trên' : 'Tủ Dưới'}
                        </span>
                        <span
                          className={`font-semibold text-xs truncate ${
                            isChecked ? 'text-slate-100' : 'text-slate-400'
                          }`}
                        >
                          {mod.name}
                        </span>
                        {isMandatory && (
                          <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                            Bắt buộc
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {mod.description}
                      </div>

                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        Kích thước: {variantsText}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-[11px]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  Đã chọn <strong className="text-sky-400 font-mono">{selectedCodes.length}</strong> khoang công năng. Bấm "Sinh thiết kế ngay" để tạo bố trí tối ưu chỉ từ các khoang này.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-800 bg-slate-950/90 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-medium"
          >
            Hủy
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => saveConfig(false)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Lưu kích thước & Khoang</span>
            </button>

            <button
              onClick={() => saveConfig(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/30 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Lưu & Sinh thiết kế ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
