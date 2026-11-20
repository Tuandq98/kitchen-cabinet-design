import React, { useRef, useState, useEffect } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import { calculateLayout2D } from '../../utils/geometry';
import { ModuleSvgItem } from './ModuleSvgItem';
import { UpperCabinetModal } from '../modals/UpperCabinetModal';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Triangle,
  Ruler,
  RotateCcw,
  Layers,
  Sparkles,
  Check,
  Edit3,
  ArrowRight,
  ChefHat,
  SlidersHorizontal,
} from 'lucide-react';

export const KitchenCanvas2D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const {
    layout,
    catalog,
    selectedModuleId,
    highlightedModuleIds,
    zoom,
    pan,
    showWorkTriangle,
    showDimensions,
    validationReport,
    activeCabinetTier,
    designPhase,
    setActiveCabinetTier,
    setDesignPhase,
    confirmBaseAndGenerateUpper,
    regenerateUpperCabinets,
    resetToSetupWizard,
    setSelectedModuleId,
    setZoom,
    setPan,
    resetView,
    toggleWorkTriangle,
    toggleDimensions,
    removePlacedModule,
    moveModule,
    addModuleToEdge,
  } = useKitchenStore();

  const [isUpperModalOpen, setIsUpperModalOpen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Tính toán dữ liệu hình học 2D theo phân tầng
  const layout2D = calculateLayout2D(layout, activeCabinetTier);

  // Xử lý zoom bằng con lăn chuột
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.max(0.2, Math.min(3.5, prev * zoomFactor)));
  };

  // Bắt đầu pan
  const handleMouseDown = (e: React.MouseEvent) => {
    // Chỉ pan khi click chuột trái vào nền hoặc chuột giữa
    if (e.button === 0 || e.button === 1) {
      if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'canvas-bg') {
        setIsPanning(true);
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setSelectedModuleId(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Hỗ trợ Drag & Drop (từ Catalog hoặc Kéo thả sắp xếp lại các khoang trên Canvas)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleReorder = (sourceId: string, targetId: string) => {
    // 1. Kiểm tra nếu cùng là khoang Tủ Dưới
    const sourceBase = layout.placedModules.find((m) => m.instanceId === sourceId);
    const targetBase = layout.placedModules.find((m) => m.instanceId === targetId);
    if (sourceBase && targetBase && sourceBase.edgeId === targetBase.edgeId) {
      moveModule(sourceId, targetBase.edgeId, targetBase.positionIndex);
      return;
    }

    // 2. Kiểm tra nếu cùng là khoang Tủ Trên
    const sourceUpper = (layout.placedUpperModules || []).find((m) => m.instanceId === sourceId);
    const targetUpper = (layout.placedUpperModules || []).find((m) => m.instanceId === targetId);
    if (sourceUpper && targetUpper && sourceUpper.edgeId === targetUpper.edgeId) {
      moveModule(sourceId, targetUpper.edgeId, targetUpper.positionIndex);
      return;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dropX = (e.clientX - rect.left - pan.x) / zoom;
    const dropY = (e.clientY - rect.top - pan.y) / zoom;

    // 1. Di chuyển / Kéo thả khoang đã đặt trên Canvas vào vị trí mới
    const draggedInstanceId = e.dataTransfer.getData('application/kitchen-placed-instance');
    if (draggedInstanceId) {
      const placedUpper = (layout.placedUpperModules || []).find((m) => m.instanceId === draggedInstanceId);
      const placedBase = layout.placedModules.find((m) => m.instanceId === draggedInstanceId);

      if (placedUpper) {
        const edgeUpper = (layout.placedUpperModules || [])
          .filter((m) => m.edgeId === placedUpper.edgeId)
          .sort((a, b) => a.positionIndex - b.positionIndex);

        let targetIndex = edgeUpper.length - 1;
        for (let i = 0; i < edgeUpper.length; i++) {
          const m = edgeUpper[i];
          if (dropX < m.offset + m.width / 2) {
            targetIndex = i;
            break;
          }
        }
        moveModule(draggedInstanceId, placedUpper.edgeId, Math.max(0, targetIndex));
        return;
      }

      if (placedBase) {
        const edgeBase = layout.placedModules
          .filter((m) => m.edgeId === placedBase.edgeId)
          .sort((a, b) => a.positionIndex - b.positionIndex);

        let targetIndex = edgeBase.length - 1;
        for (let i = 0; i < edgeBase.length; i++) {
          const m = edgeBase[i];
          if (dropX < m.offset + m.width / 2) {
            targetIndex = i;
            break;
          }
        }
        moveModule(draggedInstanceId, placedBase.edgeId, Math.max(0, targetIndex));
        return;
      }
    }

    // 2. Thả khoang mới từ Catalog vào Canvas
    const moduleId = e.dataTransfer.getData('application/kitchen-module');
    if (!moduleId) return;

    // Với bếp L hoặc U: nếu dropY > 600 và dropX < 800 thì là Cạnh B
    let targetEdge: 'edge_A' | 'edge_B' | 'edge_C' = 'edge_A';
    if (layout.shape === 'L') {
      if (dropY > 600 && dropX < 800) {
        targetEdge = 'edge_B';
      }
    } else if (layout.shape === 'U') {
      if (dropY > 600 && dropX < 800) {
        targetEdge = 'edge_B';
      } else if (dropY > 600 && dropX > layout.edgeA.length - 800) {
        targetEdge = 'edge_C';
      }
    }

    addModuleToEdge(moduleId, targetEdge);
  };

  // Nút di chuyển trái phải cho module
  const handleMoveLeft = (instanceId: string) => {
    const mod =
      layout.placedModules.find((m) => m.instanceId === instanceId) ||
      (layout.placedUpperModules || []).find((m) => m.instanceId === instanceId);
    if (!mod) return;
    if (mod.positionIndex > 0) {
      moveModule(instanceId, mod.edgeId, mod.positionIndex - 1);
    }
  };

  const handleMoveRight = (instanceId: string) => {
    const mod =
      layout.placedModules.find((m) => m.instanceId === instanceId) ||
      (layout.placedUpperModules || []).find((m) => m.instanceId === instanceId);
    if (!mod) return;
    const sameEdgeCount = (
      mod.tier === 'upper'
        ? (layout.placedUpperModules || []).filter((m) => m.edgeId === mod.edgeId)
        : layout.placedModules.filter((m) => m.edgeId === mod.edgeId)
    ).length;
    if (mod.positionIndex < sameEdgeCount - 1) {
      moveModule(instanceId, mod.edgeId, mod.positionIndex + 1);
    }
  };

  const fitToScreen = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const contentWidth = layout2D.totalWidth + 300;
      const contentHeight = layout2D.totalHeight + 300;

      const scaleX = (containerWidth - 60) / contentWidth;
      const scaleY = (containerHeight - 60) / contentHeight;
      const fitZoom = Math.max(0.12, Math.min(1.0, Math.min(scaleX, scaleY)));

      setZoom(Number(fitZoom.toFixed(2)));
      setPan({
        x: Math.max(30, (containerWidth - contentWidth * fitZoom) / 2 + 40 * fitZoom),
        y: Math.max(30, (containerHeight - contentHeight * fitZoom) / 2 + 40 * fitZoom),
      });
    }
  };

  // Tự động fit view khi mount hoặc thay đổi kích thước bếp
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToScreen();
    }, 100);
    return () => clearTimeout(timer);
  }, [layout.shape, layout.edgeA.length, layout.edgeB?.length, layout.edgeC?.length, activeCabinetTier]);

  // Xác định khoang nào đang bị vi phạm
  const violatedInstanceIds = new Set(
    validationReport.violations.flatMap((v) => v.involvedModuleIds)
  );
  highlightedModuleIds.forEach((id) => violatedInstanceIds.add(id));

  // Tọa độ bounding box tổng thể cho view
  const padding = 200;
  const viewBoxWidth = layout2D.totalWidth + padding * 2;
  const viewBoxHeight = layout2D.totalHeight + padding * 2;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Blueprint Grid Layer */}
      <div className="absolute inset-0 blueprint-grid pointer-events-none opacity-40" />

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
        <button
          onClick={() => setZoom((z) => Math.min(3.5, z + 0.15))}
          title="Phóng to"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
          title="Thu nhỏ"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="text-xs font-mono text-slate-400 px-2 min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={fitToScreen}
          title="Thu phóng vừa màn hình (Fit view)"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-5 bg-slate-800 mx-1" />
        <button
          onClick={toggleWorkTriangle}
          title="Bật/Tắt Tam giác công năng"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
            showWorkTriangle
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Triangle className="w-3.5 h-3.5" />
          <span>Tam giác công năng</span>
        </button>
        <button
          onClick={toggleDimensions}
          title="Bật/Tắt đường kích thước"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
            showDimensions
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>Kích thước</span>
        </button>
      </div>

      {/* WORKFLOW STEP & ACTION BAR (PHÂN GIAI ĐOẠN THIẾT KẾ: TỦ DƯỚI ➔ TỦ TRÊN) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-2xl">
        {/* Step 1 Indicator */}
        <button
          onClick={() => setDesignPhase('design_base')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            designPhase === 'design_base'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Chuyển sang Bước 1: Thiết kế & Sắp xếp Tủ Dưới"
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              designPhase === 'design_base'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            1
          </span>
          <span>B1: Tủ Dưới</span>
          {designPhase === 'design_base' && (
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          )}
        </button>

        <span className="text-slate-600 font-bold">➔</span>

        {/* Step 2 Indicator */}
        <button
          onClick={() => {
            if ((layout.placedUpperModules || []).length > 0) {
              setDesignPhase('design_upper');
            } else {
              setIsUpperModalOpen(true);
            }
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            designPhase === 'design_upper'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Chuyển sang Bước 2: Tinh chỉnh Tủ Trên"
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              designPhase === 'design_upper'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            2
          </span>
          <span>B2: Tủ Trên</span>
          {(layout.placedUpperModules || []).length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">
              {layout.placedUpperModules?.length}
            </span>
          )}
        </button>

        <div className="w-[1px] h-6 bg-slate-700/80 mx-1" />

        {/* Dynamic Action Button */}
        {designPhase === 'design_base' ? (
          <button
            onClick={() => setIsUpperModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-500/25 flex items-center gap-1.5 transition active:scale-95 animate-pulse"
            title="Mở bảng lựa chọn khoang công năng tủ trên và tạo tủ trên"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Xác nhận Tủ Dưới & Chọn Tủ Trên ➔</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsUpperModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition"
              title="Mở lại bảng chọn khoang công năng tủ trên để cập nhật"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Chọn lại Tủ Trên</span>
            </button>
            <button
              onClick={() => setDesignPhase('design_base')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
              title="Quay lại chỉnh sửa Tủ Dưới"
            >
              <Edit3 className="w-3.5 h-3.5 text-sky-400" />
              <span>Sửa Tủ Dưới</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State Prompt nếu chưa có khoang nào (Khởi tạo mới) */}
      {layout.placedModules.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm pointer-events-none">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-7 text-center max-w-md shadow-2xl pointer-events-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-sky-500/20">
              <ChefHat className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bắt đầu thiết kế mặt bằng bếp</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Vui lòng chọn kiểu dáng bếp (chữ I, L hoặc U), nhập kích thước các cạnh tường và chọn các khoang công năng tủ dưới.
              </p>
            </div>
            <button
              onClick={resetToSetupWizard}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>🚀 Khởi tạo & Chọn Mẫu Bếp Mới ➔</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal lựa chọn khoang công năng Tủ Trên */}
      <UpperCabinetModal
        isOpen={isUpperModalOpen}
        onClose={() => setIsUpperModalOpen(false)}
      />

      {/* Floating Status & Help Badge */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Tỉ lệ: 1:1 CAD (mm) • Cuộn chuột để Zoom • Kéo chuột để Pan</span>
      </div>

      {/* MAIN SVG 2D CAD CANVAS */}
      <svg
        ref={svgRef}
        id="canvas-bg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Arrowhead marker for dimensions */}
          <marker
            id="dim-arrow-start"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
          </marker>
          <marker
            id="dim-arrow-end"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Cụm chứa nội dung có zoom & pan */}
        <g
          id="viewport-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* BẮT ĐẦU VẼ BẢN THIẾT KẾ KỸ THUẬT */}
          <g transform={`translate(${Math.max(80, -layout2D.minX + 80)}, 100)`}>
          {/* 1. KHUNG ĐƯỜNG BAO CỦA CẠNH BẾP (Backdrop / Wall Line) & BANNER PHÂN TẦNG */}
          <g className="kitchen-walls">
            {/* Nếu hiển thị Tất cả (2 Tầng) */}
            {activeCabinetTier === 'all' && (
              <>
                {/* 1.1 Khung Cạnh A Tủ Trên */}
                <rect
                  x={0}
                  y={0}
                  width={layout.edgeA.length}
                  height={layout.upperDepth || 350}
                  fill="#061325"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                {/* Banner Dòng Tủ Trên */}
                <g transform="translate(0, -16)">
                  <rect x="0" y="-24" width="280" height="28" rx="6" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="140" y="-6" textAnchor="middle" fill="#bae6fd" fontSize="13" fontWeight="800">
                    ▲ DÒNG TỦ TRÊN (SÂU {layout.upperDepth || 350}mm)
                  </text>
                </g>

                {/* 1.2 Khung Cạnh A Tủ Dưới */}
                <rect
                  x={0}
                  y={500}
                  width={layout.edgeA.length}
                  height={layout.edgeA.depth}
                  fill="#090d16"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                {/* Banner Dòng Tủ Dưới */}
                <g transform="translate(0, 484)">
                  <rect x="0" y="-24" width="280" height="28" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <text x="140" y="-6" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="800">
                    ▼ DÒNG TỦ DƯỚI (SÂU {layout.edgeA.depth}mm)
                  </text>
                </g>

                {/* Cạnh B (L hoặc U) */}
                {layout.edgeB && (
                  <>
                    {/* Cạnh B Tủ Dưới */}
                    <rect
                      x={0}
                      y={500}
                      width={layout.edgeB.depth}
                      height={layout.edgeB.length}
                      fill="#090d16"
                      stroke="#334155"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    {/* Cạnh B Tủ Trên */}
                    <rect
                      x={-500}
                      y={0}
                      width={layout.upperDepth || 350}
                      height={layout.edgeB.length}
                      fill="#061325"
                      stroke="#0284c7"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  </>
                )}

                {/* Cạnh C (U) */}
                {layout.edgeC && (
                  <>
                    <rect
                      x={layout.edgeA.length - (layout.edgeC.depth || 600)}
                      y={500}
                      width={layout.edgeC.depth || 600}
                      height={layout.edgeC.length}
                      fill="#090d16"
                      stroke="#334155"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    <rect
                      x={layout.edgeA.length + 150}
                      y={0}
                      width={layout.upperDepth || 350}
                      height={layout.edgeC.length}
                      fill="#061325"
                      stroke="#0284c7"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  </>
                )}
              </>
            )}

            {/* Nếu chỉ hiển thị Đơn tầng (Tủ Dưới hoặc Tủ Trên) */}
            {activeCabinetTier !== 'all' && (
              <>
                <rect
                  x={0}
                  y={0}
                  width={layout.edgeA.length}
                  height={activeCabinetTier === 'upper' ? layout.upperDepth || 350 : layout.edgeA.depth}
                  fill="#090d16"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <g transform="translate(0, -16)">
                  <rect x="0" y="-24" width="280" height="28" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <text x="140" y="-6" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="800">
                    {activeCabinetTier === 'upper'
                      ? `HỆ TỦ TRÊN (SÂU ${layout.upperDepth || 350}mm)`
                      : `HỆ TỦ DƯỚI (SÂU ${layout.edgeA.depth}mm)`}
                  </text>
                </g>

                {layout.edgeB && (
                  <rect
                    x={0}
                    y={0}
                    width={activeCabinetTier === 'upper' ? layout.upperDepth || 350 : layout.edgeB.depth}
                    height={layout.edgeB.length}
                    fill="#090d16"
                    stroke="#334155"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}
                {layout.edgeC && (
                  <rect
                    x={layout.edgeA.length - (activeCabinetTier === 'upper' ? layout.upperDepth || 350 : layout.edgeC.depth || 600)}
                    y={0}
                    width={activeCabinetTier === 'upper' ? layout.upperDepth || 350 : layout.edgeC.depth || 600}
                    height={layout.edgeC.length}
                    fill="#090d16"
                    stroke="#334155"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}
              </>
            )}
          </g>

          {/* 1.2 VÙNG CHỈ BÁO TỦ CAO TRÊN DÒNG TỦ TRÊN (Tủ trên chỉ thiết kế vào khoảng trống) */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'upper') && (
            <g className="tall-unit-upper-reservations pointer-events-none">
              {layout2D.modules
                .filter((m) => {
                  const placed = layout.placedModules.find((p) => p.instanceId === m.instanceId);
                  return (
                    m.code === 'F01' ||
                    m.code === 'P01' ||
                    m.code === 'A01'
                  );
                })
                .map((tall) => {
                  const upperY = 0;
                  const upperH = layout.upperDepth || 350;
                  return (
                    <g key={`tall-res-${tall.instanceId}`}>
                      <rect
                        x={tall.x}
                        y={upperY}
                        width={tall.width}
                        height={upperH}
                        fill="#1e1b4b"
                        fillOpacity="0.55"
                        stroke="#818cf8"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        rx="6"
                      />
                      {/* Vạch chéo trang trí khu vực tủ cao */}
                      <line
                        x1={tall.x}
                        y1={upperY}
                        x2={tall.x + tall.width}
                        y2={upperY + upperH}
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.4"
                      />
                      <line
                        x1={tall.x + tall.width}
                        y1={upperY}
                        x2={tall.x}
                        y2={upperY + upperH}
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.4"
                      />
                      <rect
                        x={tall.centerX - 105}
                        y={upperY + upperH / 2 - 28}
                        width="210"
                        height="56"
                        rx="10"
                        fill="#090d16"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                      />
                      <text
                        x={tall.centerX}
                        y={upperY + upperH / 2 - 4}
                        textAnchor="middle"
                        fill="#c7d2fe"
                        fontSize="14"
                        fontWeight="800"
                      >
                        🚫 VÙNG TỦ CAO
                      </text>
                      <text
                        x={tall.centerX}
                        y={upperY + upperH / 2 + 16}
                        textAnchor="middle"
                        fill="#818cf8"
                        fontSize="12"
                        fontWeight="600"
                      >
                        ({tall.name})
                      </text>
                    </g>
                  );
                })}
            </g>
          )}

          {/* 2. CÁC GÓC NỐI (CORNER JOINTS) TỦ DƯỚI */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'base') &&
            layout2D.corners.map((corner) => (
              <g key={corner.id} className="corner-joint">
                <rect
                  x={corner.x}
                  y={corner.y}
                  width={corner.width}
                  height={corner.height}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                {/* Vạch chéo góc chết kiến trúc */}
                <line
                  x1={corner.x}
                  y1={corner.y}
                  x2={corner.x + corner.width}
                  y2={corner.y + corner.height}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <line
                  x1={corner.x + corner.width}
                  y1={corner.y}
                  x2={corner.x}
                  y2={corner.y + corner.height}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <rect
                  x={corner.x + corner.width / 2 - 110}
                  y={corner.y + corner.height / 2 - 32}
                  width="220"
                  height="64"
                  rx="12"
                  fill="#090d16"
                  stroke="#64748b"
                  strokeWidth="2.5"
                />
                <text
                  x={corner.x + corner.width / 2}
                  y={corner.y + corner.height / 2 + 12}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="40"
                  fontWeight="900"
                  letterSpacing="1px"
                >
                  GÓC NỐI
                </text>
              </g>
            ))}

          {/* 3. CÁC GÓC NỐI (CORNER JOINTS) TỦ TRÊN */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'upper') &&
            layout2D.upperCorners.map((corner) => (
              <g key={corner.id} className="upper-corner-joint">
                <rect
                  x={corner.x}
                  y={corner.y}
                  width={corner.width}
                  height={corner.height}
                  fill="#0c4a6e"
                  fillOpacity="0.85"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <text
                  x={corner.x + corner.width / 2}
                  y={corner.y + corner.height / 2 + 6}
                  textAnchor="middle"
                  fill="#bae6fd"
                  fontSize="24"
                  fontWeight="900"
                >
                  GÓC TỦ TRÊN
                </text>
              </g>
            ))}

          {/* 4. CÁC KHOANG CÔNG NĂNG TỦ DƯỚI (BASE MODULES) */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'base') &&
            layout2D.modules.map((box) => {
              const placed = layout.placedModules.find(
                (m) => m.instanceId === box.instanceId
              );
              if (!placed) return null;

              return (
                <ModuleSvgItem
                  key={box.instanceId}
                  box={box}
                  placedModule={placed}
                  isSelected={selectedModuleId === box.instanceId}
                  isViolated={violatedInstanceIds.has(box.instanceId)}
                  onSelect={(id) => setSelectedModuleId(id)}
                  onDelete={(id) => removePlacedModule(id)}
                  onMoveLeft={handleMoveLeft}
                  onMoveRight={handleMoveRight}
                  onReorder={handleReorder}
                />
              );
            })}

          {/* 5. CÁC KHOANG CÔNG NĂNG TỦ TRÊN (UPPER MODULES) */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'upper') &&
            layout2D.upperModules.map((box) => {
              const placed = (layout.placedUpperModules || []).find(
                (m) => m.instanceId === box.instanceId
              );
              if (!placed) return null;

              return (
                <ModuleSvgItem
                  key={box.instanceId}
                  box={box}
                  placedModule={placed}
                  isSelected={selectedModuleId === box.instanceId}
                  isViolated={violatedInstanceIds.has(box.instanceId)}
                  onSelect={(id) => setSelectedModuleId(id)}
                  onDelete={(id) => removePlacedModule(id)}
                  onMoveLeft={handleMoveLeft}
                  onMoveRight={handleMoveRight}
                  onReorder={handleReorder}
                />
              );
            })}

          {/* 5.1 CÁC KHOẢNG TRỐNG CÒN LẠI CỦA TỦ TRÊN (UPPER EMPTY GAPS) */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'upper') &&
            layout2D.upperGaps &&
            layout2D.upperGaps.map((gap) => (
              <g key={gap.id} className="upper-empty-gap">
                {/* Khung ô khoảng trống nét đứt màu hổ phách kiến trúc */}
                <rect
                  x={gap.x}
                  y={gap.y}
                  width={gap.width}
                  height={gap.height}
                  fill="#f59e0b"
                  fillOpacity="0.08"
                  stroke="#f59e0b"
                  strokeWidth="1.8"
                  strokeDasharray="6 4"
                  rx="4"
                />

                {/* Vạch chéo kỹ thuật thể hiện khoảng không chờ */}
                <line
                  x1={gap.x}
                  y1={gap.y}
                  x2={gap.x + gap.width}
                  y2={gap.y + gap.height}
                  stroke="#f59e0b"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1={gap.x + gap.width}
                  y1={gap.y}
                  x2={gap.x}
                  y2={gap.y + gap.height}
                  stroke="#f59e0b"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Badge hiển thị độ rộng khoảng trống chuẩn xác mm */}
                <g
                  transform={`translate(${gap.centerX}, ${gap.centerY}) rotate(${gap.rotation || 0})`}
                  className="pointer-events-none"
                >
                  {gap.gapMm >= 180 ? (
                    <>
                      <rect
                        x="-72"
                        y="-16"
                        width="144"
                        height="32"
                        rx="8"
                        fill="#18181b"
                        fillOpacity="0.96"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="5"
                        textAnchor="middle"
                        fill="#fbbf24"
                        fontSize="13"
                        fontWeight="800"
                        fontFamily="monospace"
                        letterSpacing="0.5px"
                      >
                        TRỐNG: {gap.gapMm} mm
                      </text>
                    </>
                  ) : gap.gapMm >= 80 ? (
                    <>
                      <rect
                        x="-48"
                        y="-14"
                        width="96"
                        height="28"
                        rx="6"
                        fill="#18181b"
                        fillOpacity="0.96"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="#fbbf24"
                        fontSize="12"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        Trống {gap.gapMm}
                      </text>
                    </>
                  ) : (
                    <>
                      <rect
                        x="-30"
                        y="-12"
                        width="60"
                        height="24"
                        rx="5"
                        fill="#18181b"
                        fillOpacity="0.96"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="#fbbf24"
                        fontSize="11"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {gap.gapMm}
                      </text>
                    </>
                  )}
                </g>
              </g>
            ))}

          {/* 6. ĐƯỜNG GIÓNG CĂN TIM (ALIGNMENT GUIDE LINES) GIỮA TỦ DƯỚI & TỦ TRÊN */}
          {activeCabinetTier === 'all' && (() => {
            const cook = layout2D.modules.find((m) => m.code === 'B01');
            const hood = layout2D.upperModules.find((m) => m.code === 'UH01');
            const sink = layout2D.modules.find((m) => m.code === 'S01');
            const fixedDish = layout2D.upperModules.find((m) => m.code === 'UB02');
            const anyDish = layout2D.upperModules.find((m) =>
              ['UB01', 'UB02', 'UB03'].includes(m.code)
            );
            const targetDish = fixedDish || anyDish;
            const dw = layout2D.modules.find((m) => m.code === 'D01');
            const pullDown = layout2D.upperModules.find((m) =>
              ['UB01', 'UB03'].includes(m.code)
            );

            return (
              <g className="alignment-guides pointer-events-none">
                {/* 1. Tim Bếp <-> Tim Hút Mùi */}
                {cook && hood && (
                  <g>
                    <line
                      x1={cook.centerX}
                      y1={cook.centerY}
                      x2={hood.centerX}
                      y2={hood.centerY}
                      stroke="#f43f5e"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                    />
                    <circle cx={cook.centerX} cy={cook.centerY} r="10" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                    <circle cx={hood.centerX} cy={hood.centerY} r="10" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
                    <g transform={`translate(${(cook.centerX + hood.centerX) / 2}, ${(cook.centerY + hood.centerY) / 2})`}>
                      <rect x="-85" y="-18" width="170" height="36" rx="8" fill="#881337" stroke="#fda4af" strokeWidth="2" />
                      <text x="0" y="6" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="800">
                        {Math.abs(hood.centerX - cook.centerX) <= 30
                          ? '✓ THẲNG TIM BẾP'
                          : '⚠ LỆCH TIM BẾP'}
                      </text>
                    </g>
                  </g>
                )}

                {/* 2. Tim Chậu <-> Tim Giá Bát */}
                {sink && targetDish && (
                  <g>
                    <line
                      x1={sink.centerX}
                      y1={sink.centerY}
                      x2={targetDish.centerX}
                      y2={targetDish.centerY}
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                    />
                    <circle cx={sink.centerX} cy={sink.centerY} r="10" fill="#0ea5e9" stroke="#ffffff" strokeWidth="2" />
                    <circle cx={targetDish.centerX} cy={targetDish.centerY} r="10" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                    <g transform={`translate(${(sink.centerX + targetDish.centerX) / 2}, ${(sink.centerY + targetDish.centerY) / 2})`}>
                      <rect x="-85" y="-18" width="170" height="36" rx="8" fill="#0369a1" stroke="#7dd3fc" strokeWidth="2" />
                      <text x="0" y="6" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="800">
                        {Math.abs(targetDish.centerX - sink.centerX) <= 30
                          ? '✓ THẲNG TIM CHẬU'
                          : '⚠ LỆCH TIM CHẬU'}
                      </text>
                    </g>
                  </g>
                )}

                {/* 3. Máy Rửa Bát <-> Giá Bát Nâng Hạ (Nếu có cả 2 giá bát) */}
                {dw && pullDown && targetDish?.instanceId !== pullDown.instanceId && (
                  <g>
                    <line
                      x1={dw.centerX}
                      y1={dw.centerY}
                      x2={pullDown.centerX}
                      y2={pullDown.centerY}
                      stroke="#818cf8"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    <circle cx={dw.centerX} cy={dw.centerY} r="8" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
                    <circle cx={pullDown.centerX} cy={pullDown.centerY} r="8" fill="#818cf8" stroke="#ffffff" strokeWidth="2" />
                    <g transform={`translate(${(dw.centerX + pullDown.centerX) / 2}, ${(dw.centerY + pullDown.centerY) / 2})`}>
                      <rect x="-105" y="-18" width="210" height="36" rx="8" fill="#312e81" stroke="#a5b4fc" strokeWidth="2" />
                      <text x="0" y="6" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="800">
                        {Math.abs(pullDown.centerX - dw.centerX) <= 60
                          ? '✓ GIÁ BÁT TRÊN MÁY RỬA'
                          : 'GIÁ BÁT NÂNG HẠ'}
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })()}

          {/* 4. TAM GIÁC CÔNG NĂNG (WORK TRIANGLE) OVERLAY */}
          {showWorkTriangle && validationReport.workTriangle.sinkCoord && (
            <g className="work-triangle-overlay pointer-events-none">
              {/* 3 Đỉnh tam giác */}
              {(() => {
                const wt = validationReport.workTriangle;
                const sc = wt.sinkCoord!;
                const cc = wt.cooktopCoord!;
                const fc = wt.fridgeCoord!;

                return (
                  <>
                    {/* Đường viền tam giác phát sáng */}
                    <polygon
                      points={`${sc.x},${sc.y} ${cc.x},${cc.y} ${fc.x},${fc.y}`}
                      fill="rgba(245, 158, 11, 0.08)"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                    />

                    {/* Điểm Chậu */}
                    <circle cx={sc.x} cy={sc.y} r="14" fill="#0ea5e9" stroke="#ffffff" strokeWidth="3" />
                    {/* Điểm Bếp */}
                    <circle cx={cc.x} cy={cc.y} r="14" fill="#ef4444" stroke="#ffffff" strokeWidth="3" />
                    {/* Điểm Tủ lạnh */}
                    <circle cx={fc.x} cy={fc.y} r="14" fill="#3b82f6" stroke="#ffffff" strokeWidth="3" />

                    {/* Nhãn khoảng cách trên các cạnh tam giác - To rõ */}
                    {/* Chậu -> Bếp */}
                    <g transform={`translate(${(sc.x + cc.x) / 2}, ${(sc.y + cc.y) / 2})`}>
                      <rect x="-90" y="-28" width="180" height="56" rx="12" fill="#090d16" stroke="#f59e0b" strokeWidth="2.5" />
                      <text x="0" y="10" textAnchor="middle" fill="#fbbf24" fontSize="30" fontWeight="800" fontFamily="monospace">
                        {wt.sinkToCooktop}mm
                      </text>
                    </g>
                    {/* Bếp -> Tủ lạnh */}
                    <g transform={`translate(${(cc.x + fc.x) / 2}, ${(cc.y + fc.y) / 2})`}>
                      <rect x="-90" y="-28" width="180" height="56" rx="12" fill="#090d16" stroke="#f59e0b" strokeWidth="2.5" />
                      <text x="0" y="10" textAnchor="middle" fill="#fbbf24" fontSize="30" fontWeight="800" fontFamily="monospace">
                        {wt.cooktopToFridge}mm
                      </text>
                    </g>
                    {/* Tủ lạnh -> Chậu */}
                    <g transform={`translate(${(fc.x + sc.x) / 2}, ${(fc.y + sc.y) / 2})`}>
                      <rect x="-90" y="-28" width="180" height="56" rx="12" fill="#090d16" stroke="#f59e0b" strokeWidth="2.5" />
                      <text x="0" y="10" textAnchor="middle" fill="#fbbf24" fontSize="30" fontWeight="800" fontFamily="monospace">
                        {wt.fridgeToSink}mm
                      </text>
                    </g>

                    {/* Badge tổng chu vi tam giác */}
                    <g transform={`translate(${(sc.x + cc.x + fc.x) / 3}, ${(sc.y + cc.y + fc.y) / 3})`}>
                      <rect x="-160" y="-35" width="320" height="70" rx="16" fill="#1e1b4b" stroke="#818cf8" strokeWidth="3" />
                      <text x="0" y="11" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="900">
                        Chu vi TG: {wt.perimeter}mm
                      </text>
                    </g>
                  </>
                );
              })()}
            </g>
          )}

          {/* 5. ĐƯỜNG KÍCH THƯỚC TỔNG THỂ (DIMENSION LINES) */}
          {showDimensions && (
            <g className="dimension-lines pointer-events-none">
              {/* Kích thước Cạnh A (Phía trên) - Cỡ to rõ chuẩn CAD */}
              <g transform="translate(0, -60)">
                <line
                  x1={0}
                  y1={0}
                  x2={layout.edgeA.length}
                  y2={0}
                  stroke="#38bdf8"
                  strokeWidth="3"
                  markerStart="url(#dim-arrow-start)"
                  markerEnd="url(#dim-arrow-end)"
                />
                <line x1={0} y1={-12} x2={0} y2={60} stroke="#38bdf8" strokeWidth="2" opacity="0.6" />
                <line
                  x1={layout.edgeA.length}
                  y1={-12}
                  x2={layout.edgeA.length}
                  y2={60}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  opacity="0.6"
                />
                <rect
                  x={layout.edgeA.length / 2 - 110}
                  y={-28}
                  width="220"
                  height="56"
                  rx="12"
                  fill="#090d16"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                />
                <text
                  x={layout.edgeA.length / 2}
                  y={10}
                  textAnchor="middle"
                  fill="#7dd3fc"
                  fontSize="34"
                  fontWeight="800"
                  fontFamily="monospace"
                >
                  {layout.edgeA.length} mm
                </text>
              </g>

              {/* Kích thước Cạnh B (Bên trái) nếu có */}
              {layout.edgeB && (
                <g transform="translate(-75, 0)">
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={layout.edgeB.length}
                    stroke="#38bdf8"
                    strokeWidth="3"
                    markerStart="url(#dim-arrow-start)"
                    markerEnd="url(#dim-arrow-end)"
                  />
                  <line x1={-12} y1={0} x2={75} y2={0} stroke="#38bdf8" strokeWidth="2" opacity="0.6" />
                  <line
                    x1={-12}
                    y1={layout.edgeB.length}
                    x2={75}
                    y2={layout.edgeB.length}
                    stroke="#38bdf8"
                    strokeWidth="2"
                    opacity="0.6"
                  />
                  <rect
                    x={-110}
                    y={layout.edgeB.length / 2 - 28}
                    width="220"
                    height="56"
                    rx="12"
                    fill="#090d16"
                    stroke="#0284c7"
                    strokeWidth="2.5"
                  />
                  <text
                    x={0}
                    y={layout.edgeB.length / 2 + 10}
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontSize="34"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    {layout.edgeB.length} mm
                  </text>
                </g>
              )}

              {/* Kích thước Cạnh C (Bên phải) nếu có */}
              {layout.edgeC && (
                <g transform={`translate(${layout.edgeA.length + 75}, 0)`}>
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={layout.edgeC.length}
                    stroke="#38bdf8"
                    strokeWidth="3"
                    markerStart="url(#dim-arrow-start)"
                    markerEnd="url(#dim-arrow-end)"
                  />
                  <line x1={-75} y1={0} x2={12} y2={0} stroke="#38bdf8" strokeWidth="2" opacity="0.6" />
                  <line
                    x1={-75}
                    y1={layout.edgeC.length}
                    x2={12}
                    y2={layout.edgeC.length}
                    stroke="#38bdf8"
                    strokeWidth="2"
                    opacity="0.6"
                  />
                  <rect
                    x={-110}
                    y={layout.edgeC.length / 2 - 28}
                    width="220"
                    height="56"
                    rx="12"
                    fill="#090d16"
                    stroke="#0284c7"
                    strokeWidth="2.5"
                  />
                  <text
                    x={0}
                    y={layout.edgeC.length / 2 + 10}
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontSize="34"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    {layout.edgeC.length} mm
                  </text>
                </g>
              )}
            </g>
          )}
        </g>
        </g>
      </svg>
    </div>
  );
};
