import React, { useRef, useState, useEffect } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import { calculateLayout2D, Module2DBox, Layout2DBounds } from '../../utils/geometry';
import { KitchenLayout } from '../../types';
import { ModuleSvgItem } from './ModuleSvgItem';
import { UpperCabinetModal } from '../modals/UpperCabinetModal';

interface DragCandidate {
  box: Module2DBox;
  tier: 'base' | 'upper';
  startX: number;
  startY: number;
}

interface ActiveDragState {
  box: Module2DBox;
  tier: 'base' | 'upper';
  clientX: number;
  clientY: number;
  modelX: number;
  modelY: number;
  targetEdge: 'edge_A' | 'edge_B' | 'edge_C';
  targetIndex: number;
  isValid: boolean;
  invalidReason?: string;
  indicator: {
    isVertical: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    badgeX: number;
    badgeY: number;
    label: string;
    isValid: boolean;
  };
}

interface DropTargetResult {
  edgeId: 'edge_A' | 'edge_B' | 'edge_C';
  targetIndex: number;
  isValid: boolean;
  invalidReason?: string;
  indicator: {
    isVertical: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    badgeX: number;
    badgeY: number;
    label: string;
    isValid: boolean;
  };
}

function calculateDropTarget(params: {
  modelX: number;
  modelY: number;
  tier: 'base' | 'upper';
  draggedBox: Module2DBox | null;
  layout: KitchenLayout;
  layout2D: Layout2DBounds;
  activeCabinetTier: 'all' | 'base' | 'upper';
}): DropTargetResult {
  const { modelX, modelY, tier, draggedBox, layout, layout2D, activeCabinetTier } = params;
  const is2Row = activeCabinetTier === 'all';
  const shape = layout.shape;
  const upperDepth = layout.upperDepth || 350;
  const GAP = 150;
  const baseRowY = is2Row ? upperDepth + GAP : 0;
  const lengthA = layout.edgeA.length;
  const depthA = layout.edgeA.depth || 600;
  const depthB = layout.edgeB?.depth || 600;
  const depthC = layout.edgeC?.depth || 600;

  // 1. KIỂM TRA PHÂN TẦNG TUYỆT ĐỐI (Strict Tier Isolation)
  // Tủ trên CHỈ kéo thả đặt vào tủ trên, tủ dưới CHỈ kéo thả đặt vào tủ dưới!
  let isValid = true;
  let invalidReason = '';

  if (is2Row) {
    if (tier === 'base' && modelY < baseRowY - 60) {
      isValid = false;
      invalidReason = 'Tủ dưới không thể đặt vào tầng Tủ Trên';
    } else if (tier === 'upper' && modelY >= baseRowY + 60) {
      isValid = false;
      invalidReason = 'Tủ trên không thể đặt vào tầng Tủ Dưới';
    }
  } else if (activeCabinetTier === 'base' && tier === 'upper') {
    isValid = false;
    invalidReason = 'Tủ trên không thể đặt vào tầng Tủ Dưới';
  } else if (activeCabinetTier === 'upper' && tier === 'base') {
    isValid = false;
    invalidReason = 'Tủ dưới không thể đặt vào tầng Tủ Trên';
  }

  // 2. Xác định Cạnh mục tiêu (targetEdge) theo tọa độ không gian 2D
  let targetEdge: 'edge_A' | 'edge_B' | 'edge_C' = 'edge_A';

  if (shape === 'L') {
    if (tier === 'base') {
      if (modelX < depthB + 300 && modelY > baseRowY + 150) {
        targetEdge = 'edge_B';
      } else {
        targetEdge = 'edge_A';
      }
    } else {
      if (is2Row) {
        if (modelX < 100) {
          targetEdge = 'edge_B';
        } else {
          targetEdge = 'edge_A';
        }
      } else {
        if (modelX < upperDepth + 250 && modelY > 150) {
          targetEdge = 'edge_B';
        } else {
          targetEdge = 'edge_A';
        }
      }
    }
  } else if (shape === 'U') {
    if (tier === 'base') {
      if (modelX < depthB + 300 && modelY > baseRowY + 150) {
        targetEdge = 'edge_B';
      } else if (modelX > lengthA - depthC - 300 && modelY > baseRowY + 150) {
        targetEdge = 'edge_C';
      } else if (modelY > baseRowY + depthA + 100) {
        targetEdge = modelX < lengthA / 2 ? 'edge_B' : 'edge_C';
      } else {
        if (modelX < depthB) targetEdge = 'edge_B';
        else if (modelX > lengthA - depthC) targetEdge = 'edge_C';
        else targetEdge = 'edge_A';
      }
    } else {
      if (is2Row) {
        if (modelX < 100) {
          targetEdge = 'edge_B';
        } else if (modelX > lengthA - 100) {
          targetEdge = 'edge_C';
        } else {
          targetEdge = 'edge_A';
        }
      } else {
        if (modelX < upperDepth + 250 && modelY > 150) {
          targetEdge = 'edge_B';
        } else if (modelX > lengthA - upperDepth - 250 && modelY > 150) {
          targetEdge = 'edge_C';
        } else {
          targetEdge = 'edge_A';
        }
      }
    }
  } else {
    targetEdge = 'edge_A';
  }

  // 3. Lấy danh sách các khoang trên cạnh mục tiêu (trừ khoang đang kéo nếu có)
  const candidateBoxes = tier === 'upper' ? layout2D.upperModules : layout2D.modules;
  const onEdge = candidateBoxes.filter(
    (b) => b.edgeId === targetEdge && (!draggedBox || b.instanceId !== draggedBox.instanceId)
  );

  let targetIndex = 0;
  let isVertical = true;
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  let badgeX = 0, badgeY = 0;

  const edgeLabel =
    targetEdge === 'edge_A'
      ? 'Cạnh A'
      : targetEdge === 'edge_B'
      ? 'Cạnh B'
      : 'Cạnh C';

  if (targetEdge === 'edge_A') {
    isVertical = true;
    onEdge.sort((a, b) => a.x - b.x);

    targetIndex = onEdge.length;
    for (let i = 0; i < onEdge.length; i++) {
      const midX = onEdge[i].x + onEdge[i].width / 2;
      if (modelX < midX) {
        targetIndex = i;
        break;
      }
    }

    let lineX = 0;
    const defaultY = tier === 'base' ? baseRowY : 0;
    const defaultH = tier === 'base' ? depthA : upperDepth;

    if (onEdge.length === 0) {
      const cornerOffset =
        shape === 'L' || shape === 'U'
          ? layout.cornerOrientationAB === 'edge_A'
            ? tier === 'base'
              ? layout.cornerWidthBaseAB || 1000
              : layout.cornerWidthUpperAB || 750
            : tier === 'base'
            ? layout.edgeB?.depth || 600
            : upperDepth
          : 0;
      lineX = cornerOffset;
      y1 = defaultY;
      y2 = defaultY + defaultH;
    } else if (targetIndex === 0) {
      lineX = onEdge[0].x;
      y1 = onEdge[0].y;
      y2 = onEdge[0].y + onEdge[0].height;
    } else if (targetIndex >= onEdge.length) {
      const last = onEdge[onEdge.length - 1];
      lineX = last.x + last.width;
      y1 = last.y;
      y2 = last.y + last.height;
    } else {
      lineX = onEdge[targetIndex].x;
      y1 = onEdge[targetIndex].y;
      y2 = onEdge[targetIndex].y + onEdge[targetIndex].height;
    }

    x1 = lineX;
    x2 = lineX;
    badgeX = lineX;
    badgeY = y1 - 25;
  } else {
    // edge_B hoặc edge_C (xếp dọc theo trục Y)
    isVertical = false;
    onEdge.sort((a, b) => a.y - b.y);

    targetIndex = onEdge.length;
    for (let i = 0; i < onEdge.length; i++) {
      const midY = onEdge[i].y + onEdge[i].height / 2;
      if (modelY < midY) {
        targetIndex = i;
        break;
      }
    }

    let lineY = 0;
    const defaultX =
      targetEdge === 'edge_B'
        ? tier === 'upper' && is2Row
          ? -(upperDepth + GAP)
          : 0
        : tier === 'upper' && is2Row
        ? lengthA + GAP
        : lengthA - depthC;
    const defaultW =
      tier === 'base' ? (targetEdge === 'edge_B' ? depthB : depthC) : upperDepth;

    if (onEdge.length === 0) {
      const cornerOffset =
        targetEdge === 'edge_B'
          ? layout.cornerOrientationAB === 'edge_B'
            ? tier === 'base'
              ? layout.cornerWidthBaseAB || 1000
              : layout.cornerWidthUpperAB || 750
            : tier === 'base'
            ? depthA
            : upperDepth
          : layout.cornerOrientationAC === 'edge_C'
          ? tier === 'base'
            ? layout.cornerWidthBaseAC || 1000
            : layout.cornerWidthUpperAC || 750
          : tier === 'base'
          ? depthA
          : upperDepth;

      lineY = (tier === 'base' ? baseRowY : 0) + cornerOffset;
      x1 = defaultX;
      x2 = defaultX + defaultW;
    } else if (targetIndex === 0) {
      lineY = onEdge[0].y;
      x1 = onEdge[0].x;
      x2 = onEdge[0].x + onEdge[0].width;
    } else if (targetIndex >= onEdge.length) {
      const last = onEdge[onEdge.length - 1];
      lineY = last.y + last.height;
      x1 = last.x;
      x2 = last.x + last.width;
    } else {
      lineY = onEdge[targetIndex].y;
      x1 = onEdge[targetIndex].x;
      x2 = onEdge[targetIndex].x + onEdge[targetIndex].width;
    }

    y1 = lineY;
    y2 = lineY;
    badgeX = x1 + (x2 - x1) / 2;
    badgeY = lineY - 20;
  }

  // 4. Tạo mô tả nhãn vị trí rõ ràng (Nhấn mạnh vào việc CHÈN VÀO GIỮA)
  let label = '';
  if (!isValid) {
    label = `⛔ ${invalidReason}`;
  } else if (onEdge.length === 0) {
    label = `▼ Đặt vào ${edgeLabel} (Vị trí #1)`;
  } else if (targetIndex === 0) {
    label = `▼ Đặt trước [${onEdge[0].code}] (${edgeLabel})`;
  } else if (targetIndex >= onEdge.length) {
    label = `▼ Đặt sau [${onEdge[onEdge.length - 1].code}] (${edgeLabel})`;
  } else {
    const prevMod = onEdge[targetIndex - 1];
    const nextMod = onEdge[targetIndex];
    label = `▼ Chèn vào giữa [${prevMod.code}] và [${nextMod.code}] (${edgeLabel})`;
  }

  return {
    edgeId: targetEdge,
    targetIndex,
    isValid,
    invalidReason,
    indicator: {
      isVertical,
      x1,
      y1,
      x2,
      y2,
      badgeX,
      badgeY,
      label,
      isValid,
    },
  };
}

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
    selectedCornerId,
    selectedGapId,
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
    setSelectedCornerId,
    setSelectedGapId,
    toggleCornerOrientation,
    setZoom,
    setPan,
    resetView,
    toggleWorkTriangle,
    toggleDimensions,
    removePlacedModule,
    moveModule,
    addModuleToEdge,
    autoFillGap,
    snapEdgeToModules,
  } = useKitchenStore();

  const [isUpperModalOpen, setIsUpperModalOpen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Trạng thái kéo thả tương tác trực quan (Interactive Drag & Drop)
  const [dragCandidate, setDragCandidate] = useState<DragCandidate | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const [catalogDragTarget, setCatalogDragTarget] = useState<DropTargetResult | null>(null);

  const dragCandidateRef = useRef<DragCandidate | null>(null);
  dragCandidateRef.current = dragCandidate;

  const activeDragRef = useRef<ActiveDragState | null>(null);
  activeDragRef.current = activeDrag;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const layout2DRef = useRef(calculateLayout2D(layout, activeCabinetTier));

  const activeTierRef = useRef(activeCabinetTier);
  activeTierRef.current = activeCabinetTier;

  const panRef = useRef(pan);
  panRef.current = pan;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const handleStartDrag = (
    box: Module2DBox,
    tier: 'base' | 'upper',
    clientX: number,
    clientY: number
  ) => {
    setDragCandidate({ box, tier, startX: clientX, startY: clientY });
  };

  useEffect(() => {
    if (!dragCandidate) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      const candidate = dragCandidateRef.current;
      if (!candidate || !containerRef.current) return;

      const dx = e.clientX - candidate.startX;
      const dy = e.clientY - candidate.startY;
      if (!activeDragRef.current && Math.hypot(dx, dy) < 6) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const canvasY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;

      const currentLayout2D = layout2DRef.current;
      const rootOffsetX = Math.max(80, -currentLayout2D.minX + 80);
      const rootOffsetY = 100;
      const modelX = canvasX - rootOffsetX;
      const modelY = canvasY - rootOffsetY;

      const dropTarget = calculateDropTarget({
        modelX,
        modelY,
        tier: candidate.tier,
        draggedBox: candidate.box,
        layout: layoutRef.current,
        layout2D: currentLayout2D,
        activeCabinetTier: activeTierRef.current,
      });

      setActiveDrag({
        box: candidate.box,
        tier: candidate.tier,
        clientX: e.clientX,
        clientY: e.clientY,
        modelX,
        modelY,
        targetEdge: dropTarget.edgeId,
        targetIndex: dropTarget.targetIndex,
        isValid: dropTarget.isValid,
        invalidReason: dropTarget.invalidReason,
        indicator: dropTarget.indicator,
      });
    };

    const onWindowMouseUp = (_e: MouseEvent) => {
      const currentActive = activeDragRef.current;
      const currentCandidate = dragCandidateRef.current;

      if (currentActive) {
        if (!currentActive.isValid) {
          // Bị chặn vì kéo thả sai tầng (Tủ trên chỉ vào tủ trên, tủ dưới chỉ vào tủ dưới)
          setDragCandidate(null);
          setActiveDrag(null);
          return;
        }

        moveModule(
          currentActive.box.instanceId,
          currentActive.targetEdge,
          currentActive.targetIndex
        );
        setSelectedModuleId(currentActive.box.instanceId);
      } else if (currentCandidate) {
        setSelectedModuleId(currentCandidate.box.instanceId);
      }

      setDragCandidate(null);
      setActiveDrag(null);
    };

    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragCandidate(null);
        setActiveDrag(null);
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('keydown', onWindowKeyDown);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, [dragCandidate, moveModule, setSelectedModuleId]);

  // Tính toán dữ liệu hình học 2D theo phân tầng
  const layout2D = calculateLayout2D(layout, activeCabinetTier);
  layout2DRef.current = layout2D;

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
    e.dataTransfer.dropEffect = 'copy';

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasY = (e.clientY - rect.top - pan.y) / zoom;

    const currentLayout2D = layout2DRef.current;
    const rootOffsetX = Math.max(80, -currentLayout2D.minX + 80);
    const rootOffsetY = 100;
    const modelX = canvasX - rootOffsetX;
    const modelY = canvasY - rootOffsetY;

    const baseRowY = activeCabinetTier === 'all' ? (layout.upperDepth || 350) + 150 : 0;
    let targetTier: 'base' | 'upper' = 'base';
    if (activeCabinetTier === 'upper') {
      targetTier = 'upper';
    } else if (activeCabinetTier === 'base') {
      targetTier = 'base';
    } else {
      targetTier = modelY < baseRowY - 50 ? 'upper' : 'base';
    }

    const dropTarget = calculateDropTarget({
      modelX,
      modelY,
      tier: targetTier,
      draggedBox: null,
      layout,
      layout2D: currentLayout2D,
      activeCabinetTier,
    });

    setCatalogDragTarget(dropTarget);
  };

  const handleDragLeave = () => {
    setCatalogDragTarget(null);
  };

  const handleReorder = (sourceId: string, targetId: string) => {
    // 1. Kiểm tra nếu là khoang Tủ Dưới (cho phép hoán đổi cả cùng cạnh lẫn khác cạnh)
    const sourceBase = layout.placedModules.find((m) => m.instanceId === sourceId);
    const targetBase = layout.placedModules.find((m) => m.instanceId === targetId);
    if (sourceBase && targetBase) {
      moveModule(sourceId, targetBase.edgeId, targetBase.positionIndex);
      return;
    }

    // 2. Kiểm tra nếu là khoang Tủ Trên
    const sourceUpper = (layout.placedUpperModules || []).find((m) => m.instanceId === sourceId);
    const targetUpper = (layout.placedUpperModules || []).find((m) => m.instanceId === targetId);
    if (sourceUpper && targetUpper) {
      moveModule(sourceId, targetUpper.edgeId, targetUpper.positionIndex);
      return;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCatalogDragTarget(null);
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dropX = (e.clientX - rect.left - pan.x) / zoom;
    const dropY = (e.clientY - rect.top - pan.y) / zoom;

    const rootOffsetX = Math.max(80, -layout2D.minX + 80);
    const rootOffsetY = 100;
    const modelX = dropX - rootOffsetX;
    const modelY = dropY - rootOffsetY;

    const baseRowY = activeCabinetTier === 'all' ? (layout.upperDepth || 350) + 150 : 0;

    // 1. Thả khoang mới từ Catalog vào Canvas (Chèn chuẩn xác vào giữa các khoang khác)
    const moduleId = e.dataTransfer.getData('application/kitchen-module');
    if (moduleId) {
      const mod = catalog.find((m) => m.id === moduleId);
      if (!mod) return;

      const modTier = mod.tier || 'base';

      // KIỂM TRA PHÂN TẦNG: Tủ trên CHỈ vào tủ trên, tủ dưới CHỈ vào tủ dưới!
      if (activeCabinetTier === 'all') {
        const isHoveringUpper = modelY < baseRowY - 50;
        const isHoveringBase = modelY >= baseRowY - 50;

        if (modTier === 'upper' && isHoveringBase) {
          alert('Khoang tủ trên chỉ có thể đặt vào tầng Tủ Trên!');
          return;
        }
        if (modTier === 'base' && isHoveringUpper) {
          alert('Khoang tủ dưới chỉ có thể đặt vào tầng Tủ Dưới!');
          return;
        }
      } else if (activeCabinetTier === 'base' && modTier === 'upper') {
        alert('Đang ở chế độ xem Tủ Dưới: Khoang tủ trên chỉ có thể đặt vào tầng Tủ Trên!');
        return;
      } else if (activeCabinetTier === 'upper' && modTier === 'base') {
        alert('Đang ở chế độ xem Tủ Trên: Khoang tủ dưới chỉ có thể đặt vào tầng Tủ Dưới!');
        return;
      }

      const dropTarget = calculateDropTarget({
        modelX,
        modelY,
        tier: modTier,
        draggedBox: null,
        layout,
        layout2D,
        activeCabinetTier,
      });

      if (!dropTarget.isValid) {
        alert(dropTarget.invalidReason || 'Không thể đặt khoang vào vị trí này!');
        return;
      }

      // Chèn đúng vị trí vào giữa các khoang khác
      addModuleToEdge(moduleId, dropTarget.edgeId, undefined, dropTarget.targetIndex);
      return;
    }

    // 2. Fallback nếu dùng HTML5 drag cho placed module
    const draggedInstanceId = e.dataTransfer.getData('application/kitchen-placed-instance');
    if (draggedInstanceId) {
      const placedUpper = (layout.placedUpperModules || []).find((m) => m.instanceId === draggedInstanceId);
      const placedBase = layout.placedModules.find((m) => m.instanceId === draggedInstanceId);

      const modTier: 'base' | 'upper' = placedUpper ? 'upper' : 'base';
      const dropTarget = calculateDropTarget({
        modelX,
        modelY,
        tier: modTier,
        draggedBox: (placedUpper || placedBase) as any,
        layout,
        layout2D,
        activeCabinetTier,
      });

      if (dropTarget.isValid) {
        moveModule(draggedInstanceId, dropTarget.edgeId, dropTarget.targetIndex);
      }
    }
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
      className={`relative flex-1 h-full w-full bg-slate-950 overflow-hidden select-none ${
        activeDrag ? 'cursor-grabbing' : 'cursor-default'
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
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

          {/* Họa tiết sọc chéo kiến trúc (Architectural Diagonal Hatch Pattern) cho khoảng trống Tủ Dưới */}
          <pattern
            id="gap-hatch-base"
            width="14"
            height="14"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="14"
              stroke="#06b6d4"
              strokeWidth="1.8"
              strokeOpacity="0.45"
            />
          </pattern>

          {/* Họa tiết sọc chéo kiến trúc cho khoảng trống Tủ Trên */}
          <pattern
            id="gap-hatch-upper"
            width="14"
            height="14"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="14"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeOpacity="0.45"
            />
          </pattern>

          {/* Glow filter cho khoảng trống khi hover / select */}
          <filter id="gap-glow-base" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#06b6d4" floodOpacity="0.8" />
          </filter>
          <filter id="gap-glow-upper" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f59e0b" floodOpacity="0.8" />
          </filter>
          <filter id="drop-indicator-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#06b6d4" floodOpacity="0.95" />
          </filter>
          <filter id="drop-indicator-invalid-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.95" />
          </filter>
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
            layout2D.corners.map((corner) => {
              const isSelected = selectedCornerId === corner.id;
              const deadW = corner.deadWidth || 600;
              const deadH = corner.deadHeight || 600;

              return (
                <g
                  key={corner.id}
                  className="corner-joint cursor-pointer group"
                  onClick={() => setSelectedCornerId(corner.id)}
                >
                  {/* Thùng bao khoang góc tổng thể */}
                  <rect
                    x={corner.x}
                    y={corner.y}
                    width={corner.width}
                    height={corner.height}
                    fill="#1e293b"
                    stroke={isSelected ? '#38bdf8' : '#475569'}
                    strokeWidth={isSelected ? '3' : '1.5'}
                    rx="2"
                  />

                  {/* Vùng góc chết giao nhau */}
                  <rect
                    x={corner.x}
                    y={corner.y}
                    width={deadW}
                    height={deadH}
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                  />
                  {/* Vạch chéo góc chết kiến trúc */}
                  <line
                    x1={corner.x}
                    y1={corner.y}
                    x2={corner.x + deadW}
                    y2={corner.y + deadH}
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                  <line
                    x1={corner.x + deadW}
                    y1={corner.y}
                    x2={corner.x}
                    y2={corner.y + deadH}
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />

                  {/* Khối nhãn thông tin trung tâm */}
                  <rect
                    x={corner.x + corner.width / 2 - 130}
                    y={corner.y + corner.height / 2 - 50}
                    width="260"
                    height="70"
                    rx="12"
                    fill="#090d16"
                    stroke={isSelected ? '#38bdf8' : '#64748b'}
                    strokeWidth="2"
                  />
                  <text
                    x={corner.x + corner.width / 2}
                    y={corner.y + corner.height / 2 - 25}
                    textAnchor="middle"
                    fill="#f1f5f9"
                    fontSize="22"
                    fontWeight="900"
                    letterSpacing="0.5px"
                  >
                    GÓC NỐI TỦ DƯỚI
                  </text>
                  <text
                    x={corner.x + corner.width / 2}
                    y={corner.y + corner.height / 2 - 4}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="18"
                    fontWeight="700"
                  >
                    {corner.width} × {corner.height} mm
                  </text>
                  <text
                    x={corner.x + corner.width / 2}
                    y={corner.y + corner.height / 2 + 14}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="13"
                    fontWeight="600"
                  >
                    {corner.orientation === 'edge_B'
                      ? 'Dài quay Cạnh B'
                      : corner.orientation === 'edge_C'
                      ? 'Dài quay Cạnh C'
                      : 'Dài quay Cạnh A'}
                  </text>

                  {/* Nút bấm đảo hướng quay nhanh */}
                  <g
                    className="hover:opacity-100 opacity-80 transition cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCornerOrientation(corner.id);
                    }}
                  >
                    <rect
                      x={corner.x + corner.width / 2 - 80}
                      y={corner.y + corner.height / 2 + 28}
                      width="160"
                      height="28"
                      rx="6"
                      fill="#0284c7"
                      stroke="#38bdf8"
                      strokeWidth="1"
                    />
                    <text
                      x={corner.x + corner.width / 2}
                      y={corner.y + corner.height / 2 + 47}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      ⇄ Đổi hướng quay
                    </text>
                  </g>
                </g>
              );
            })}

          {/* 3. CÁC GÓC NỐI (CORNER JOINTS) TỦ TRÊN */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'upper') &&
            layout2D.upperCorners.map((corner) => {
              const isSelected = selectedCornerId === corner.id;
              const deadW = corner.deadWidth || 350;
              const deadH = corner.deadHeight || 350;

              return (
                <g
                  key={corner.id}
                  className="upper-corner-joint cursor-pointer group"
                  onClick={() => setSelectedCornerId(corner.id)}
                >
                  <rect
                    x={corner.x}
                    y={corner.y}
                    width={corner.width}
                    height={corner.height}
                    fill="#0c4a6e"
                    fillOpacity="0.85"
                    stroke={isSelected ? '#38bdf8' : '#0284c7'}
                    strokeWidth={isSelected ? '3' : '2'}
                    strokeDasharray="4 2"
                    rx="2"
                  />
                  {/* Vùng góc chết giao nhau tủ trên */}
                  <rect
                    x={corner.x}
                    y={corner.y}
                    width={deadW}
                    height={deadH}
                    fill="#082f49"
                    stroke="#0284c7"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={corner.x}
                    y1={corner.y}
                    x2={corner.x + deadW}
                    y2={corner.y + deadH}
                    stroke="#0ea5e9"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={corner.x + deadW}
                    y1={corner.y}
                    x2={corner.x}
                    y2={corner.y + deadH}
                    stroke="#0ea5e9"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                  />

                  {/* Nhãn thông tin góc tủ trên */}
                  <rect
                    x={corner.x + corner.width / 2 - 100}
                    y={corner.y + corner.height / 2 - 35}
                    width="200"
                    height="54"
                    rx="8"
                    fill="#082f49"
                    stroke={isSelected ? '#38bdf8' : '#0ea5e9'}
                    strokeWidth="1.5"
                  />
                  <text
                    x={corner.x + corner.width / 2}
                    y={corner.y + corner.height / 2 - 15}
                    textAnchor="middle"
                    fill="#bae6fd"
                    fontSize="18"
                    fontWeight="900"
                  >
                    GÓC TỦ TRÊN
                  </text>
                  <text
                    x={corner.x + corner.width / 2}
                    y={corner.y + corner.height / 2 + 5}
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontSize="14"
                    fontWeight="700"
                  >
                    {corner.width} × {corner.height} mm
                  </text>

                  {/* Nút bấm đảo hướng quay nhanh tủ trên */}
                  <g
                    className="hover:opacity-100 opacity-80 transition cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCornerOrientation(corner.id);
                    }}
                  >
                    <rect
                      x={corner.x + corner.width / 2 - 65}
                      y={corner.y + corner.height / 2 + 25}
                      width="130"
                      height="24"
                      rx="5"
                      fill="#0369a1"
                      stroke="#38bdf8"
                      strokeWidth="1"
                    />
                    <text
                      x={corner.x + corner.width / 2}
                      y={corner.y + corner.height / 2 + 42}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      ⇄ Đổi hướng quay
                    </text>
                  </g>
                </g>
              );
            })}

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
                  isBeingDragged={activeDrag?.box.instanceId === box.instanceId}
                  onSelect={(id) => setSelectedModuleId(id)}
                  onDelete={(id) => removePlacedModule(id)}
                  onMoveLeft={handleMoveLeft}
                  onMoveRight={handleMoveRight}
                  onReorder={handleReorder}
                  onStartDrag={(b, cx, cy) => handleStartDrag(b, 'base', cx, cy)}
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
                  isBeingDragged={activeDrag?.box.instanceId === box.instanceId}
                  onSelect={(id) => setSelectedModuleId(id)}
                  onDelete={(id) => removePlacedModule(id)}
                  onMoveLeft={handleMoveLeft}
                  onMoveRight={handleMoveRight}
                  onReorder={handleReorder}
                  onStartDrag={(b, cx, cy) => handleStartDrag(b, 'upper', cx, cy)}
                />
              );
            })}

          {/* 5.1 CÁC KHOẢNG TRỐNG CÒN LẠI CỦA TỦ TRÊN (UPPER EMPTY GAPS) */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'upper') &&
            layout2D.upperGaps &&
            layout2D.upperGaps.map((gap) => {
              const isSelected = selectedGapId === gap.id;
              const isNarrow = gap.gapMm < 80;
              const isMedium = gap.gapMm >= 80 && gap.gapMm < 220;
              const isLarge = gap.gapMm >= 220;

              const badgeW = isLarge ? Math.min(gap.gapMm - 20, 240) : isMedium ? Math.min(gap.gapMm - 12, 170) : 68;
              const badgeH = isLarge ? 70 : isMedium ? 56 : 30;

              return (
                <g
                  key={gap.id}
                  className="upper-empty-gap group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedGapId(gap.id);
                  }}
                >
                  {/* Khung ô khoảng trống với họa tiết sọc chéo kiến trúc (Architectural Diagonal Hatch) */}
                  <rect
                    x={gap.x}
                    y={gap.y}
                    width={gap.width}
                    height={gap.height}
                    fill="url(#gap-hatch-upper)"
                    fillOpacity={isSelected ? '0.35' : '0.18'}
                    stroke={isSelected ? '#fbbf24' : '#f59e0b'}
                    strokeWidth={isSelected ? '3.5' : '2'}
                    strokeDasharray="6 4"
                    rx="4"
                    filter={isSelected ? 'url(#gap-glow-upper)' : undefined}
                    className="transition-all duration-200 group-hover:stroke-amber-300 group-hover:fill-opacity-30"
                  />

                  {/* Viền góc định vị (CAD Corner Tick Marks) tạo phong cách bản vẽ kỹ thuật cao cấp */}
                  <line x1={gap.x} y1={gap.y + 10} x2={gap.x} y2={gap.y} stroke="#fbbf24" strokeWidth="2.5" />
                  <line x1={gap.x} y1={gap.y} x2={gap.x + 10} y2={gap.y} stroke="#fbbf24" strokeWidth="2.5" />
                  <line x1={gap.x + gap.width - 10} y1={gap.y} x2={gap.x + gap.width} y2={gap.y} stroke="#fbbf24" strokeWidth="2.5" />
                  <line x1={gap.x + gap.width} y1={gap.y} x2={gap.x + gap.width} y2={gap.y + 10} stroke="#fbbf24" strokeWidth="2.5" />

                  {/* Badge hiển thị độ rộng khoảng trống & tương tác */}
                  <g
                    transform={`translate(${gap.centerX}, ${gap.centerY}) rotate(${gap.rotation || 0})`}
                    className="select-none"
                  >
                    {isNarrow ? (
                      /* Badge nhỏ gọn cho khoảng trống hẹp (<80mm) - Dạng thẻ tag chỉ thị không che đè khoang */
                      <g>
                        <rect
                          x={-badgeW / 2}
                          y={-badgeH / 2}
                          width={badgeW}
                          height={badgeH}
                          rx="8"
                          fill="#090d16"
                          fillOpacity="0.96"
                          stroke={isSelected ? '#fbbf24' : '#f59e0b'}
                          strokeWidth="2"
                        />
                        <text
                          x="0"
                          y="5"
                          textAnchor="middle"
                          fill="#fbbf24"
                          fontSize="13"
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {gap.gapMm}
                        </text>
                      </g>
                    ) : (
                      /* Badge đầy đủ cho khoảng trống vừa & lớn (>=80mm) */
                      <g>
                        <rect
                          x={-badgeW / 2}
                          y={-badgeH / 2}
                          width={badgeW}
                          height={badgeH}
                          rx="10"
                          fill="#090d16"
                          fillOpacity="0.96"
                          stroke={isSelected ? '#fbbf24' : '#f59e0b'}
                          strokeWidth={isSelected ? '2.5' : '1.8'}
                          className="transition-colors group-hover:border-amber-300"
                        />
                        <text
                          x="0"
                          y={isLarge ? '-10' : '-8'}
                          textAnchor="middle"
                          fill="#fbbf24"
                          fontSize={isLarge ? '13' : '11'}
                          fontWeight="800"
                          letterSpacing="0.5px"
                        >
                          📐 TRỐNG TỦ TRÊN
                        </text>
                        <text
                          x="0"
                          y={isLarge ? '20' : '16'}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={isLarge ? '28' : '22'}
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {gap.gapMm} mm
                        </text>
                      </g>
                    )}

                    {/* Nút bấm nhanh 1-click Auto-Fit nổi lên khi được click hoặc hover (khi khoảng trống >= 60mm) */}
                    {(isSelected || gap.gapMm >= 100) && (
                      <g
                        transform={`translate(0, ${isNarrow ? 26 : badgeH / 2 + 18})`}
                        className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation();
                          autoFillGap(gap.edgeId, 'upper', gap.gapMm);
                        }}
                      >
                        <rect
                          x="-62"
                          y="-13"
                          width="124"
                          height="26"
                          rx="6"
                          fill="#b45309"
                          stroke="#fde68a"
                          strokeWidth="1.5"
                          filter="url(#gap-glow-upper)"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          ⚡ Lấp đầy (Auto-Fit)
                        </text>
                      </g>
                    )}
                  </g>
                </g>
              );
            })}

          {/* 5.2 CÁC KHOẢNG TRỐNG CÒN LẠI CỦA TỦ DƯỚI (BASE EMPTY GAPS) */}
          {(activeCabinetTier === 'all' || activeCabinetTier === 'base') &&
            layout2D.baseGaps &&
            layout2D.baseGaps.map((gap) => {
              const isSelected = selectedGapId === gap.id;
              const isNarrow = gap.gapMm < 80;
              const isMedium = gap.gapMm >= 80 && gap.gapMm < 220;
              const isLarge = gap.gapMm >= 220;

              const badgeW = isLarge ? Math.min(gap.gapMm - 20, 240) : isMedium ? Math.min(gap.gapMm - 12, 170) : 68;
              const badgeH = isLarge ? 70 : isMedium ? 56 : 30;

              return (
                <g
                  key={gap.id}
                  className="base-empty-gap group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedGapId(gap.id);
                  }}
                >
                  {/* Khung ô khoảng trống với họa tiết sọc chéo kiến trúc Cyan (Architectural Diagonal Hatch) */}
                  <rect
                    x={gap.x}
                    y={gap.y}
                    width={gap.width}
                    height={gap.height}
                    fill="url(#gap-hatch-base)"
                    fillOpacity={isSelected ? '0.35' : '0.18'}
                    stroke={isSelected ? '#38bdf8' : '#06b6d4'}
                    strokeWidth={isSelected ? '3.5' : '2'}
                    strokeDasharray="6 4"
                    rx="4"
                    filter={isSelected ? 'url(#gap-glow-base)' : undefined}
                    className="transition-all duration-200 group-hover:stroke-cyan-300 group-hover:fill-opacity-30"
                  />

                  {/* Viền góc định vị (CAD Corner Tick Marks) tạo phong cách bản vẽ kỹ thuật cao cấp */}
                  <line x1={gap.x} y1={gap.y + 10} x2={gap.x} y2={gap.y} stroke="#06b6d4" strokeWidth="2.5" />
                  <line x1={gap.x} y1={gap.y} x2={gap.x + 10} y2={gap.y} stroke="#06b6d4" strokeWidth="2.5" />
                  <line x1={gap.x + gap.width - 10} y1={gap.y} x2={gap.x + gap.width} y2={gap.y} stroke="#06b6d4" strokeWidth="2.5" />
                  <line x1={gap.x + gap.width} y1={gap.y} x2={gap.x + gap.width} y2={gap.y + 10} stroke="#06b6d4" strokeWidth="2.5" />

                  {/* Badge hiển thị độ rộng khoảng trống & tương tác */}
                  <g
                    transform={`translate(${gap.centerX}, ${gap.centerY}) rotate(${gap.rotation || 0})`}
                    className="select-none"
                  >
                    {isNarrow ? (
                      /* Badge nhỏ gọn cho khoảng trống hẹp (<80mm) - Không che đè khoang bên cạnh */
                      <g>
                        <rect
                          x={-badgeW / 2}
                          y={-badgeH / 2}
                          width={badgeW}
                          height={badgeH}
                          rx="8"
                          fill="#090d16"
                          fillOpacity="0.96"
                          stroke={isSelected ? '#38bdf8' : '#06b6d4'}
                          strokeWidth="2"
                        />
                        <text
                          x="0"
                          y="5"
                          textAnchor="middle"
                          fill="#38bdf8"
                          fontSize="13"
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {gap.gapMm}
                        </text>
                      </g>
                    ) : (
                      /* Badge đầy đủ cho khoảng trống vừa & lớn (>=80mm) */
                      <g>
                        <rect
                          x={-badgeW / 2}
                          y={-badgeH / 2}
                          width={badgeW}
                          height={badgeH}
                          rx="10"
                          fill="#090d16"
                          fillOpacity="0.96"
                          stroke={isSelected ? '#38bdf8' : '#06b6d4'}
                          strokeWidth={isSelected ? '2.5' : '1.8'}
                          className="transition-colors group-hover:border-cyan-300"
                        />
                        <text
                          x="0"
                          y={isLarge ? '-10' : '-8'}
                          textAnchor="middle"
                          fill="#38bdf8"
                          fontSize={isLarge ? '13' : '11'}
                          fontWeight="800"
                          letterSpacing="0.5px"
                        >
                          📐 TRỐNG TỦ DƯỚI
                        </text>
                        <text
                          x="0"
                          y={isLarge ? '20' : '16'}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={isLarge ? '28' : '22'}
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {gap.gapMm} mm
                        </text>
                      </g>
                    )}

                    {/* Nút bấm nhanh 1-click Auto-Fit nổi lên khi được click hoặc hover (khi khoảng trống >= 60mm) */}
                    {(isSelected || gap.gapMm >= 100) && (
                      <g
                        transform={`translate(0, ${isNarrow ? 26 : badgeH / 2 + 18})`}
                        className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation();
                          autoFillGap(gap.edgeId, 'base', gap.gapMm);
                        }}
                      >
                        <rect
                          x="-62"
                          y="-13"
                          width="124"
                          height="26"
                          rx="6"
                          fill="#0284c7"
                          stroke="#7dd3fc"
                          strokeWidth="1.5"
                          filter="url(#gap-glow-base)"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          ⚡ Lấp đầy (Auto-Fit)
                        </text>
                      </g>
                    )}
                  </g>
                </g>
              );
            })}

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

          {/* 6. HIỆU ỨNG KÉO THẢ KHOANG CÔNG NĂNG (DRAG & DROP DROP-ZONE & FLOATING GHOST) */}
          {(activeDrag || catalogDragTarget) && (() => {
            const ind = activeDrag ? activeDrag.indicator : catalogDragTarget!.indicator;
            const isIndValid = ind.isValid;
            const glowColor = isIndValid ? "#06b6d4" : "#ef4444";
            const badgeBg = isIndValid ? "#0284c7" : "#dc2626";
            const glowFilter = isIndValid ? "url(#drop-indicator-glow)" : "url(#drop-indicator-invalid-glow)";
            const badgeWidth = Math.max(260, ind.label.length * 11 + 35);

            return (
              <g className="interactive-drag-overlay pointer-events-none">
                {/* 6.1 Vạch chỉ thị vị trí thả (Pulsing Neon Insertion Marker Line) */}
                {ind.isVertical ? (
                  <g>
                    {/* Vệt phát sáng nền */}
                    <line
                      x1={ind.x1}
                      y1={ind.y1 - 35}
                      x2={ind.x2}
                      y2={ind.y2 + 35}
                      stroke={glowColor}
                      strokeWidth="12"
                      strokeLinecap="round"
                      opacity="0.75"
                      filter={glowFilter}
                    />
                    {/* Lõi sáng neon trắng */}
                    <line
                      x1={ind.x1}
                      y1={ind.y1 - 35}
                      x2={ind.x2}
                      y2={ind.y2 + 35}
                      stroke="#ffffff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </g>
                ) : (
                  <g>
                    {/* Vệt phát sáng nền */}
                    <line
                      x1={ind.x1 - 35}
                      y1={ind.y1}
                      x2={ind.x2 + 35}
                      y2={ind.y2}
                      stroke={glowColor}
                      strokeWidth="12"
                      strokeLinecap="round"
                      opacity="0.75"
                      filter={glowFilter}
                    />
                    {/* Lõi sáng neon trắng */}
                    <line
                      x1={ind.x1 - 35}
                      y1={ind.y1}
                      x2={ind.x2 + 35}
                      y2={ind.y2}
                      stroke="#ffffff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </g>
                )}

                {/* 6.2 Badge thông báo vị trí thả (Drop Position Pill Badge) */}
                <g transform={`translate(${ind.badgeX}, ${ind.badgeY})`}>
                  <rect
                    x={-badgeWidth / 2}
                    y="-32"
                    width={badgeWidth}
                    height="44"
                    rx="22"
                    fill={badgeBg}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    filter={glowFilter}
                  />
                  <text
                    x="0"
                    y="-4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="19"
                    fontWeight="900"
                  >
                    {ind.label}
                  </text>
                </g>

                {/* 6.3 Bóng ma khoang đang kéo (Floating Ghost Preview) - Chỉ khi kéo trên canvas */}
                {activeDrag && (
                  <g
                    transform={`translate(${activeDrag.modelX - activeDrag.box.width / 2}, ${
                      activeDrag.modelY - activeDrag.box.height / 2
                    })`}
                  >
                    {/* Khung viền mờ của module */}
                    <rect
                      x={0}
                      y={0}
                      width={activeDrag.box.width}
                      height={activeDrag.box.height}
                      rx="8"
                      fill={isIndValid ? "#0284c7" : "#ef4444"}
                      fillOpacity="0.25"
                      stroke={isIndValid ? "#38bdf8" : "#ef4444"}
                      strokeWidth="3.5"
                      strokeDasharray="8 6"
                      filter={glowFilter}
                    />

                    {/* HUD Card thông số khoang bay theo chuột */}
                    <g transform={`translate(${activeDrag.box.width / 2}, ${activeDrag.box.height / 2})`}>
                      <rect
                        x="-145"
                        y="-34"
                        width="290"
                        height="68"
                        rx="14"
                        fill="#090d16"
                        fillOpacity="0.95"
                        stroke={isIndValid ? "#38bdf8" : "#ef4444"}
                        strokeWidth="2.5"
                        filter={glowFilter}
                      />
                      <text
                        x="0"
                        y="-8"
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize="20"
                        fontWeight="800"
                      >
                        [{activeDrag.box.code}] {activeDrag.box.name}
                      </text>
                      <text
                        x="0"
                        y="20"
                        textAnchor="middle"
                        fill={isIndValid ? "#38bdf8" : "#f87171"}
                        fontSize="17"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {activeDrag.box.width} × {activeDrag.box.height} mm
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })()}
        </g>
        </g>
      </svg>
    </div>
  );
};
