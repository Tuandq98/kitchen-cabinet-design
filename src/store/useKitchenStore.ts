import { create } from 'zustand';
import {
  KitchenLayout,
  KitchenModule,
  DesignRule,
  ValidationReport,
  LayoutPlanCandidate,
  PlacedModuleInstance,
  EdgeId,
  KitchenShape,
} from '../types';
import { DEFAULT_MODULES, DEFAULT_RULES, INITIAL_LAYOUT } from '../domain/constants/defaultData';
import { RuleEngine } from '../domain/rule-engine';
import { LayoutEngine } from '../domain/layout-engine';
import { computeUpperGaps, getAvailableEdgeLength } from '../utils/geometry';

export interface UpperModuleSpaceInfo {
  leftGap: number;
  rightGap: number;
  maxAllowedWidth: number;
  totalEdgeGap: number;
  segmentSpan: number;
  otherWidthsInSegment: number;
}

export interface BaseModuleSpaceInfo {
  maxAllowedWidth: number;
  remainingEdgeGap: number;
  edgeTotalLength: number;
  otherModulesWidth: number;
}

interface KitchenStoreState {
  // 1. Core State
  layout: KitchenLayout;
  catalog: KitchenModule[];
  rules: DesignRule[];
  validationReport: ValidationReport;

  // 2. Selection & UI State
  selectedModuleId: string | null;
  selectedCornerId: string | null;
  selectedGapId: string | null;
  highlightedModuleIds: string[];
  activeTab: 'catalog' | 'rules' | 'generator' | 'projects';
  activeCabinetTier: 'all' | 'base' | 'upper';
  designPhase: 'setup' | 'design_base' | 'design_upper';
  zoom: number;
  pan: { x: number; y: number };
  showWorkTriangle: boolean;
  showDimensions: boolean;

  // 3. Auto Generation State
  selectedModuleCodes: string[];
  generatedCandidates: LayoutPlanCandidate[];
  selectedCandidateIndex: number | null;
  generationError: string | null;

  // 4. History (Undo / Redo)
  history: KitchenLayout[];
  future: KitchenLayout[];

  // 5. Saved Projects & Shape Layouts
  savedProjects: KitchenLayout[];
  shapeLayouts: Partial<Record<KitchenShape, KitchenLayout>>;

  // ACTIONS
  // - Selection & View
  setSelectedModuleId: (id: string | null) => void;
  setSelectedCornerId: (id: string | null) => void;
  setSelectedGapId: (id: string | null) => void;
  toggleCornerOrientation: (cornerId: string) => void;
  setCornerOrientation: (cornerId: string, orientation: 'edge_A' | 'edge_B' | 'edge_C') => void;
  updateCornerWidth: (cornerId: string, tier: 'base' | 'upper', width: number) => void;
  setHighlightedModuleIds: (ids: string[]) => void;
  setActiveTab: (tab: 'catalog' | 'rules' | 'generator' | 'projects') => void;
  setActiveCabinetTier: (tier: 'all' | 'base' | 'upper') => void;
  setDesignPhase: (phase: 'setup' | 'design_base' | 'design_upper') => void;
  initKitchenLayout: (params: {
    shape: 'I' | 'L' | 'U';
    edgeA: { length: number; depth: number };
    edgeB?: { length: number; depth: number };
    edgeC?: { length: number; depth: number };
    baseModuleCodes: string[];
  }) => void;
  generateUpperWithConfig: (upperCodes: string[]) => void;
  confirmBaseAndGenerateUpper: () => void;
  regenerateUpperCabinets: () => void;
  resetToSetupWizard: () => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  resetView: () => void;
  toggleWorkTriangle: () => void;
  toggleDimensions: () => void;

  // - Layout Editing & Manipulation
  updateShape: (shape: 'I' | 'L' | 'U') => void;
  updateEdgeDimensions: (
    edgeId: EdgeId,
    dims: { length?: number; depth?: number; height?: number }
  ) => void;
  snapEdgeToModules: (edgeId: EdgeId, gapMm: number) => void;
  autoFillGap: (edgeId: EdgeId, tier: 'base' | 'upper', gapMm: number) => void;
  addModuleToEdge: (
    moduleId: string,
    edgeId: EdgeId,
    variantId?: string,
    targetIndex?: number
  ) => void;
  removePlacedModule: (instanceId: string) => void;
  moveModule: (
    instanceId: string,
    targetEdgeId: EdgeId,
    targetIndex: number
  ) => void;
  reorderModulesOnEdge: (edgeId: EdgeId, newOrderInstanceIds: string[]) => void;
  updatePlacedModuleVariant: (instanceId: string, variantId: string) => void;
  updatePlacedModuleCustomWidth: (instanceId: string, customWidth: number) => void;
  autoFitUpperStorage: (instanceId: string) => void;
  autoFitBaseStorage: (instanceId: string) => void;
  setLayout: (newLayout: KitchenLayout) => void;

  // - Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // - Rule Engine Management
  toggleRule: (ruleId: string) => void;
  updateRuleConfig: (ruleId: string, config: Record<string, any>) => void;
  importRules: (rules: DesignRule[]) => void;
  resetRulesToDefault: () => void;

  // - Catalog Management
  addCatalogModule: (mod: KitchenModule) => void;
  updateCatalogModule: (mod: KitchenModule) => void;
  deleteCatalogModule: (moduleId: string) => void;
  importCatalog: (modules: KitchenModule[]) => void;
  resetCatalogToDefault: () => void;

  // - Auto Generator
  setSelectedModuleCodes: (codes: string[]) => void;
  toggleSelectedModuleCode: (code: string) => void;
  runLayoutGenerator: () => void;
  applyCandidate: (candidateIndex: number) => void;

  // - Persistence & Projects
  saveCurrentProject: (name?: string) => void;
  loadProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
}

const ruleEngineInstance = new RuleEngine(DEFAULT_RULES);

// Helper to normalize module offsets and position indices
function normalizePlacedModules(layout: KitchenLayout): PlacedModuleInstance[] {
  const depthA = layout.edgeA.depth || 600;
  const depthB = layout.edgeB?.depth || 600;
  const depthC = layout.edgeC?.depth || 600;

  const orientAB = layout.cornerOrientationAB || 'edge_A';
  const orientAC = layout.cornerOrientationAC || 'edge_A';
  const wBaseAB = layout.cornerWidthBaseAB || 1000;
  const wBaseAC = layout.cornerWidthBaseAC || 1000;

  const edges: Array<'edge_A' | 'edge_B' | 'edge_C'> = ['edge_A', 'edge_B', 'edge_C'];
  const result: PlacedModuleInstance[] = [];

  for (const edgeId of edges) {
    const modulesOnEdge = layout.placedModules
      .filter((m) => m.edgeId === edgeId)
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentOffset = 0;
    if (layout.shape === 'L') {
      if (edgeId === 'edge_A') {
        // Nếu góc quay về A: tốn wBaseAB (980-1030mm). Nếu quay về B: tốn depthB (600mm)
        currentOffset = orientAB === 'edge_A' ? wBaseAB : depthB;
      } else if (edgeId === 'edge_B') {
        // Nếu góc quay về B: tốn wBaseAB (980-1030mm). Nếu quay về A: tốn depthA (600mm)
        currentOffset = orientAB === 'edge_B' ? wBaseAB : depthA;
      }
    } else if (layout.shape === 'U') {
      if (edgeId === 'edge_A') {
        // Cạnh A ở giữa: bắt đầu sau góc AB
        currentOffset = orientAB === 'edge_A' ? wBaseAB : depthB;
      } else if (edgeId === 'edge_B') {
        // Cạnh B bên trái: bắt đầu sau góc AB
        currentOffset = orientAB === 'edge_B' ? wBaseAB : depthA;
      } else if (edgeId === 'edge_C') {
        // Cạnh C bên phải: bắt đầu sau góc AC
        currentOffset = orientAC === 'edge_C' ? wBaseAC : depthA;
      }
    }

    modulesOnEdge.forEach((m, idx) => {
      result.push({
        ...m,
        positionIndex: idx,
        offset: currentOffset,
      });
      currentOffset += m.width;
    });
  }

  return result;
}

