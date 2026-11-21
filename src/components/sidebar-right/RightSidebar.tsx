import React from 'react';
import {
  useKitchenStore,
  getUpperModuleSpaceInfo,
  getBaseModuleSpaceInfo,
} from '../../store/useKitchenStore';
import { computeUpperGaps, computeBaseGaps } from '../../utils/geometry';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  ArrowLeftRight,
  MoveLeft,
  MoveRight,
  Sparkles,
  Layers,
  SlidersHorizontal,
  Flame,
  Droplets,
  Refrigerator,
  Microwave,
  Archive,
  UtensilsCrossed,
  Ruler,
} from 'lucide-react';

export const RightSidebar: React.FC = () => {
  const {
    layout,
    catalog,
    selectedModuleId,
    validationReport,
    setSelectedModuleId,
    setHighlightedModuleIds,
    removePlacedModule,
    updatePlacedModuleVariant,
    updatePlacedModuleCustomWidth,
    autoFitUpperStorage,
    autoFitBaseStorage,
    moveModule,
  } = useKitchenStore();

  // Khoang đang được chọn
  const selectedModule =
    layout.placedModules.find((m) => m.instanceId === selectedModuleId) ||
    (layout.placedUpperModules || []).find(
      (m) => m.instanceId === selectedModuleId
    );
  const catalogModule = selectedModule
    ? catalog.find((m) => m.id === selectedModule.moduleId)
    : null;

  const modulesOnSameEdge = selectedModule
    ? selectedModule.tier === 'upper'
      ? (layout.placedUpperModules || []).filter(
          (m) => m.edgeId === selectedModule.edgeId
        )
      : layout.placedModules.filter((m) => m.edgeId === selectedModule.edgeId)
    : [];

  const isUpperSelected = selectedModule && selectedModule.tier === 'upper';
  const upperSpaceInfo = isUpperSelected
    ? getUpperModuleSpaceInfo(selectedModule.instanceId, layout)
    : null;

  const isBaseT01Selected = selectedModule && selectedModule.tier !== 'upper' && selectedModule.code === 'T01';
  const baseSpaceInfo = isBaseT01Selected
    ? getBaseModuleSpaceInfo(selectedModule.instanceId, layout)
    : null;

  // Danh sách các khoảng trống còn lại của hệ tủ dưới
  const allBaseGaps = computeBaseGaps(layout);
  const totalBaseGapsMm = allBaseGaps.reduce((sum, g) => sum + g.gapMm, 0);

  // Danh sách các khoảng trống còn lại của hệ tủ trên
  const allUpperGaps = computeUpperGaps(layout);
  const totalUpperGapsMm = allUpperGaps.reduce((sum, g) => sum + g.gapMm, 0);

  // Điểm số và màu sắc
  const score = validationReport.score;
  const scoreColor =
    score >= 90
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : score >= 70
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-red-400 border-red-500/40 bg-red-500/10';

  return (
    <aside className="w-84 h-full flex flex-col bg-slate-900 border-l border-slate-800 z-10 select-none overflow-y-auto">
      {/* 1. KHU VỰC THUỘC TÍNH KHOANG ĐANG CHỌN (INSPECTOR) */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Thuộc tính Khoang</span>
          </span>
          {selectedModule && (
            <button
              onClick={() => setSelectedModuleId(null)}
              className="text-[11px] text-slate-500 hover:text-slate-300"
            >
              Bỏ chọn
            </button>
          )}
        </div>

        {selectedModule ? (
          <div className="space-y-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            {/* Header khoang */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {selectedModule.code}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      selectedModule.tier === 'upper'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedModule.tier === 'upper' ? 'TỦ TRÊN' : 'TỦ DƯỚI'}
                  </span>
                  <h4 className="text-sm font-bold text-slate-100">
                    {selectedModule.name}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Đang đặt tại: {selectedModule.edgeId === 'edge_A' ? 'Cạnh A' : selectedModule.edgeId === 'edge_B' ? 'Cạnh B' : 'Cạnh C'} • Thứ tự #{selectedModule.positionIndex + 1}
                </p>
              </div>

              <button
                onClick={() => removePlacedModule(selectedModule.instanceId)}
                title="Xóa khoang khỏi thiết kế"
                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Kích thước */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Rộng (W)</span>
                <span className="text-xs font-mono font-bold text-sky-400">
                  {selectedModule.width}
                </span>
                <span className="text-[9px] text-slate-500 ml-0.5">mm</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Sâu (D)</span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {selectedModule.depth}
                </span>
                <span className="text-[9px] text-slate-500 ml-0.5">mm</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Cao (H)</span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {selectedModule.height}
                </span>
                <span className="text-[9px] text-slate-500 ml-0.5">mm</span>
              </div>
            </div>

            {/* THÔNG TIN KHOẢNG TRỐNG CHO TỦ TRÊN (EMPTY GAPS & EXPANSION BOUNDS) */}
            {isUpperSelected && upperSpaceInfo && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-amber-400" />
                    <span>Khoảng trống & Khả năng mở rộng:</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-400">
                    Max: {upperSpaceInfo.maxAllowedWidth}mm
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                  <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Trống bên trái</span>
                    <span className="font-mono font-bold text-amber-300">
                      {upperSpaceInfo.leftGap} mm
                    </span>
                  </div>
                  <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Trống bên phải</span>
                    <span className="font-mono font-bold text-amber-300">
                      {upperSpaceInfo.rightGap} mm
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-500/20 text-slate-400">
                  <span>Tổng trống trên cạnh:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {upperSpaceInfo.totalEdgeGap} mm
                  </span>
                </div>
              </div>
            )}

            {/* Chọn Biến thể Kích thước (Variants) */}
            {catalogModule && catalogModule.variants.length > 1 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-400">
                    Đổi biến thể kích thước:
                  </label>
                  {isUpperSelected && upperSpaceInfo && (
                    <span className="text-[10px] text-slate-500">
                      Chống đè khoang
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {catalogModule.variants.map((v) => {
                    const isTooWide = Boolean(
                      isUpperSelected &&
                      upperSpaceInfo &&
                      v.width > upperSpaceInfo.maxAllowedWidth &&
                      v.width > selectedModule.width
                    );

                    return (
                      <button
                        key={v.id}
                        disabled={isTooWide}
                        onClick={() =>
                          updatePlacedModuleVariant(
                            selectedModule.instanceId,
                            v.id
                          )
                        }
                        title={
                          isTooWide
                            ? `Kích thước ${v.width}mm vượt quá khoảng trống tối đa (${upperSpaceInfo?.maxAllowedWidth}mm), không thể chọn để tránh đè khoang`
                            : undefined
                        }
                        className={`py-1 px-2 rounded-lg text-xs font-mono font-medium transition border ${
                          selectedModule.variantId === v.id || selectedModule.width === v.width
                            ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                            : isTooWide
                            ? 'bg-slate-950/40 border-slate-800/40 text-slate-600 cursor-not-allowed line-through'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {v.width}mm
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Thông báo căn tim cho Hút mùi UH01 */}
            {selectedModule.code === 'UH01' && (
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
                <span>Khoang hút mùi luôn tự động căn chuẩn tim Bếp nấu ({selectedModule.width}mm).</span>
              </div>
            )}

            {/* Khoang chậu rửa (S01): Tùy chỉnh linh hoạt từ 830mm đến 900mm (Khuyến nghị mặc định 850mm) */}
            {selectedModule.code === 'S01' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                    <span>Chiều rộng chậu linh hoạt:</span>
                  </label>
                  <span className="text-[10px] text-sky-400 font-mono font-bold">
                    830mm - 900mm (Chuẩn 850mm)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={selectedModule.width <= 830}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.max(830, selectedModule.width - 10)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Giảm 10mm"
                  >
                    -10
                  </button>
                  <button
                    disabled={selectedModule.width <= 830}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.max(830, selectedModule.width - 5)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Giảm 5mm"
                  >
                    -5
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={830}
                      max={900}
                      step={5}
                      value={selectedModule.width}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val) && val >= 830 && val <= 900) {
                          updatePlacedModuleCustomWidth(selectedModule.instanceId, val);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-xs font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 pointer-events-none">
                      mm
                    </span>
                  </div>
                  <button
                    disabled={selectedModule.width >= 900}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.min(900, selectedModule.width + 5)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Tăng 5mm"
                  >
                    +5
                  </button>
                  <button
                    disabled={selectedModule.width >= 900}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.min(900, selectedModule.width + 10)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Tăng 10mm"
                  >
                    +10
                  </button>
                </div>
              </div>
            )}

            {/* Khoang tủ chứa đồ tủ dưới (T01): Tùy chỉnh linh hoạt giống khoang tủ trên (tối thiểu 300mm) */}
            {selectedModule.code === 'T01' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Chiều rộng tủ dưới linh hoạt:</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    300mm - {baseSpaceInfo ? baseSpaceInfo.maxAllowedWidth : 1200}mm
                  </span>
                </div>

                {/* Input số mm trực tiếp + Step buttons */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={selectedModule.width <= 300}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.max(300, selectedModule.width - 50)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Giảm 50mm"
                  >
                    -50
                  </button>
                  <button
                    disabled={selectedModule.width <= 300}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.max(300, selectedModule.width - 10)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Giảm 10mm"
                  >
                    -10
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={300}
                      max={baseSpaceInfo ? baseSpaceInfo.maxAllowedWidth : 1200}
                      step={10}
                      value={selectedModule.width}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val) && val >= 300) {
                          updatePlacedModuleCustomWidth(selectedModule.instanceId, val);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 pointer-events-none">
                      mm
                    </span>
                  </div>
                  <button
                    disabled={Boolean(baseSpaceInfo && selectedModule.width >= baseSpaceInfo.maxAllowedWidth)}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        selectedModule.width + 10
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      baseSpaceInfo && selectedModule.width >= baseSpaceInfo.maxAllowedWidth
                        ? 'Đã đạt kích thước tối đa của cạnh bếp, không thể tăng thêm để tránh tràn cạnh'
                        : 'Tăng 10mm'
                    }
                  >
                    +10
                  </button>
                  <button
                    disabled={Boolean(baseSpaceInfo && selectedModule.width >= baseSpaceInfo.maxAllowedWidth)}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        selectedModule.width + 50
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      baseSpaceInfo && selectedModule.width >= baseSpaceInfo.maxAllowedWidth
                        ? 'Đã đạt kích thước tối đa của cạnh bếp, không thể tăng thêm để tránh tràn cạnh'
                        : 'Tăng 50mm'
                    }
                  >
                    +50
                  </button>
                </div>

                {/* Nút Auto-fit tự động lấp đầy khoảng trống cạnh bếp */}
                <button
                  disabled={Boolean(baseSpaceInfo && (selectedModule.width >= baseSpaceInfo.maxAllowedWidth || baseSpaceInfo.remainingEdgeGap <= 0))}
                  onClick={() => autoFitBaseStorage(selectedModule.instanceId)}
                  className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Tự động tính toán để khoang tủ chứa đồ tủ dưới này lấp đầy toàn bộ khoảng trống còn lại của cạnh bếp"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚡ Tự động lấp đầy cạnh bếp (Auto-Fit)</span>
                </button>

                {/* Trạng thái khoảng trống cạnh bếp */}
                {baseSpaceInfo && (
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                    <span>Khoảng trống cạnh còn lại:</span>
                    <span className={baseSpaceInfo.remainingEdgeGap === 0 ? 'text-emerald-400 font-bold' : 'text-slate-300 font-mono'}>
                      {baseSpaceInfo.remainingEdgeGap === 0 ? 'Vừa khít (0mm)' : `${baseSpaceInfo.remainingEdgeGap}mm`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Chỉ khoang tủ chứa đồ tủ trên (UT01) mới được tùy chỉnh kích cỡ linh động (tối thiểu 300mm) */}
            {selectedModule.code === 'UT01' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Chiều rộng linh hoạt:</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    300mm - {upperSpaceInfo ? upperSpaceInfo.maxAllowedWidth : 1200}mm
                  </span>
                </div>

                {/* Input số mm trực tiếp + Step buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.max(300, selectedModule.width - 50)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold"
                    title="Giảm 50mm"
                  >
                    -50
                  </button>
                  <button
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        Math.max(300, selectedModule.width - 10)
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold"
                    title="Giảm 10mm"
                  >
                    -10
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={300}
                      max={upperSpaceInfo ? upperSpaceInfo.maxAllowedWidth : 1200}
                      step={10}
                      value={selectedModule.width}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val) && val >= 300) {
                          updatePlacedModuleCustomWidth(selectedModule.instanceId, val);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-xs font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 pointer-events-none">
                      mm
                    </span>
                  </div>
                  <button
                    disabled={Boolean(upperSpaceInfo && selectedModule.width >= upperSpaceInfo.maxAllowedWidth)}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        selectedModule.width + 10
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      upperSpaceInfo && selectedModule.width >= upperSpaceInfo.maxAllowedWidth
                        ? 'Đã đạt kích thước tối đa, không thể tăng thêm để tránh đè khoang'
                        : 'Tăng 10mm'
                    }
                  >
                    +10
                  </button>
                  <button
                    disabled={Boolean(upperSpaceInfo && selectedModule.width >= upperSpaceInfo.maxAllowedWidth)}
                    onClick={() =>
                      updatePlacedModuleCustomWidth(
                        selectedModule.instanceId,
                        selectedModule.width + 50
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-mono font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      upperSpaceInfo && selectedModule.width >= upperSpaceInfo.maxAllowedWidth
                        ? 'Đã đạt kích thước tối đa, không thể tăng thêm để tránh đè khoang'
                        : 'Tăng 50mm'
                    }
                  >
                    +50
                  </button>
                </div>

                {/* Nút Auto-fit tự động lấp đầy khoảng trống */}
                <button
                  disabled={Boolean(upperSpaceInfo && selectedModule.width >= upperSpaceInfo.maxAllowedWidth)}
                  onClick={() => autoFitUpperStorage(selectedModule.instanceId)}
                  className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Tự động tính toán để khoang tủ chứa đồ này lấp đầy toàn bộ khoảng trống còn lại"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚡ Tự động lấp đầy khoảng trống (Auto-Fit)</span>
                </button>
              </div>
            )}

            {/* Điều khiển thứ tự vị trí trên cạnh (Dịch trái / Dịch phải) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                  <span>Dịch chuyển thứ tự vị trí:</span>
                </label>
                <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  #{selectedModule.positionIndex + 1} / {modulesOnSameEdge.length} khoang
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={selectedModule.positionIndex === 0}
                  onClick={() =>
                    moveModule(
                      selectedModule.instanceId,
                      selectedModule.edgeId,
                      selectedModule.positionIndex - 1
                    )
                  }
                  className="py-2 px-2.5 rounded-xl bg-slate-950 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-30 disabled:pointer-events-none hover:border-sky-500 shadow-sm"
                  title="Dịch khoang về bên trái (lên trước)"
                >
                  <MoveLeft className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Dịch Trái</span>
                </button>

                <button
                  disabled={
                    selectedModule.positionIndex >= modulesOnSameEdge.length - 1
                  }
                  onClick={() =>
                    moveModule(
                      selectedModule.instanceId,
                      selectedModule.edgeId,
                      selectedModule.positionIndex + 1
                    )
                  }
                  className="py-2 px-2.5 rounded-xl bg-slate-950 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-30 disabled:pointer-events-none hover:border-sky-500 shadow-sm"
                  title="Dịch khoang về bên phải (về sau)"
                >
                  <span>Dịch Phải</span>
                  <MoveRight className="w-4 h-4 text-sky-400 shrink-0" />
                </button>
              </div>
            </div>

            {/* Chuyển sang cạnh khác */}
            {(layout.shape === 'L' || layout.shape === 'U') && (
              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <ArrowLeftRight className="w-3 h-3 text-slate-400" />
                  <span>Chuyển sang cạnh khác:</span>
                </label>
                <div className="flex gap-1.5">
                  <button
                    disabled={selectedModule.edgeId === 'edge_A'}
                    onClick={() =>
                      moveModule(selectedModule.instanceId, 'edge_A', 999)
                    }
                    className="flex-1 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40"
                  >
                    Cạnh A
                  </button>
                  <button
                    disabled={selectedModule.edgeId === 'edge_B'}
                    onClick={() =>
                      moveModule(selectedModule.instanceId, 'edge_B', 999)
                    }
                    className="flex-1 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40"
                  >
                    Cạnh B
                  </button>
                  {layout.shape === 'U' && (
                    <button
                      disabled={selectedModule.edgeId === 'edge_C'}
                      onClick={() =>
                        moveModule(selectedModule.instanceId, 'edge_C', 999)
                      }
                      className="flex-1 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40"
                    >
                      Cạnh C
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 px-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            Chọn một khoang trên bản vẽ 2D để xem và chỉnh sửa thuộc tính.
          </div>
        )}
      </div>

      {/* 1.4 BẢNG THỐNG KÊ KHOẢNG TRỐNG TỦ DƯỚI (BASE EMPTY GAPS OVERVIEW) */}
      {layout.placedModules.length > 0 && (
        <div className="p-3 border-b border-slate-800 bg-slate-950/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-sky-400" />
              <span>Khoảng trống Tủ Dưới còn lại</span>
            </span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              Tổng: {totalBaseGapsMm} mm
            </span>
          </div>

          {allBaseGaps.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {allBaseGaps.map((gap, idx) => (
                <div
                  key={gap.id}
                  className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]"
                >
                  <span className="text-slate-400">
                    {gap.edgeId === 'edge_A'
                      ? 'Cạnh A'
                      : gap.edgeId === 'edge_B'
                      ? 'Cạnh B'
                      : 'Cạnh C'}{' '}
                    • Khoảng #{idx + 1}
                  </span>
                  <span className="font-mono font-bold text-sky-300">
                    {gap.gapMm} mm
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-emerald-400 py-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Hệ tủ dưới đã được lấp đầy hoàn hảo (0 mm trống).</span>
            </div>
          )}
        </div>
      )}

      {/* 1.5 BẢNG THỐNG KÊ KHOẢNG TRỐNG TỦ TRÊN (EMPTY GAPS OVERVIEW) */}
      {(layout.placedUpperModules || []).length > 0 && (
        <div className="p-3 border-b border-slate-800 bg-slate-950/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              <span>Khoảng trống Tủ Trên còn lại</span>
            </span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Tổng: {totalUpperGapsMm} mm
            </span>
          </div>

          {allUpperGaps.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {allUpperGaps.map((gap, idx) => (
                <div
                  key={gap.id}
                  className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]"
                >
                  <span className="text-slate-400">
                    {gap.edgeId === 'edge_A'
                      ? 'Cạnh A'
                      : gap.edgeId === 'edge_B'
                      ? 'Cạnh B'
                      : 'Cạnh C'}{' '}
                    • Khoảng #{idx + 1}
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    {gap.gapMm} mm
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-emerald-400 py-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Hệ tủ trên đã được lấp đầy hoàn hảo (0 mm trống).</span>
            </div>
          )}
        </div>
      )}

      {/* 2. KHU VỰC ĐÁNH GIÁ THIẾT KẾ (DESIGN VALIDATION) */}
      <div className="flex-1 p-4 space-y-4">
        {/* Điểm tổng thể (Overall Score) */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Đánh giá Thiết kế
              </span>
              <h3 className="text-sm font-bold text-slate-200 mt-0.5">
                Chỉ số Tiêu chuẩn NKBA
              </h3>
            </div>
            <div
              className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center font-mono font-bold shadow-inner ${scoreColor}`}
            >
              <span className="text-base leading-none">{score}</span>
              <span className="text-[9px] font-normal opacity-80">/100</span>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
            <div className="bg-slate-900/90 py-1.5 px-1 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Đạt</span>
              <span className="font-bold text-emerald-400">
                {validationReport.passedCount}
              </span>
            </div>
            <div className="bg-slate-900/90 py-1.5 px-1 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Cảnh báo</span>
              <span className="font-bold text-amber-400">
                {validationReport.warningCount}
              </span>
            </div>
            <div className="bg-slate-900/90 py-1.5 px-1 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Lỗi (Hard)</span>
              <span className="font-bold text-red-400">
                {validationReport.failedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Thông số Tam giác công năng */}
        {validationReport.workTriangle.perimeter > 0 && (
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Tam giác Công năng</span>
              </span>
              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  validationReport.workTriangle.isValid
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-amber-400 bg-amber-500/10'
                }`}
              >
                {validationReport.workTriangle.perimeter} mm
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Chậu ➔ Bếp:</span>
                <span className="text-slate-200">
                  {validationReport.workTriangle.sinkToCooktop} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bếp ➔ Tủ lạnh:</span>
                <span className="text-slate-200">
                  {validationReport.workTriangle.cooktopToFridge} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tủ lạnh ➔ Chậu:</span>
                <span className="text-slate-200">
                  {validationReport.workTriangle.fridgeToSink} mm
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Danh sách các vi phạm / cảnh báo chi tiết */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Chi tiết Cảnh báo & Đóng góp ý kiến
            </span>
            <span className="text-[11px] text-slate-500">
              {validationReport.violations.length} mục
            </span>
          </div>

          {validationReport.violations.length === 0 ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <h4 className="text-xs font-bold text-emerald-300">
                Thiết kế hoàn hảo!
              </h4>
              <p className="text-[11px] text-emerald-300/80">
                Bản vẽ đáp ứng đầy đủ tất cả các quy chuẩn kiến trúc và công năng bếp.
              </p>
            </div>
          ) : (
            validationReport.violations.map((violation, vIdx) => {
              const isError = violation.severity === 'ERROR';
              return (
                <div
                  key={vIdx}
                  onClick={() =>
                    setHighlightedModuleIds(violation.involvedModuleIds)
                  }
                  onMouseEnter={() =>
                    setHighlightedModuleIds(violation.involvedModuleIds)
                  }
                  onMouseLeave={() => setHighlightedModuleIds([])}
                  className={`p-3 rounded-xl border cursor-pointer transition space-y-1.5 ${
                    isError
                      ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/60'
                      : 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isError ? (
                      <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        isError
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {violation.ruleCode}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isError ? 'text-red-300' : 'text-amber-300'
                      }`}
                    >
                      {isError ? 'LỖI RÀNG BUỘC' : 'CẢNH BÁO'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-snug">
                    {violation.message}
                  </p>

                  {violation.recommendation && (
                    <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span className="font-semibold text-sky-400">Gợi ý: </span>
                      {violation.recommendation}
                    </div>
                  )}

                  {violation.involvedModuleIds.length > 0 && (
                    <div className="text-[10px] text-slate-500 italic">
                      Click để highlight các khoang liên quan trên bản vẽ
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