// Helper to normalize upper module offsets and position indices (không đè lên tủ cao và góc giao)
export function normalizePlacedUpperModules(layout: KitchenLayout): PlacedModuleInstance[] {
  if (!layout.placedUpperModules || layout.placedUpperModules.length === 0) {
    return [];
  }

  const upperDepth = layout.upperDepth || 350;
  const orientAB = layout.cornerOrientationAB || 'edge_A';
  const orientAC = layout.cornerOrientationAC || 'edge_A';
  const wUpperAB = layout.cornerWidthUpperAB || 750;
  const wUpperAC = layout.cornerWidthUpperAC || 750;

  const edges: Array<'edge_A' | 'edge_B' | 'edge_C'> = ['edge_A', 'edge_B', 'edge_C'];
  const result: PlacedModuleInstance[] = [];

  for (const edgeId of edges) {
    const edge =
      edgeId === 'edge_A'
        ? layout.edgeA
        : edgeId === 'edge_B'
        ? layout.edgeB
        : layout.edgeC;
    if (!edge) continue;

    const upperOnEdge = layout.placedUpperModules
      .filter((m) => m.edgeId === edgeId)
      .sort((a, b) => a.positionIndex - b.positionIndex);

    if (upperOnEdge.length === 0) continue;

    // Tìm các tủ cao trên cạnh này (F01, P01, A01...)
    const tallUnits = layout.placedModules
      .filter(
        (m) =>
          m.edgeId === edgeId &&
          (m.code === 'F01' ||
            m.code === 'P01' ||
            m.code === 'A01' ||
            m.category === 'refrigeration')
      )
      .sort((a, b) => a.offset - b.offset);

    // Danh sách các khoảng bị chiếm dụng trên cạnh
    const occupied: { start: number; end: number }[] = [];

    // Chiếm dụng bởi góc tủ trên (730-780mm theo cạnh quay về, upperDepth theo cạnh đối diện)
    if (layout.shape === 'L') {
      if (edgeId === 'edge_A') {
        const occWidth = orientAB === 'edge_A' ? wUpperAB : upperDepth;
        occupied.push({ start: 0, end: occWidth });
      } else if (edgeId === 'edge_B') {
        const occWidth = orientAB === 'edge_B' ? wUpperAB : upperDepth;
        occupied.push({ start: 0, end: occWidth });
      }
    } else if (layout.shape === 'U') {
      if (edgeId === 'edge_A') {
        const occAB = orientAB === 'edge_A' ? wUpperAB : upperDepth;
        const occAC = orientAC === 'edge_A' ? wUpperAC : upperDepth;
        occupied.push({ start: 0, end: occAB });
        occupied.push({ start: edge.length - occAC, end: edge.length });
      } else if (edgeId === 'edge_B') {
        const occAB = orientAB === 'edge_B' ? wUpperAB : upperDepth;
        occupied.push({ start: 0, end: occAB });
      } else if (edgeId === 'edge_C') {
        const occAC = orientAC === 'edge_C' ? wUpperAC : upperDepth;
        occupied.push({ start: 0, end: occAC });
      }
    }

    // Chiếm dụng bởi tủ cao
    for (const tall of tallUnits) {
      occupied.push({ start: tall.offset, end: tall.offset + tall.width });
    }

    occupied.sort((a, b) => a.start - b.start);

    // Ghép các khoảng chiếm dụng chồng lấn
    const mergedOccupied: { start: number; end: number }[] = [];
    for (const occ of occupied) {
      if (mergedOccupied.length === 0) {
        mergedOccupied.push({ ...occ });
      } else {
        const last = mergedOccupied[mergedOccupied.length - 1];
        if (occ.start <= last.end) {
          last.end = Math.max(last.end, occ.end);
        } else {
          mergedOccupied.push({ ...occ });
        }
      }
    }

    // Xác định các khoảng mở (open intervals)
    const openIntervals: { start: number; end: number }[] = [];
    let curX = 0;
    for (const occ of mergedOccupied) {
      if (occ.start > curX) {
        openIntervals.push({ start: curX, end: occ.start });
      }
      curX = Math.max(curX, occ.end);
    }
    if (curX < edge.length) {
      openIntervals.push({ start: curX, end: edge.length });
    }

    if (openIntervals.length === 0) {
      upperOnEdge.forEach((m, idx) => {
        result.push({ ...m, positionIndex: idx, offset: 0, tier: 'upper' });
      });
      continue;
    }

    // 1. Kiểm tra trên cạnh này có bếp nấu B01 và khoang hút mùi UH01 không
    const cooktop = layout.placedModules.find(
      (m) => m.edgeId === edgeId && (m.code === 'B01' || m.category === 'cooking')
    );
    const hoodIndex = upperOnEdge.findIndex(
      (m) => m.code === 'UH01' || m.category === 'appliance'
    );

    // NẾU CÓ CẢ BẾP VÀ HÚT MÙI: NEO CHẶT TIM HÚT MÙI THẲNG TIM BẾP NẤU
    if (cooktop && hoodIndex !== -1) {
      const cookCenter = cooktop.offset + cooktop.width / 2;
      const hoodMod = upperOnEdge[hoodIndex];
      const targetHoodOffset = Math.round(cookCenter - hoodMod.width / 2);

      const beforeHood = upperOnEdge.slice(0, hoodIndex);
      const afterHood = upperOnEdge.slice(hoodIndex + 1);

      // Điền nhóm trước hút mùi từ đầu openInterval đến targetHoodOffset
      let curBeforeX = openIntervals[0].start;
      const maxBeforeSpan = Math.max(0, targetHoodOffset - curBeforeX);

      // CHỐNG ĐÈ: Đảm bảo tổng chiều rộng nhóm trước không đè lên hút mùi
      let totalBeforeW = beforeHood.reduce((s, m) => s + m.width, 0);
      if (totalBeforeW > maxBeforeSpan && beforeHood.length > 0) {
        const overflow = totalBeforeW - maxBeforeSpan;
        const lastMod = beforeHood[beforeHood.length - 1];
        lastMod.width = Math.max(300, lastMod.width - overflow);
      }

      beforeHood.forEach((m, idx) => {
        result.push({
          ...m,
          positionIndex: idx,
          offset: curBeforeX,
          tier: 'upper',
        });
        curBeforeX += m.width;
      });

      // Điền khoang hút mùi đúng chuẩn targetHoodOffset (Thẳng tim bếp 100%)
      result.push({
        ...hoodMod,
        positionIndex: hoodIndex,
        offset: targetHoodOffset,
        tier: 'upper',
      });

      // Điền nhóm sau hút mùi bắt đầu từ cuối khoang hút mùi
      let curAfterX = targetHoodOffset + hoodMod.width;
      const maxAfterSpan = Math.max(0, openIntervals[0].end - curAfterX);

      // CHỐNG ĐÈ: Đảm bảo tổng chiều rộng nhóm sau không đè lên tủ cao / mép tường
      let totalAfterW = afterHood.reduce((s, m) => s + m.width, 0);
      if (totalAfterW > maxAfterSpan && afterHood.length > 0) {
        const overflow = totalAfterW - maxAfterSpan;
        const lastMod = afterHood[afterHood.length - 1];
        lastMod.width = Math.max(300, lastMod.width - overflow);
      }

      afterHood.forEach((m, idx) => {
        result.push({
          ...m,
          positionIndex: hoodIndex + 1 + idx,
          offset: curAfterX,
          tier: 'upper',
        });
        curAfterX += m.width;
      });

      continue;
    }

    // 2. Nếu không có hút mùi hoặc bếp trên cạnh này: Xếp tuần tự theo positionIndex
    let intervalIdx = 0;
    let placeOffset = openIntervals[0].start;

    upperOnEdge.forEach((m, idx) => {
      // Nếu vị trí hiện tại cộng chiều rộng khoang vượt quá khoảng mở này, chuyển sang khoảng mở kế tiếp
      while (
        intervalIdx < openIntervals.length &&
        placeOffset + m.width > openIntervals[intervalIdx].end + 1 &&
        placeOffset > openIntervals[intervalIdx].start
      ) {
        intervalIdx++;
        if (intervalIdx < openIntervals.length) {
          placeOffset = openIntervals[intervalIdx].start;
        }
      }

      // CHỐNG ĐÈ: Không cho phép vượt quá cuối interval
      if (intervalIdx < openIntervals.length && placeOffset + m.width > openIntervals[intervalIdx].end) {
        m.width = Math.max(300, openIntervals[intervalIdx].end - placeOffset);
      }

      const assignedOffset = placeOffset;
      result.push({
        ...m,
        positionIndex: idx,
        offset: assignedOffset,
        tier: 'upper',
      });

      placeOffset += m.width;
    });
  }

  return result;
}

/**
 * Tính toán thông tin khoảng trống và kích thước tối đa cho phép của một khoang tủ trên
 * Đảm bảo TUYỆT ĐỐI KHÔNG ĐÈ lên khoang khác, không đè lên hút mùi, tủ cao hay góc chết.
 */
export function getUpperModuleSpaceInfo(
  instanceId: string,
  layout: KitchenLayout
): UpperModuleSpaceInfo {
  const targetUpper = (layout.placedUpperModules || []).find(
    (m) => m.instanceId === instanceId
  );
  if (!targetUpper) {
    return {
      leftGap: 0,
      rightGap: 0,
      maxAllowedWidth: 1200,
      totalEdgeGap: 0,
      segmentSpan: 0,
      otherWidthsInSegment: 0,
    };
  }

  const edgeId = targetUpper.edgeId;
  const edge =
    edgeId === 'edge_A'
      ? layout.edgeA
      : edgeId === 'edge_B'
      ? layout.edgeB
      : layout.edgeC;
  if (!edge) {
    return {
      leftGap: 0,
      rightGap: 0,
      maxAllowedWidth: targetUpper.width,
      totalEdgeGap: 0,
      segmentSpan: targetUpper.width,
      otherWidthsInSegment: 0,
    };
  }

  const upperOnEdge = (layout.placedUpperModules || [])
    .filter((m) => m.edgeId === edgeId)
    .sort((a, b) => a.positionIndex - b.positionIndex);

  const targetIdx = upperOnEdge.findIndex((m) => m.instanceId === instanceId);
  const upperDepth = layout.upperDepth || 350;

  // 1. Xác định ranh giới góc chết
  let cornerStart = 0;
  let cornerEnd = edge.length;

  if (layout.shape === 'L') {
    if (edgeId === 'edge_A' || edgeId === 'edge_B') {
      cornerStart = upperDepth;
    }
  } else if (layout.shape === 'U') {
    if (edgeId === 'edge_A') {
      cornerStart = upperDepth;
      cornerEnd = edge.length - upperDepth;
    } else {
      cornerStart = upperDepth;
    }
  }

  // 2. Tìm các tủ cao trên cạnh này
  const tallUnits = layout.placedModules
    .filter(
      (m) =>
        m.edgeId === edgeId &&
        (m.code === 'F01' ||
          m.code === 'P01' ||
          m.code === 'A01' ||
          m.category === 'refrigeration')
    )
    .map((t) => ({ start: t.offset, end: t.offset + t.width }))
    .sort((a, b) => a.start - b.start);

  for (const tall of tallUnits) {
    if (tall.start <= cornerStart + 50 && tall.end > cornerStart) {
      cornerStart = Math.max(cornerStart, tall.end);
    }
    if (tall.end >= cornerEnd - 50 && tall.start < cornerEnd) {
      cornerEnd = Math.min(cornerEnd, tall.start);
    }
  }

  // 3. Tìm vị trí khoang hút mùi neo thẳng tim bếp nấu
  const cooktop = layout.placedModules.find(
    (m) => m.edgeId === edgeId && (m.code === 'B01' || m.category === 'cooking')
  );
  const hoodIndex = upperOnEdge.findIndex(
    (m) => m.code === 'UH01' || m.category === 'appliance'
  );

  let hoodInterval: { start: number; end: number } | null = null;
  if (cooktop && hoodIndex !== -1) {
    const cookCenter = cooktop.offset + cooktop.width / 2;
    const hoodMod = upperOnEdge[hoodIndex];
    const targetHoodOffset = Math.round(cookCenter - hoodMod.width / 2);
    hoodInterval = {
      start: targetHoodOffset,
      end: targetHoodOffset + hoodMod.width,
    };
  }

  // 4. Xác định phân đoạn mở [segStart, segEnd] mà khoang targetUpper đang nằm trong đó
  let segStart = cornerStart;
  let segEnd = cornerEnd;

  if (hoodInterval) {
    if (targetUpper.code === 'UH01' || targetIdx === hoodIndex) {
      segStart = hoodInterval.start;
      segEnd = hoodInterval.end;
    } else if (targetIdx < hoodIndex) {
      // Trước hút mùi
      segEnd = Math.min(segEnd, hoodInterval.start);
    } else if (targetIdx > hoodIndex) {
      // Sau hút mùi
      segStart = Math.max(segStart, hoodInterval.end);
    }
  }

  // 5. Lọc các khoang cùng nằm trong phân đoạn
  const modulesInSegment = upperOnEdge.filter((m, idx) => {
    if (hoodInterval) {
      if (targetUpper.code === 'UH01' || targetIdx === hoodIndex) {
        return idx === hoodIndex;
      }
      if (targetIdx < hoodIndex) return idx < hoodIndex;
      if (targetIdx > hoodIndex) return idx > hoodIndex;
    }
    return true;
  });

  const otherWidthsInSegment = modulesInSegment
    .filter((m) => m.instanceId !== instanceId)
    .reduce((sum, m) => sum + m.width, 0);

  const totalSegSpan = Math.max(0, segEnd - segStart);
  const maxAllowedWidth = Math.max(
    targetUpper.width,
    Math.max(300, totalSegSpan - otherWidthsInSegment)
  );

  // 6. Tính leftGap & rightGap
  let leftObstacleX = segStart;
  let rightObstacleX = segEnd;

  const segIdx = modulesInSegment.findIndex((m) => m.instanceId === instanceId);
  if (segIdx > 0) {
    const prevMod = modulesInSegment[segIdx - 1];
    leftObstacleX = prevMod.offset + prevMod.width;
  }
  if (segIdx !== -1 && segIdx < modulesInSegment.length - 1) {
    const nextMod = modulesInSegment[segIdx + 1];
    rightObstacleX = nextMod.offset;
  }

  const leftGap = Math.max(0, targetUpper.offset - leftObstacleX);
  const rightGap = Math.max(0, rightObstacleX - (targetUpper.offset + targetUpper.width));

  // 7. Tổng khoảng trống trên toàn bộ cạnh
  const edgeGaps = computeUpperGaps(layout).filter((g) => g.edgeId === edgeId);
  const totalEdgeGap = edgeGaps.reduce((sum, g) => sum + g.gapMm, 0);

  return {
    leftGap: Math.round(leftGap),
    rightGap: Math.round(rightGap),
    maxAllowedWidth: Math.round(maxAllowedWidth),
    totalEdgeGap: Math.round(totalEdgeGap),
    segmentSpan: Math.round(totalSegSpan),
    otherWidthsInSegment: Math.round(otherWidthsInSegment),
  };
}

/**
 * Tính toán thông tin khoảng trống và kích thước tối đa cho phép của một khoang tủ dưới (T01)
 * Đảm bảo kích thước không làm tràn chiều dài khả dụng của cạnh bếp (EDGE_OVERFLOW)
 */
export function getBaseModuleSpaceInfo(
  instanceId: string,
  layout: KitchenLayout
): BaseModuleSpaceInfo {
  const targetBase = layout.placedModules.find((m) => m.instanceId === instanceId);
  if (!targetBase) {
    return {
      maxAllowedWidth: 1200,
      remainingEdgeGap: 0,
      edgeTotalLength: 0,
      otherModulesWidth: 0,
    };
  }

  const edgeId = targetBase.edgeId;
  const availLength = getAvailableEdgeLength(layout, edgeId);
  const baseOnEdge = layout.placedModules.filter((m) => m.edgeId === edgeId);
  const otherModulesWidth = baseOnEdge
    .filter((m) => m.instanceId !== instanceId)
    .reduce((sum, m) => sum + m.width, 0);

  const remainingEdgeGap = Math.max(0, availLength - (otherModulesWidth + targetBase.width));
  const maxAllowedWidth = Math.max(300, availLength - otherModulesWidth);

  return {
    maxAllowedWidth: Math.round(maxAllowedWidth),
    remainingEdgeGap: Math.round(remainingEdgeGap),
    edgeTotalLength: Math.round(availLength),
    otherModulesWidth: Math.round(otherModulesWidth),
  };
}

/**
 * Phân bổ công năng công thái học chuẩn NKBA & Tam giác công năng cho các cạnh khi generator không có candidate
 * Tuyệt đối không dồn toàn bộ khoang vào Cạnh A khi làm bếp chữ L hoặc chữ U.
 */
function createErgonomicFallbackModules(
  shape: KitchenShape,
  edgeA: { length: number; depth: number },
  edgeB?: { length: number; depth: number },
  edgeC?: { length: number; depth: number },
  baseCodes: string[] = [],
  catalog: KitchenModule[] = [],
  orientAB: 'edge_A' | 'edge_B' = 'edge_A',
  orientAC: 'edge_A' | 'edge_C' = 'edge_C',
  wBaseAB = 1000,
  wBaseAC = 1000
): PlacedModuleInstance[] {
  const depthA = edgeA.depth || 600;
  const depthB = edgeB?.depth || 600;
  const depthC = edgeC?.depth || 600;

  const codesToPlace = baseCodes.filter((c) => c !== 'K01' && c !== 'UK01');
  const placed: PlacedModuleInstance[] = [];

  const getModAndVariant = (code: string) => {
    const mod = catalog.find((m) => m.code === code);
    if (!mod) return null;
    const v = mod.variants.find((v) => v.isDefault) || mod.variants[0];
    return { mod, variant: v };
  };

  if (shape === 'U') {
    const hasD01 = codesToPlace.includes('D01');
    const takesAB_on_A = orientAB === 'edge_A' ? wBaseAB : depthB;
    const takesAC_on_A = orientAC === 'edge_A' ? wBaseAC : depthC;
    const availA = edgeA.length - takesAB_on_A - takesAC_on_A;

    const needAWithoutD01 = 1200; // S01 (~850) + C01 (~350)
    const canFitD01OnA = hasD01 && availA >= needAWithoutD01 + 600;

    const bCodes: string[] = [];
    const aCodes: string[] = [];
    const cCodes: string[] = [];

    for (const code of codesToPlace) {
      if (code === 'F01') {
        bCodes.push(code); // Tủ lạnh ở Cạnh B (rìa ngoài)
      } else if (code === 'D01') {
        if (canFitD01OnA) {
          aCodes.push(code);
        } else {
          bCodes.unshift(code); // D01 ở Cạnh B kề góc chậu
        }
      } else if (code === 'S01' || code === 'C01' || code === 'W01') {
        aCodes.push(code); // Chậu & Sơ chế ở Cạnh A
      } else if (
        code === 'B01' ||
        code === 'SP01' ||
        code === 'R01' ||
        code === 'M01' ||
        code === 'P01' ||
        code === 'A01'
      ) {
        cCodes.push(code); // Bếp & Tủ cao ở Cạnh C
      } else {
        if (bCodes.length <= 1) {
          bCodes.unshift(code);
        } else if (aCodes.length <= 2) {
          aCodes.push(code);
        } else {
          cCodes.push(code);
        }
      }
    }

    // Thứ tự Cạnh B: từ góc AB xuống ngoài cùng -> F01 ở ngoài cùng mép B (RULE_08)
    bCodes.sort((a, b) => {
      if (a === 'F01') return 1;
      if (b === 'F01') return -1;
      return 0;
    });

    // Thứ tự Cạnh A: từ trái sang phải -> [C01, S01, W01, D01]
    const orderA: Record<string, number> = { C01: 1, S01: 2, W01: 3, D01: 4, T01: 5 };
    aCodes.sort((a, b) => (orderA[a] ?? 99) - (orderA[b] ?? 99));

    // Thứ tự Cạnh C: từ góc AC xuống ngoài cùng -> [B01, SP01, R01, M01, T01, P01, A01] (P01, A01 ngoài cùng mép C kề nhau, RULE_08 & RULE_09)
    const orderC: Record<string, number> = {
      B01: 1,
      SP01: 2,
      R01: 3,
      M01: 4,
      T01: 5,
      P01: 10,
      A01: 11,
    };
    cCodes.sort((a, b) => (orderC[a] ?? 99) - (orderC[b] ?? 99));

    let curB = orientAB === 'edge_B' ? wBaseAB : depthA;
    bCodes.forEach((code, idx) => {
      const item = getModAndVariant(code);
      if (!item) return;
      placed.push({
        instanceId: `base-${code}-B-${idx}`,
        moduleId: item.mod.id,
        variantId: item.variant.id,
        code: item.mod.code,
        name: item.mod.name,
        category: item.mod.category,
        tier: 'base',
        edgeId: 'edge_B',
        positionIndex: idx,
        offset: curB,
        width: item.variant.width,
        depth: item.variant.depth,
        height: item.variant.height,
        color: item.mod.color,
      });
      curB += item.variant.width;
    });

    let curA = orientAB === 'edge_A' ? wBaseAB : depthB;
    aCodes.forEach((code, idx) => {
      const item = getModAndVariant(code);
      if (!item) return;
      placed.push({
        instanceId: `base-${code}-A-${idx}`,
        moduleId: item.mod.id,
        variantId: item.variant.id,
        code: item.mod.code,
        name: item.mod.name,
        category: item.mod.category,
        tier: 'base',
        edgeId: 'edge_A',
        positionIndex: idx,
        offset: curA,
        width: item.variant.width,
        depth: item.variant.depth,
        height: item.variant.height,
        color: item.mod.color,
      });
      curA += item.variant.width;
    });

    let curC = orientAC === 'edge_C' ? wBaseAC : depthA;
    cCodes.forEach((code, idx) => {
      const item = getModAndVariant(code);
      if (!item) return;
      placed.push({
        instanceId: `base-${code}-C-${idx}`,
        moduleId: item.mod.id,
        variantId: item.variant.id,
        code: item.mod.code,
        name: item.mod.name,
        category: item.mod.category,
        tier: 'base',
        edgeId: 'edge_C',
        positionIndex: idx,
        offset: curC,
        width: item.variant.width,
        depth: item.variant.depth,
        height: item.variant.height,
        color: item.mod.color,
      });
      curC += item.variant.width;
    });

    return placed;
  }

  if (shape === 'L' && edgeB) {
    const availA = orientAB === 'edge_A' ? edgeA.length - wBaseAB : edgeA.length - depthB;
    const availB = orientAB === 'edge_B' ? edgeB.length - wBaseAB : edgeB.length - depthA;

    // Phân chia khoang công năng hợp lý giữa Cạnh A và Cạnh B
    let bCodes: string[] = [];
    let aCodes: string[] = [];

    // Ưu tiên 1: Cụm tủ cao (F01, P01, A01) quy tụ ở Cạnh B, Khu chuẩn bị & Nấu ở Cạnh A
    for (const code of codesToPlace) {
      if (['F01', 'P01', 'A01'].includes(code)) {
        bCodes.push(code);
      } else if (['S01', 'W01', 'C01', 'B01', 'SP01'].includes(code)) {
        aCodes.push(code);
      } else if (code === 'D01' || code === 'M01') {
        if (bCodes.length <= 3) {
          bCodes.unshift(code);
        } else {
          aCodes.push(code);
        }
      } else {
        // T01, R01...
        if (bCodes.length < aCodes.length) {
          bCodes.unshift(code);
        } else {
          aCodes.push(code);
        }
      }
    }

    const calcMinSum = (codes: string[]) =>
      codes.reduce((sum, c) => {
        const item = getModAndVariant(c);
        if (!item) return sum;
        const minW = item.mod.minWidth || Math.min(...item.mod.variants.map((v) => v.width));
        return sum + minW;
      }, 0);

    // Cân bằng động theo năng lực 2 cạnh
    const movableToB = ['D01', 'M01', 'R01', 'T01', 'SP01'];
    while (calcMinSum(aCodes) > availA && aCodes.length > 2) {
      const idx = aCodes.findIndex((c) => movableToB.includes(c));
      if (idx === -1) break;
      const [moved] = aCodes.splice(idx, 1);
      bCodes.unshift(moved);
    }

    const movableToA = ['D01', 'M01', 'R01', 'T01', 'SP01'];
    while (calcMinSum(bCodes) > availB && bCodes.length > 2) {
      const idx = bCodes.findIndex((c) => movableToA.includes(c));
      if (idx === -1) break;
      const [moved] = bCodes.splice(idx, 1);
      aCodes.push(moved);
    }

    // Tỉa khoang nếu tổng kích thước vẫn vượt chiều dài
    const dropPriority = ['T01', 'R01', 'M01', 'P01', 'A01', 'W01', 'D01'];
    while (calcMinSum(aCodes) > availA && aCodes.length > 2) {
      const idx = aCodes.findIndex((c) => dropPriority.includes(c));
      if (idx === -1) break;
      aCodes.splice(idx, 1);
    }
    while (calcMinSum(bCodes) > availB && bCodes.length > 2) {
      const idx = bCodes.findIndex((c) => dropPriority.includes(c));
      if (idx === -1) break;
      bCodes.splice(dropIdxSafe(bCodes, dropPriority), 1);
    }

    // Sắp xếp Cạnh B: từ góc xuống mép ngoài cùng (F01 hoặc P01, A01 ở mép ngoài)
    const orderB: Record<string, number> = {
      C01: 10,
      S01: 20,
      W01: 30,
      D01: 40,
      R01: 50,
      B01: 60,
      SP01: 70,
      M01: 80,
      T01: 90,
      P01: 150,
      A01: 160,
      F01: 170,
    };
    bCodes.sort((a, b) => (orderB[a] ?? 100) - (orderB[b] ?? 100));

    // Sắp xếp Cạnh A: từ góc sang mép ngoài cùng
    const orderA: Record<string, number> = {
      C01: 10,
      S01: 20,
      W01: 30,
      D01: 40,
      T01: 50,
      R01: 60,
      B01: 70,
      SP01: 80,
      M01: 90,
      P01: 150,
      A01: 160,
      F01: 170,
    };
    aCodes.sort((a, b) => (orderA[a] ?? 100) - (orderA[b] ?? 100));

    let curB = orientAB === 'edge_B' ? wBaseAB : depthA;
    bCodes.forEach((code, idx) => {
      const item = getModAndVariant(code);
      if (!item) return;
      placed.push({
        instanceId: `base-${code}-B-${idx}`,
        moduleId: item.mod.id,
        variantId: item.variant.id,
        code: item.mod.code,
        name: item.mod.name,
        category: item.mod.category,
        tier: 'base',
        edgeId: 'edge_B',
        positionIndex: idx,
        offset: curB,
        width: item.variant.width,
        depth: item.variant.depth,
        height: item.variant.height,
        color: item.mod.color,
      });
      curB += item.variant.width;
    });

    let curA = orientAB === 'edge_A' ? wBaseAB : depthB;
    aCodes.forEach((code, idx) => {
      const item = getModAndVariant(code);
      if (!item) return;
      placed.push({
        instanceId: `base-${code}-A-${idx}`,
        moduleId: item.mod.id,
        variantId: item.variant.id,
        code: item.mod.code,
        name: item.mod.name,
        category: item.mod.category,
        tier: 'base',
        edgeId: 'edge_A',
        positionIndex: idx,
        offset: curA,
        width: item.variant.width,
        depth: item.variant.depth,
        height: item.variant.height,
        color: item.mod.color,
      });
      curA += item.variant.width;
    });

    return placed;
  }

  function dropIdxSafe(arr: string[], priority: string[]): number {
    for (const p of priority) {
      const idx = arr.findIndex((c) => c === p);
      if (idx !== -1) return idx;
    }
    return arr.length - 1;
  }

  // Chữ I:
  const orderI: Record<string, number> = {
    F01: 10,
    C01: 30,
    W01: 40,
    S01: 50,
    D01: 60,
    R01: 70,
    B01: 80,
    SP01: 90,
    M01: 100,
    T01: 110,
    P01: 120,
    A01: 130,
  };
  const sortedCodes = [...codesToPlace].sort(
    (a, b) => (orderI[a] ?? 999) - (orderI[b] ?? 999)
  );

  let curA = 0;
  sortedCodes.forEach((code, idx) => {
    const item = getModAndVariant(code);
    if (!item) return;
    placed.push({
      instanceId: `base-${code}-${idx}`,
      moduleId: item.mod.id,
      variantId: item.variant.id,
      code: item.mod.code,
      name: item.mod.name,
      category: item.mod.category,
      tier: 'base',
      edgeId: 'edge_A',
      positionIndex: idx,
      offset: curA,
      width: item.variant.width,
      depth: item.variant.depth,
      height: item.variant.height,
      color: item.mod.color,
    });
    curA += item.variant.width;
  });

  return placed;
}

// Helper to push history state
function pushHistory(
  state: KitchenStoreState,
  newLayout: KitchenLayout
): Partial<KitchenStoreState> {
  const normalizedBase = normalizePlacedModules(newLayout);
  const layoutWithBase: KitchenLayout = {
    ...newLayout,
    placedModules: normalizedBase,
    placedUpperModules:
      newLayout.placedUpperModules !== undefined
        ? newLayout.placedUpperModules
        : state.layout.placedUpperModules || [],
  };
  const normalizedUpper = normalizePlacedUpperModules(layoutWithBase);
  const layoutWithNorm: KitchenLayout = {
    ...layoutWithBase,
    placedUpperModules: normalizedUpper,
  };
  const history = [...state.history, state.layout].slice(-20); // Giữ tối đa 20 bước history
  const future: KitchenLayout[] = [];
  const rep = ruleEngineInstance.evaluate(
    layoutWithNorm,
    state.catalog,
    newLayout.designPhase || state.designPhase
  );

  return {
    layout: layoutWithNorm,
    validationReport: rep,
    history,
    future,
    canUndo: true,
    canRedo: false,
  };
}

export const useKitchenStore = create<KitchenStoreState>((set, get) => {
  const initialReport = ruleEngineInstance.evaluate(INITIAL_LAYOUT, DEFAULT_MODULES);

  // Load saved projects from LocalStorage if available
  let localProjects: KitchenLayout[] = [];
  try {
    const raw = localStorage.getItem('kitchen_saved_projects');
    if (raw) localProjects = JSON.parse(raw);
  } catch (e) {
    console.error('Error reading localStorage', e);
  }

  return {
    layout: INITIAL_LAYOUT,
    catalog: DEFAULT_MODULES,
    rules: DEFAULT_RULES,
    validationReport: initialReport,

    selectedModuleId: null,
    selectedCornerId: null,
    selectedGapId: null,
    highlightedModuleIds: [],
    activeTab: 'catalog',
    activeCabinetTier: 'base',
    designPhase: 'setup',
    zoom: 0.24,
    pan: { x: 80, y: 90 },
    showWorkTriangle: true,
    showDimensions: true,

    selectedModuleCodes: ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01'],
    generatedCandidates: [],
    selectedCandidateIndex: null,
    generationError: null,

    history: [],
    future: [],
    savedProjects: localProjects,
    shapeLayouts: {},
    canUndo: false,
    canRedo: false,

    // UI actions
    setSelectedModuleId: (id) => set({ selectedModuleId: id, selectedCornerId: null, selectedGapId: null }),
    setSelectedCornerId: (id) => set({ selectedCornerId: id, selectedModuleId: null, selectedGapId: null }),
    setSelectedGapId: (id) => set({ selectedGapId: id, selectedModuleId: null, selectedCornerId: null }),
    toggleCornerOrientation: (cornerId) => {
      const state = get();
      const layout = state.layout;
      if (layout.shape === 'I') return;

      const isAC = cornerId.includes('AC');
      const updatedLayout: KitchenLayout = {
        ...layout,
        updatedAt: new Date().toISOString(),
      };

      if (!isAC) {
        const cur = layout.cornerOrientationAB || 'edge_A';
        updatedLayout.cornerOrientationAB = cur === 'edge_A' ? 'edge_B' : 'edge_A';
      } else {
        const cur = layout.cornerOrientationAC || 'edge_A';
        updatedLayout.cornerOrientationAC = cur === 'edge_A' ? 'edge_C' : 'edge_A';
      }

      set(pushHistory(state, updatedLayout));
    },
    setCornerOrientation: (cornerId, orientation) => {
      const state = get();
      const layout = state.layout;
      if (layout.shape === 'I') return;

      const isAC = cornerId.includes('AC');
      const updatedLayout: KitchenLayout = {
        ...layout,
        updatedAt: new Date().toISOString(),
      };

      if (!isAC) {
        updatedLayout.cornerOrientationAB = orientation as 'edge_A' | 'edge_B';
      } else {
        updatedLayout.cornerOrientationAC = orientation as 'edge_A' | 'edge_C';
      }

      set(pushHistory(state, updatedLayout));
    },
    updateCornerWidth: (cornerId, tier, width) => {
      const state = get();
      const layout = state.layout;
      if (layout.shape === 'I') return;

      const isAC = cornerId.includes('AC');
      const updatedLayout: KitchenLayout = {
        ...layout,
        updatedAt: new Date().toISOString(),
      };

      if (tier === 'base') {
        const validW = Math.max(980, Math.min(1030, Math.round(width)));
        if (!isAC) {
          updatedLayout.cornerWidthBaseAB = validW;
        } else {
          updatedLayout.cornerWidthBaseAC = validW;
        }
      } else {
        const validW = Math.max(730, Math.min(780, Math.round(width)));
        if (!isAC) {
          updatedLayout.cornerWidthUpperAB = validW;
        } else {
          updatedLayout.cornerWidthUpperAC = validW;
        }
      }

      set(pushHistory(state, updatedLayout));
    },
    setHighlightedModuleIds: (ids) => set({ highlightedModuleIds: ids }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setActiveCabinetTier: (tier) => set({ activeCabinetTier: tier }),
    setDesignPhase: (phase) => {
      const state = get();
      const updatedLayout: KitchenLayout = {
        ...state.layout,
        designPhase: phase,
      };
      const rep = ruleEngineInstance.evaluate(updatedLayout, state.catalog, phase);
      set({
        designPhase: phase,
        layout: updatedLayout,
        validationReport: rep,
        activeCabinetTier: phase === 'design_base' ? 'base' : 'all',
      });
    },

    initKitchenLayout: ({ shape, edgeA, edgeB, edgeC, baseModuleCodes }) => {
      const state = get();
      const layoutEngine = new LayoutEngine(state.rules);

      const newEdgeA = {
        id: 'edge_A' as EdgeId,
        name: 'Cạnh A',
        length: edgeA.length,
        depth: edgeA.depth || 600,
        height: 850,
      };

      const newEdgeB =
        shape === 'L' || shape === 'U'
          ? {
              id: 'edge_B' as EdgeId,
              name: 'Cạnh B',
              length: edgeB?.length || 2400,
              depth: edgeB?.depth || 600,
              height: 850,
              angle: 90,
            }
          : undefined;

      const newEdgeC =
        shape === 'U'
          ? {
              id: 'edge_C' as EdgeId,
              name: 'Cạnh C',
              length: edgeC?.length || 2400,
              depth: edgeC?.depth || 600,
              height: 850,
              angle: 90,
            }
          : undefined;

      // Khoang góc nối chỉ được sinh ra khi làm bếp chữ L và chữ U. Bếp chữ I loại bỏ K01.
      const baseCodes =
        shape === 'I' ? baseModuleCodes.filter((c) => c !== 'K01') : baseModuleCodes;

      // Chạy generator tự động sinh phương án tối ưu số 1 từ các khoang tủ dưới đã chọn
      const genResult = layoutEngine.generateLayouts({
        shape,
        edgeA: newEdgeA,
        edgeB: newEdgeB,
        edgeC: newEdgeC,
        catalog: state.catalog,
        rules: state.rules,
        selectedModuleCodes: baseCodes,
      });

      let placedModules: PlacedModuleInstance[] = [];
      const initialCandidateLayout = genResult.candidates && genResult.candidates.length > 0 ? genResult.candidates[0].layout : null;
      if (initialCandidateLayout) {
        placedModules = initialCandidateLayout.placedModules;
      } else {
        // Fallback: Phân bổ công năng công thái học chuẩn NKBA & Tam giác công năng cho các cạnh
        placedModules = createErgonomicFallbackModules(
          shape,
          newEdgeA,
          newEdgeB,
          newEdgeC,
          baseCodes,
          state.catalog,
          newEdgeA.length >= (newEdgeB?.length || 0) ? 'edge_A' : 'edge_B',
          'edge_C',
          1000,
          1000
        );
      }

      const newLayout: KitchenLayout = {
        id: `layout-${Date.now()}`,
        name: `Bếp chữ ${shape} (${newEdgeA.length}mm)`,
        shape,
        edgeA: newEdgeA,
        edgeB: newEdgeB,
        edgeC: newEdgeC,
        placedModules,
        placedUpperModules: [],
        upperDepth: 350,
        upperHeight: 750,
        cornerConfig: { size: 600 },
        cornerOrientationAB: initialCandidateLayout?.cornerOrientationAB || (newEdgeA.length >= (newEdgeB?.length || 0) ? 'edge_A' : 'edge_B'),
        cornerOrientationAC: initialCandidateLayout?.cornerOrientationAC || 'edge_C',
        cornerWidthBaseAB: initialCandidateLayout?.cornerWidthBaseAB || 1000,
        cornerWidthBaseAC: initialCandidateLayout?.cornerWidthBaseAC || 1000,
        cornerWidthUpperAB: initialCandidateLayout?.cornerWidthUpperAB || 750,
        cornerWidthUpperAC: initialCandidateLayout?.cornerWidthUpperAC || 750,
        selectedModuleCodes: baseModuleCodes,
        designPhase: 'design_base',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        ...pushHistory(state, newLayout),
        designPhase: 'design_base',
        activeCabinetTier: 'base',
        selectedModuleCodes: baseModuleCodes,
        shapeLayouts: {
          ...state.shapeLayouts,
          [shape]: newLayout,
        },
      });
    },

    generateUpperWithConfig: (upperCodes: string[]) => {
      const state = get();
      const layoutEngine = new LayoutEngine(state.rules);

      const generatedUpper = layoutEngine.generateUpperCabinets(
        state.layout,
        upperCodes,
        state.catalog
      );

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedUpperModules: generatedUpper,
        designPhase: 'design_upper',
        updatedAt: new Date().toISOString(),
      };

      set({
        ...pushHistory(state, updatedLayout),
        designPhase: 'design_upper',
        activeCabinetTier: 'all',
      });
    },

    resetToSetupWizard: () => {
      set({
        designPhase: 'setup',
      });
    },
    confirmBaseAndGenerateUpper: () => {
      const state = get();
      const layoutEngine = new LayoutEngine(state.rules);
      const selectedCodes =
        state.selectedModuleCodes && state.selectedModuleCodes.length > 0
          ? state.selectedModuleCodes
          : ['UH01', 'UB01', 'UT01'];

      const generatedUpper = layoutEngine.generateUpperCabinets(
        state.layout,
        selectedCodes,
        state.catalog
      );

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedUpperModules: generatedUpper,
        designPhase: 'design_upper',
        updatedAt: new Date().toISOString(),
      };

      set({
        ...pushHistory(state, updatedLayout),
        designPhase: 'design_upper',
        activeCabinetTier: 'all',
      });
    },
    regenerateUpperCabinets: () => {
      const state = get();
      const layoutEngine = new LayoutEngine(state.rules);
      const selectedCodes =
        state.selectedModuleCodes && state.selectedModuleCodes.length > 0
          ? state.selectedModuleCodes
          : ['UH01', 'UB01', 'UT01'];

      const generatedUpper = layoutEngine.generateUpperCabinets(
        state.layout,
        selectedCodes,
        state.catalog
      );

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedUpperModules: generatedUpper,
        updatedAt: new Date().toISOString(),
      };

      set(pushHistory(state, updatedLayout));
    },
    setZoom: (zoom) =>
      set((state) => ({
        zoom: typeof zoom === 'function' ? zoom(state.zoom) : zoom,
      })),
    setPan: (pan) =>
      set((state) => ({
        pan: typeof pan === 'function' ? pan(state.pan) : pan,
      })),
    resetView: () => set({ zoom: 0.24, pan: { x: 80, y: 90 } }),
    toggleWorkTriangle: () =>
      set((state) => ({ showWorkTriangle: !state.showWorkTriangle })),
    toggleDimensions: () =>
      set((state) => ({ showDimensions: !state.showDimensions })),

    // Layout Shape & Dimensions (Tách biệt độc lập từng mẫu bếp I, L, U)
    updateShape: (newShape) => {
      const state = get();
      if (state.layout.shape === newShape) return;

      // 1. Lưu lại bản vẽ hiện tại vào shapeLayouts tương ứng
      const updatedShapeLayouts: Partial<Record<KitchenShape, KitchenLayout>> = {
        ...state.shapeLayouts,
        [state.layout.shape]: state.layout,
      };

      // 2. Nếu đã có bản vẽ lưu của newShape, khôi phục lại nguyên vẹn bản vẽ đó
      if (updatedShapeLayouts[newShape]) {
        let targetLayout = updatedShapeLayouts[newShape]!;
        // Khoang góc nối chỉ được sinh ra khi làm bếp chữ L và chữ U. Bếp chữ I loại bỏ K01 và UK01.
        // Kiểm tra nếu bản vẽ đã lưu của Bếp chữ U bị lỗi dồn hết vào Cạnh A thì tạo mới lại
        const isBrokenU =
          newShape === 'U' &&
          targetLayout.placedModules.length > 0 &&
          targetLayout.placedModules.every((m) => m.edgeId === 'edge_A');

        const isBrokenL =
          newShape === 'L' &&
          targetLayout.placedModules.length > 0 &&
          (targetLayout.placedModules.filter((m) => m.edgeId === 'edge_B').length <= 1 &&
           targetLayout.placedModules.filter((m) => m.edgeId === 'edge_A').length >= 5);

        // Đánh giá kiểm tra nếu bản vẽ cũ bị vi phạm lỗi tràn cạnh nghiêm trọng thì tái cấu trúc lại
        const checkRep = ruleEngineInstance.evaluate(targetLayout, state.catalog, targetLayout.designPhase);
        const hasOverflow = checkRep.violations.some(
          (v) => v.ruleCode === 'RULE_03' || v.message.includes('tràn kích thước')
        );

        if (!isBrokenU && !isBrokenL && !hasOverflow) {
          if (newShape === 'I') {
            targetLayout = {
              ...targetLayout,
              placedModules: targetLayout.placedModules.filter(
                (m) => m.code !== 'K01' && m.code !== 'UK01' && m.category !== 'corner'
              ),
              placedUpperModules: (targetLayout.placedUpperModules || []).filter(
                (m) => m.code !== 'K01' && m.code !== 'UK01' && m.category !== 'corner'
              ),
              selectedModuleCodes: (targetLayout.selectedModuleCodes || []).filter(
                (c) => c !== 'K01' && c !== 'UK01'
              ),
            };
          }
          const rep = ruleEngineInstance.evaluate(targetLayout, state.catalog, targetLayout.designPhase);
          const targetCodes =
            targetLayout.selectedModuleCodes && targetLayout.selectedModuleCodes.length > 0
              ? targetLayout.selectedModuleCodes
              : Array.from(new Set(targetLayout.placedModules.map((m) => m.code)));
          const finalTargetCodes = newShape === 'I' ? targetCodes.filter((c) => c !== 'K01') : targetCodes;

          set({
            ...pushHistory(state, targetLayout),
            shapeLayouts: updatedShapeLayouts,
            designPhase: targetLayout.designPhase || 'design_base',
            activeCabinetTier: 'all',
            validationReport: rep,
            selectedModuleCodes: finalTargetCodes,
          });
          return;
        }
      }

      // 3. Nếu chưa có bản vẽ cho newShape (hoặc bản vẽ cũ bị lỗi), khởi tạo độc lập hoàn toàn
      const layoutEngine = new LayoutEngine(state.rules);
      // Kế thừa các khoang đang dùng từ layout hiện tại (ví dụ P01, A01...) để không bị mất khi chuyển kiểu bếp
      const currentCodes = state.layout.placedModules
        .map((m) => m.code)
        .filter((c) => c !== 'K01' && c !== 'UK01');
      const baseCodes =
        currentCodes.length > 0
          ? Array.from(new Set(currentCodes))
          : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01'];

      if (newShape !== 'I' && !baseCodes.includes('K01')) {
        baseCodes.push('K01');
      }

      let edgeA = { id: 'edge_A' as EdgeId, name: 'Cạnh A', length: 3600, depth: 600, height: 850 };
      let edgeB: { id: EdgeId; name: string; length: number; depth: number; height: number; angle?: number } | undefined = undefined;
      let edgeC: { id: EdgeId; name: string; length: number; depth: number; height: number; angle?: number } | undefined = undefined;

      if (newShape === 'L') {
        edgeA = { id: 'edge_A' as EdgeId, name: 'Cạnh A', length: 3000, depth: 600, height: 850 };
        edgeB = { id: 'edge_B' as EdgeId, name: 'Cạnh B', length: 2400, depth: 600, height: 850, angle: 90 };
      } else if (newShape === 'U') {
        edgeA = { id: 'edge_A' as EdgeId, name: 'Cạnh A', length: 3400, depth: 600, height: 850 };
        edgeB = { id: 'edge_B' as EdgeId, name: 'Cạnh B', length: 2400, depth: 600, height: 850, angle: 90 };
        edgeC = { id: 'edge_C' as EdgeId, name: 'Cạnh C', length: 2400, depth: 600, height: 850, angle: 90 };
      }

      const genResult = layoutEngine.generateLayouts({
        shape: newShape,
        edgeA,
        edgeB,
        edgeC,
        catalog: state.catalog,
        rules: state.rules,
        selectedModuleCodes: baseCodes,
      });

      let placedModules: PlacedModuleInstance[] = [];
      const initialCandidateLayout = genResult.candidates && genResult.candidates.length > 0 ? genResult.candidates[0].layout : null;
      if (initialCandidateLayout) {
        placedModules = initialCandidateLayout.placedModules;
      } else {
        // Fallback: Phân bổ công năng công thái học chuẩn NKBA & Tam giác công năng cho các cạnh
        placedModules = createErgonomicFallbackModules(
          newShape,
          edgeA,
          edgeB,
          edgeC,
          baseCodes,
          state.catalog,
          edgeA.length >= (edgeB?.length || 0) ? 'edge_A' : 'edge_B',
          'edge_C',
          1000,
          1000
        );
      }

      const newLayout: KitchenLayout = {
        id: `layout-${newShape}-${Date.now()}`,
        name: `Bếp chữ ${newShape}`,
        shape: newShape,
        edgeA,
        edgeB,
        edgeC,
        placedModules,
        placedUpperModules: [],
        upperDepth: 350,
        upperHeight: 750,
        cornerConfig: { size: 600 },
        cornerOrientationAB: initialCandidateLayout?.cornerOrientationAB || (edgeA.length >= (edgeB?.length || 0) ? 'edge_A' : 'edge_B'),
        cornerOrientationAC: initialCandidateLayout?.cornerOrientationAC || 'edge_C',
        cornerWidthBaseAB: initialCandidateLayout?.cornerWidthBaseAB || 1000,
        cornerWidthBaseAC: initialCandidateLayout?.cornerWidthBaseAC || 1000,
        cornerWidthUpperAB: initialCandidateLayout?.cornerWidthUpperAB || 750,
        cornerWidthUpperAC: initialCandidateLayout?.cornerWidthUpperAC || 750,
        selectedModuleCodes: baseCodes,
        designPhase: 'design_base',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      updatedShapeLayouts[newShape] = newLayout;

      const rep = ruleEngineInstance.evaluate(newLayout, state.catalog, 'design_base');
      set({
        ...pushHistory(state, newLayout),
        shapeLayouts: updatedShapeLayouts,
        designPhase: 'design_base',
        activeCabinetTier: 'base',
        validationReport: rep,
        selectedModuleCodes: baseCodes,
      });
    },

    updateEdgeDimensions: (edgeId, dims) => {
      const state = get();
      const updated = { ...state.layout };

      if (edgeId === 'edge_A') {
        updated.edgeA = { ...updated.edgeA, ...dims };
      } else if (edgeId === 'edge_B' && updated.edgeB) {
        updated.edgeB = { ...updated.edgeB, ...dims };
      } else if (edgeId === 'edge_C' && updated.edgeC) {
        updated.edgeC = { ...updated.edgeC, ...dims };
      }

      set(pushHistory(state, updated));
    },

    snapEdgeToModules: (edgeId, gapMm) => {
      const state = get();
      if (!gapMm || gapMm <= 0) return;
      const updated = { ...state.layout };

      if (edgeId === 'edge_A') {
        const curLen = updated.edgeA.length;
        updated.edgeA = { ...updated.edgeA, length: Math.max(1200, curLen - gapMm) };
      } else if (edgeId === 'edge_B' && updated.edgeB) {
        const curLen = updated.edgeB.length;
        updated.edgeB = { ...updated.edgeB, length: Math.max(1200, curLen - gapMm) };
      } else if (edgeId === 'edge_C' && updated.edgeC) {
        const curLen = updated.edgeC.length;
        updated.edgeC = { ...updated.edgeC, length: Math.max(1200, curLen - gapMm) };
      }

      set(pushHistory(state, { ...updated, updatedAt: new Date().toISOString() }));
    },

    autoFillGap: (edgeId, tier, gapMm) => {
      const state = get();
      if (!gapMm || gapMm <= 0) return;

      if (tier === 'base') {
        // 1. Nếu trên edgeId đã có T01 -> Tăng kích thước T01 thêm gapMm
        const t01Module = state.layout.placedModules.find(
          (m) => m.edgeId === edgeId && m.code === 'T01'
        );

        if (t01Module) {
          const newWidth = t01Module.width + gapMm;
          let curOffset = 0;
          const updatedModules = state.layout.placedModules.map((m) => {
            if (m.edgeId === edgeId) {
              const w = m.instanceId === t01Module.instanceId ? newWidth : m.width;
              const res = { ...m, width: w, offset: curOffset };
              curOffset += w;
              return res;
            }
            return m;
          });
          const updatedLayout: KitchenLayout = {
            ...state.layout,
            placedModules: updatedModules,
            updatedAt: new Date().toISOString(),
          };
          set(pushHistory(state, updatedLayout));
          return;
        }

        // 2. Nếu gapMm >= 250 -> Thêm khoang tủ chứa đồ T01 vào cạnh này
        const t01Mod = state.catalog.find((m) => m.code === 'T01');
        if (t01Mod && gapMm >= 250) {
          const edgeModules = state.layout.placedModules.filter((m) => m.edgeId === edgeId);
          let maxOffset = 0;
          edgeModules.forEach((m) => {
            if (m.offset + m.width > maxOffset) maxOffset = m.offset + m.width;
          });
          const newInstance: PlacedModuleInstance = {
            instanceId: `placed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            moduleId: t01Mod.id,
            variantId: t01Mod.variants[0]?.id || 'var-t01',
            code: t01Mod.code,
            name: t01Mod.name,
            category: t01Mod.category,
            width: gapMm,
            depth: t01Mod.variants[0]?.depth || 600,
            height: t01Mod.variants[0]?.height || 850,
            color: t01Mod.color || '#0284c7',
            edgeId,
            offset: maxOffset,
            positionIndex: edgeModules.length,
            tier: 'base',
          };
          const updatedLayout: KitchenLayout = {
            ...state.layout,
            placedModules: [...state.layout.placedModules, newInstance],
            updatedAt: new Date().toISOString(),
          };
          set(pushHistory(state, updatedLayout));
          return;
        }

        // 3. Nếu gapMm < 250 -> Dãn khoang cuối cùng của cạnh hoặc co tường
        const edgeModules = state.layout.placedModules.filter((m) => m.edgeId === edgeId);
        if (edgeModules.length > 0) {
          const lastMod = edgeModules[edgeModules.length - 1];
          const newWidth = lastMod.width + gapMm;
          const updatedModules = state.layout.placedModules.map((m) =>
            m.instanceId === lastMod.instanceId
              ? { ...m, width: newWidth }
              : m
          );
          set(
            pushHistory(state, {
              ...state.layout,
              placedModules: updatedModules,
              updatedAt: new Date().toISOString(),
            })
          );
          return;
        }

        // Fallback: co tường vừa khít
        state.snapEdgeToModules(edgeId, gapMm);
      } else {
        // Tủ trên (upper)
        const ut01Module = (state.layout.placedUpperModules || []).find(
          (m) => m.edgeId === edgeId && m.code === 'UT01'
        );

        if (ut01Module) {
          const newWidth = ut01Module.width + gapMm;
          const updatedModules = (state.layout.placedUpperModules || []).map((m) => {
            if (m.instanceId === ut01Module.instanceId) {
              return { ...m, width: newWidth };
            }
            return m;
          });
          const updatedLayout: KitchenLayout = {
            ...state.layout,
            placedUpperModules: updatedModules,
            updatedAt: new Date().toISOString(),
          };
          set(pushHistory(state, updatedLayout));
          return;
        }

        // Thêm khoang tủ đồ trên UT01 nếu gapMm >= 250
        const ut01Mod = state.catalog.find((m) => m.code === 'UT01');
        if (ut01Mod && gapMm >= 250) {
          const edgeModules = (state.layout.placedUpperModules || []).filter((m) => m.edgeId === edgeId);
          let maxOffset = 0;
          edgeModules.forEach((m) => {
            if (m.offset + m.width > maxOffset) maxOffset = m.offset + m.width;
          });
          const newInstance: PlacedModuleInstance = {
            instanceId: `placed-upper-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            moduleId: ut01Mod.id,
            variantId: ut01Mod.variants[0]?.id || 'var-ut01',
            code: ut01Mod.code,
            name: ut01Mod.name,
            category: ut01Mod.category,
            width: gapMm,
            depth: ut01Mod.variants[0]?.depth || 350,
            height: ut01Mod.variants[0]?.height || 750,
            color: ut01Mod.color || '#f59e0b',
            edgeId,
            offset: maxOffset,
            positionIndex: edgeModules.length,
            tier: 'upper',
          };
          const updatedLayout: KitchenLayout = {
            ...state.layout,
            placedUpperModules: [...(state.layout.placedUpperModules || []), newInstance],
            updatedAt: new Date().toISOString(),
          };
          set(pushHistory(state, updatedLayout));
          return;
        }

        // Co tường
        state.snapEdgeToModules(edgeId, gapMm);
      }
    },

    // Module Placement & Reordering
    addModuleToEdge: (moduleId, edgeId, variantId, targetIndex) => {
      const state = get();
      const mod = state.catalog.find((m) => m.id === moduleId);
      if (!mod) return;

      // Khoang góc nối chỉ được sinh ra khi làm bếp chữ L và chữ U
      if (
        state.layout.shape === 'I' &&
        (mod.category === 'corner' || mod.code === 'K01' || mod.code === 'UK01' || mod.metadata?.isCorner)
      ) {
        alert('Khoang góc nối chỉ được sử dụng khi thiết kế bếp chữ L hoặc chữ U!');
        return;
      }

      const variant =
        (variantId ? mod.variants.find((v) => v.id === variantId) : null) ||
        mod.variants[0];

      if (mod.tier === 'upper') {
        const currentUpperModules = [
          ...(state.layout.placedUpperModules || []).filter(
            (m) => m.edgeId === edgeId
          ),
        ].sort((a, b) => a.positionIndex - b.positionIndex);

        const insertIndex =
          targetIndex !== undefined ? targetIndex : currentUpperModules.length;

        const newInstance: PlacedModuleInstance = {
          instanceId: `inst-upper-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          moduleId: mod.id,
          variantId: variant.id,
          code: mod.code,
          name: mod.name,
          category: mod.category,
          tier: 'upper',
          edgeId,
          positionIndex: insertIndex,
          offset: 0,
          width: variant.width,
          depth: variant.depth || 350,
          height: variant.height || 750,
          color: mod.color,
        };

        currentUpperModules.splice(insertIndex, 0, newInstance);
        const reindexed = currentUpperModules.map((m, idx) => ({
          ...m,
          positionIndex: idx,
        }));

        const otherUpper = (state.layout.placedUpperModules || []).filter(
          (m) => m.edgeId !== edgeId
        );

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedUpperModules: [...otherUpper, ...reindexed],
          updatedAt: new Date().toISOString(),
        };

        set({
          ...pushHistory(state, updatedLayout),
          selectedModuleId: newInstance.instanceId,
        });
        return;
      }

      const currentEdgeModules = state.layout.placedModules
        .filter((m) => m.edgeId === edgeId)
        .sort((a, b) => a.positionIndex - b.positionIndex);

      const insertIndex =
        targetIndex !== undefined ? targetIndex : currentEdgeModules.length;

      const newInstance: PlacedModuleInstance = {
        instanceId: `inst-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        moduleId: mod.id,
        variantId: variant.id,
        code: mod.code,
        name: mod.name,
        category: mod.category,
        tier: 'base',
        edgeId,
        positionIndex: insertIndex,
        offset: 0,
        width: variant.width,
        depth: variant.depth,
        height: variant.height,
        color: mod.color,
      };

      // Chèn vào đúng vị trí và đánh lại positionIndex
      currentEdgeModules.splice(insertIndex, 0, newInstance);
      const reindexedEdgeModules = currentEdgeModules.map((m, idx) => ({
        ...m,
        positionIndex: idx,
      }));

      // Các module ở các cạnh khác giữ nguyên
      const otherEdgeModules = state.layout.placedModules.filter(
        (m) => m.edgeId !== edgeId
      );

      const updatedPlacedModules = [...otherEdgeModules, ...reindexedEdgeModules];
      const updatedCodes = Array.from(new Set(updatedPlacedModules.map((m) => m.code)));

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedModules: updatedPlacedModules,
        updatedAt: new Date().toISOString(),
      };

      set({
        ...pushHistory(state, updatedLayout),
        selectedModuleId: newInstance.instanceId,
        selectedModuleCodes: updatedCodes,
      });
    },

    removePlacedModule: (instanceId) => {
      const state = get();
      const targetBase = state.layout.placedModules.find(
        (m) => m.instanceId === instanceId
      );

      if (targetBase) {
        const remainingEdgeModules = state.layout.placedModules
          .filter((m) => m.edgeId === targetBase.edgeId && m.instanceId !== instanceId)
          .sort((a, b) => a.positionIndex - b.positionIndex)
          .map((m, idx) => ({ ...m, positionIndex: idx }));

        const otherEdgeModules = state.layout.placedModules.filter(
          (m) => m.edgeId !== targetBase.edgeId
        );

        const remainingAllBase = [...otherEdgeModules, ...remainingEdgeModules];
        const remainingCodes = Array.from(new Set(remainingAllBase.map((m) => m.code)));

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedModules: remainingAllBase,
          updatedAt: new Date().toISOString(),
        };

        set({
          ...pushHistory(state, updatedLayout),
          selectedModuleId: null,
          selectedModuleCodes: remainingCodes,
        });
        return;
      }

      const targetUpper = (state.layout.placedUpperModules || []).find(
        (m) => m.instanceId === instanceId
      );

      if (targetUpper) {
        const remainingUpper = (state.layout.placedUpperModules || [])
          .filter((m) => m.edgeId === targetUpper.edgeId && m.instanceId !== instanceId)
          .sort((a, b) => a.positionIndex - b.positionIndex)
          .map((m, idx) => ({ ...m, positionIndex: idx }));

        const otherUpper = (state.layout.placedUpperModules || []).filter(
          (m) => m.edgeId !== targetUpper.edgeId
        );

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedUpperModules: [...otherUpper, ...remainingUpper],
          updatedAt: new Date().toISOString(),
        };

        set({
          ...pushHistory(state, updatedLayout),
          selectedModuleId: null,
        });
      }
    },

    moveModule: (instanceId, targetEdgeId, targetIndex) => {
      const state = get();
      const targetBase = state.layout.placedModules.find(
        (m) => m.instanceId === instanceId
      );

      if (targetBase) {
        // Xóa khỏi edge cũ
        const oldEdgeRemaining = state.layout.placedModules
          .filter((m) => m.edgeId === targetBase.edgeId && m.instanceId !== instanceId)
          .sort((a, b) => a.positionIndex - b.positionIndex)
          .map((m, idx) => ({ ...m, positionIndex: idx }));

        // Chèn vào edge mới
        const newEdgeModules = (
          targetBase.edgeId === targetEdgeId
            ? oldEdgeRemaining
            : state.layout.placedModules.filter((m) => m.edgeId === targetEdgeId)
        ).sort((a, b) => a.positionIndex - b.positionIndex);

        const updatedTarget: PlacedModuleInstance = {
          ...targetBase,
          edgeId: targetEdgeId,
        };

        const clampedIndex = Math.max(0, Math.min(newEdgeModules.length, targetIndex));
        newEdgeModules.splice(clampedIndex, 0, updatedTarget);
        const reindexedNew = newEdgeModules.map((m, idx) => ({
          ...m,
          positionIndex: idx,
        }));

        const finalModules =
          targetBase.edgeId === targetEdgeId
            ? [
                ...state.layout.placedModules.filter(
                  (m) => m.edgeId !== targetEdgeId
                ),
                ...reindexedNew,
              ]
            : [
                ...state.layout.placedModules.filter(
                  (m) => m.edgeId !== targetBase.edgeId && m.edgeId !== targetEdgeId
                ),
                ...oldEdgeRemaining,
                ...reindexedNew,
              ];

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedModules: finalModules,
          updatedAt: new Date().toISOString(),
        };

        set(pushHistory(state, updatedLayout));
        return;
      }

      // Check upper modules
      const targetUpper = (state.layout.placedUpperModules || []).find(
        (m) => m.instanceId === instanceId
      );
      if (targetUpper) {
        const oldEdgeRemaining = (state.layout.placedUpperModules || [])
          .filter((m) => m.edgeId === targetUpper.edgeId && m.instanceId !== instanceId)
          .sort((a, b) => a.positionIndex - b.positionIndex)
          .map((m, idx) => ({ ...m, positionIndex: idx }));

        const newEdgeModules = (
          targetUpper.edgeId === targetEdgeId
            ? oldEdgeRemaining
            : (state.layout.placedUpperModules || []).filter((m) => m.edgeId === targetEdgeId)
        ).sort((a, b) => a.positionIndex - b.positionIndex);

        const updatedTarget: PlacedModuleInstance = {
          ...targetUpper,
          edgeId: targetEdgeId,
        };

        const clampedIndex = Math.max(0, Math.min(newEdgeModules.length, targetIndex));
        newEdgeModules.splice(clampedIndex, 0, updatedTarget);
        const reindexedNew = newEdgeModules.map((m, idx) => ({
          ...m,
          positionIndex: idx,
        }));

        const finalModules =
          targetUpper.edgeId === targetEdgeId
            ? [
                ...(state.layout.placedUpperModules || []).filter(
                  (m) => m.edgeId !== targetEdgeId
                ),
                ...reindexedNew,
              ]
            : [
                ...(state.layout.placedUpperModules || []).filter(
                  (m) => m.edgeId !== targetUpper.edgeId && m.edgeId !== targetEdgeId
                ),
                ...oldEdgeRemaining,
                ...reindexedNew,
              ];

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedUpperModules: finalModules,
          updatedAt: new Date().toISOString(),
        };

        set(pushHistory(state, updatedLayout));
      }
    },

    reorderModulesOnEdge: (edgeId, newOrderInstanceIds) => {
      const state = get();
      const isUpper = (state.layout.placedUpperModules || []).some((m) =>
        newOrderInstanceIds.includes(m.instanceId)
      );

      if (isUpper) {
        const edgeModules = (state.layout.placedUpperModules || []).filter(
          (m) => m.edgeId === edgeId
        );
        const otherModules = (state.layout.placedUpperModules || []).filter(
          (m) => m.edgeId !== edgeId
        );
        const map = new Map(edgeModules.map((m) => [m.instanceId, m]));
        const reordered: PlacedModuleInstance[] = [];

        newOrderInstanceIds.forEach((id, idx) => {
          const item = map.get(id);
          if (item) {
            reordered.push({ ...item, positionIndex: idx });
          }
        });

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedUpperModules: [...otherModules, ...reordered],
          updatedAt: new Date().toISOString(),
        };

        set(pushHistory(state, updatedLayout));
        return;
      }

      const edgeModules = state.layout.placedModules.filter(
        (m) => m.edgeId === edgeId
      );
      const otherModules = state.layout.placedModules.filter(
        (m) => m.edgeId !== edgeId
      );

      const map = new Map(edgeModules.map((m) => [m.instanceId, m]));
      const reordered: PlacedModuleInstance[] = [];

      newOrderInstanceIds.forEach((id, idx) => {
        const item = map.get(id);
        if (item) {
          reordered.push({ ...item, positionIndex: idx });
        }
      });

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedModules: [...otherModules, ...reordered],
        updatedAt: new Date().toISOString(),
      };

      set(pushHistory(state, updatedLayout));
    },

    updatePlacedModuleVariant: (instanceId, variantId) => {
      const state = get();
      const targetBase = state.layout.placedModules.find(
        (m) => m.instanceId === instanceId
      );

      if (targetBase) {
        const catalogMod = state.catalog.find((m) => m.id === targetBase.moduleId);
        if (!catalogMod) return;

        const variant = catalogMod.variants.find((v) => v.id === variantId);
        if (!variant) return;

        let curOffset = 0;
        const updatedModules = state.layout.placedModules.map((m) => {
          if (m.edgeId === targetBase.edgeId) {
            const isTarget = m.instanceId === instanceId;
            const w = isTarget ? variant.width : m.width;
            const variantIdToUse = isTarget ? variant.id : m.variantId;
            const updatedM = {
              ...m,
              variantId: variantIdToUse,
              width: w,
              depth: isTarget ? variant.depth : m.depth,
              height: isTarget ? variant.height : m.height,
              offset: curOffset,
            };
            curOffset += w;
            return updatedM;
          }
          return m;
        });

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedModules: updatedModules,
          updatedAt: new Date().toISOString(),
        };

        set(pushHistory(state, updatedLayout));
        return;
      }

      // Check upper modules
      const targetUpper = (state.layout.placedUpperModules || []).find(
        (m) => m.instanceId === instanceId
      );

      if (targetUpper) {
        const catalogMod = state.catalog.find((m) => m.id === targetUpper.moduleId);
        if (!catalogMod) return;

        const variant = catalogMod.variants.find((v) => v.id === variantId);
        if (!variant) return;

        // CHỐNG ĐÈ: Kiểm tra nếu biến thể lớn hơn kích thước khả dụng tối đa
        const spaceInfo = getUpperModuleSpaceInfo(instanceId, state.layout);
        if (variant.width > spaceInfo.maxAllowedWidth && variant.width > targetUpper.width) {
          return; // Ngăn chặn thay đổi để không bị đè khoang
        }

        const updatedModules = (state.layout.placedUpperModules || []).map((m) => {
          if (m.instanceId === instanceId) {
            return {
              ...m,
              variantId: variant.id,
              width: variant.width,
              depth: variant.depth,
              height: variant.height,
            };
          }
          return m;
        });

        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedUpperModules: updatedModules,
          updatedAt: new Date().toISOString(),
        };

        set(pushHistory(state, updatedLayout));
      }
    },

    updatePlacedModuleCustomWidth: (instanceId, customWidth) => {
      const state = get();

      // 1. Khoang tủ dưới (S01: chậu rửa linh hoạt 830-900mm, K01: khoang góc 980-1030mm, T01: tủ chứa đồ linh hoạt >= 300mm)
      const targetBase = state.layout.placedModules.find(
        (m) => m.instanceId === instanceId
      );
      if (targetBase) {
        let validWidth = Math.round(customWidth);
        if (targetBase.code === 'S01') {
          validWidth = Math.max(830, Math.min(900, validWidth));
        } else if (targetBase.code === 'K01') {
          validWidth = Math.max(980, Math.min(1030, validWidth));
        } else if (targetBase.code === 'F01') {
          validWidth = Math.max(600, Math.min(1000, validWidth));
        } else if (targetBase.code === 'T01') {
          const spaceInfo = getBaseModuleSpaceInfo(instanceId, state.layout);
          validWidth = Math.max(300, Math.min(spaceInfo.maxAllowedWidth, validWidth));
        } else {
          return;
        }

        let curOffset = 0;
        const updatedModules = state.layout.placedModules.map((m) => {
          if (m.edgeId === targetBase.edgeId) {
            const w = m.instanceId === instanceId ? validWidth : m.width;
            const updatedM = { ...m, width: w, offset: curOffset };
            curOffset += w;
            return updatedM;
          }
          return m;
        });
        const updatedLayout: KitchenLayout = {
          ...state.layout,
          placedModules: updatedModules,
          updatedAt: new Date().toISOString(),
        };
        set(pushHistory(state, updatedLayout));
        return;
      }

      // 2. Khoang tủ trên (UK01: khoang góc 730-780mm, UT01: khoang để đồ)
      const targetUpper = (state.layout.placedUpperModules || []).find(
        (m) => m.instanceId === instanceId
      );
      if (!targetUpper) return;

      let validWidth = Math.round(customWidth);
      if (targetUpper.code === 'UK01') {
        validWidth = Math.max(730, Math.min(780, validWidth));
      } else if (targetUpper.code === 'UT01') {
        const spaceInfo = getUpperModuleSpaceInfo(instanceId, state.layout);
        validWidth = Math.max(
          300,
          Math.min(spaceInfo.maxAllowedWidth, validWidth)
        );
      } else {
        return;
      }

      const updatedModules = (state.layout.placedUpperModules || []).map((m) => {
        if (m.instanceId === instanceId) {
          return {
            ...m,
            width: validWidth,
          };
        }
        return m;
      });

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedUpperModules: updatedModules,
        updatedAt: new Date().toISOString(),
      };

      set(pushHistory(state, updatedLayout));
    },

    autoFitBaseStorage: (instanceId) => {
      const state = get();
      const targetBase = state.layout.placedModules.find(
        (m) => m.instanceId === instanceId
      );
      if (!targetBase || targetBase.code !== 'T01') return;

      const spaceInfo = getBaseModuleSpaceInfo(instanceId, state.layout);
      const fitWidth = spaceInfo.maxAllowedWidth;
      if (fitWidth < 300) return;

      let curOffset = 0;
      const updatedModules = state.layout.placedModules.map((m) => {
        if (m.edgeId === targetBase.edgeId) {
          const w = m.instanceId === instanceId ? fitWidth : m.width;
          const updatedM = { ...m, width: w, offset: curOffset };
          curOffset += w;
          return updatedM;
        }
        return m;
      });

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedModules: updatedModules,
        updatedAt: new Date().toISOString(),
      };

      set(pushHistory(state, updatedLayout));
    },

    autoFitUpperStorage: (instanceId) => {
      const state = get();
      const targetUpper = (state.layout.placedUpperModules || []).find(
        (m) => m.instanceId === instanceId
      );
      // Chỉ hỗ trợ tự động lấp đầy cho khoang tủ chứa đồ tủ trên UT01
      if (!targetUpper || targetUpper.code !== 'UT01') return;

      const spaceInfo = getUpperModuleSpaceInfo(instanceId, state.layout);
      const remainingWidth = spaceInfo.maxAllowedWidth;

      const updatedModules = (state.layout.placedUpperModules || []).map((m) => {
        if (m.instanceId === instanceId) {
          return {
            ...m,
            width: remainingWidth,
          };
        }
        return m;
      });

      const updatedLayout: KitchenLayout = {
        ...state.layout,
        placedUpperModules: updatedModules,
        updatedAt: new Date().toISOString(),
      };

      set(pushHistory(state, updatedLayout));
    },

    setLayout: (newLayout) => {
      const state = get();
      set(pushHistory(state, newLayout));
    },

    // Undo / Redo
    undo: () => {
      const state = get();
      if (state.history.length === 0) return;

      const previous = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, state.history.length - 1);
      const newFuture = [state.layout, ...state.future];

      const rep = ruleEngineInstance.evaluate(previous, state.catalog);

      set({
        layout: previous,
        validationReport: rep,
        history: newHistory,
        future: newFuture,
        canUndo: newHistory.length > 0,
        canRedo: true,
      });
    },

    redo: () => {
      const state = get();
      if (state.future.length === 0) return;

      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const newHistory = [...state.history, state.layout];

      const rep = ruleEngineInstance.evaluate(next, state.catalog);

      set({
        layout: next,
        validationReport: rep,
        history: newHistory,
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      });
    },

    // Rule Management
    toggleRule: (ruleId) => {
      const state = get();
      const updatedRules = state.rules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      );
      ruleEngineInstance.setRules(updatedRules);
      const rep = ruleEngineInstance.evaluate(state.layout, state.catalog);

      set({ rules: updatedRules, validationReport: rep });
    },

    updateRuleConfig: (ruleId, config) => {
      const state = get();
      const updatedRules = state.rules.map((r) =>
        r.id === ruleId ? { ...r, config: { ...r.config, ...config } } : r
      );
      ruleEngineInstance.setRules(updatedRules);
      const rep = ruleEngineInstance.evaluate(state.layout, state.catalog);

      set({ rules: updatedRules, validationReport: rep });
    },

    importRules: (rules) => {
      const state = get();
      ruleEngineInstance.setRules(rules);
      const rep = ruleEngineInstance.evaluate(state.layout, state.catalog);
      set({ rules, validationReport: rep });
    },

    resetRulesToDefault: () => {
      const state = get();
      ruleEngineInstance.setRules(DEFAULT_RULES);
      const rep = ruleEngineInstance.evaluate(state.layout, state.catalog);
      set({ rules: DEFAULT_RULES, validationReport: rep });
    },

    // Catalog Management
    addCatalogModule: (mod) => {
      set((state) => ({ catalog: [...state.catalog, mod] }));
    },

    updateCatalogModule: (mod) => {
      set((state) => ({
        catalog: state.catalog.map((m) => (m.id === mod.id ? mod : m)),
      }));
    },

    deleteCatalogModule: (moduleId) => {
      set((state) => ({
        catalog: state.catalog.filter((m) => m.id !== moduleId),
      }));
    },

    importCatalog: (modules) => {
      set({ catalog: modules });
    },

    resetCatalogToDefault: () => {
      set({ catalog: DEFAULT_MODULES });
    },

    // Auto Layout Generation Engine
    setSelectedModuleCodes: (codes) => set({ selectedModuleCodes: codes }),
    toggleSelectedModuleCode: (code) =>
      set((state) => {
        const exists = state.selectedModuleCodes.includes(code);
        return {
          selectedModuleCodes: exists
            ? state.selectedModuleCodes.filter((c) => c !== code)
            : [...state.selectedModuleCodes, code],
        };
      }),

    runLayoutGenerator: () => {
      const state = get();
      const layoutEngine = new LayoutEngine(state.rules);

      // LẤY CHÍNH XÁC CÁC KHOANG CÔNG NĂNG TỦ DƯỚI ĐANG HIỂN THỊ BÊN DƯỚI MẶT BẰNG
      const currentBaseModules = state.layout.placedModules;
      let baseCodes: string[] = [];
      if (currentBaseModules && currentBaseModules.length > 0) {
        baseCodes = Array.from(new Set(currentBaseModules.map((m) => m.code)));
      } else if (state.selectedModuleCodes && state.selectedModuleCodes.length > 0) {
        baseCodes = state.selectedModuleCodes.filter((c) => !c.startsWith('U'));
      } else {
        baseCodes = ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01'];
      }

      if (state.layout.shape === 'I') {
        baseCodes = baseCodes.filter((c) => c !== 'K01' && c !== 'UK01');
      }

      set({ selectedModuleCodes: baseCodes });

      const result = layoutEngine.generateLayouts({
        shape: state.layout.shape,
        edgeA: state.layout.edgeA,
        edgeB: state.layout.edgeB,
        edgeC: state.layout.edgeC,
        catalog: state.catalog,
        rules: state.rules,
        selectedModuleCodes: baseCodes,
        currentPlacedModules: currentBaseModules,
      });

      if (result.error) {
        set({
          generatedCandidates: [],
          generationError: result.error,
          selectedCandidateIndex: null,
          activeTab: 'generator',
        });
      } else if (result.candidates && result.candidates.length > 0) {
        // TỰ ĐỘNG ÁP DỤNG PHƯƠNG ÁN TỐI ƯU NHẤT (SỐ 1) LÊN CANVAS
        const topCandidate = result.candidates[0];
        const newLayout: KitchenLayout = {
          ...topCandidate.layout,
          id: `layout-${Date.now()}`,
          name: topCandidate.title,
          selectedModuleCodes: baseCodes,
          placedUpperModules: state.layout.placedUpperModules || [],
          designPhase: state.layout.designPhase || 'design_base',
          updatedAt: new Date().toISOString(),
        };

        const updatedShapeLayouts = {
          ...state.shapeLayouts,
          [newLayout.shape]: newLayout,
        };

        set({
          ...pushHistory(state, newLayout),
          generatedCandidates: result.candidates,
          generationError: null,
          selectedCandidateIndex: 0,
          activeTab: 'generator',
          shapeLayouts: updatedShapeLayouts,
        });
      }
    },

    applyCandidate: (idx) => {
      const state = get();
      const cand = state.generatedCandidates[idx];
      if (!cand) return;

      const newLayout: KitchenLayout = {
        ...cand.layout,
        id: `layout-${Date.now()}`,
        name: cand.title,
        selectedModuleCodes: state.selectedModuleCodes,
        updatedAt: new Date().toISOString(),
      };

      const updatedShapeLayouts = {
        ...state.shapeLayouts,
        [newLayout.shape]: newLayout,
      };

      set({
        ...pushHistory(state, newLayout),
        selectedCandidateIndex: idx,
        designPhase: 'design_base',
        activeCabinetTier: 'base',
        shapeLayouts: updatedShapeLayouts,
      });
    },

    // Persistence & Saved Projects
    saveCurrentProject: (name) => {
      const state = get();
      const projectToSave: KitchenLayout = {
        ...state.layout,
        name: name || state.layout.name || `Thiết kế ${new Date().toLocaleDateString('vi-VN')}`,
        updatedAt: new Date().toISOString(),
      };

      const existingIdx = state.savedProjects.findIndex(
        (p) => p.id === projectToSave.id
      );
      let newProjects: KitchenLayout[];

      if (existingIdx >= 0) {
        newProjects = [...state.savedProjects];
        newProjects[existingIdx] = projectToSave;
      } else {
        newProjects = [projectToSave, ...state.savedProjects];
      }

      localStorage.setItem('kitchen_saved_projects', JSON.stringify(newProjects));
      set({ savedProjects: newProjects, layout: projectToSave });
    },

    loadProject: (projectId) => {
      const state = get();
      const target = state.savedProjects.find((p) => p.id === projectId);
      if (!target) return;

      set(pushHistory(state, target));
    },

    deleteProject: (projectId) => {
      const state = get();
      const newProjects = state.savedProjects.filter((p) => p.id !== projectId);
      localStorage.setItem('kitchen_saved_projects', JSON.stringify(newProjects));
      set({ savedProjects: newProjects });
    },
  };
});
