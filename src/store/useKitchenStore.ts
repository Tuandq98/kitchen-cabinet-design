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
import { computeUpperGaps } from '../utils/geometry';

export interface UpperModuleSpaceInfo {
  leftGap: number;
  rightGap: number;
  maxAllowedWidth: number;
  totalEdgeGap: number;
  segmentSpan: number;
  otherWidthsInSegment: number;
}

interface KitchenStoreState {
  // 1. Core State
  layout: KitchenLayout;
  catalog: KitchenModule[];
  rules: DesignRule[];
  validationReport: ValidationReport;

  // 2. Selection & UI State
  selectedModuleId: string | null;
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

  const edges: Array<'edge_A' | 'edge_B' | 'edge_C'> = ['edge_A', 'edge_B', 'edge_C'];
  const result: PlacedModuleInstance[] = [];

  for (const edgeId of edges) {
    const modulesOnEdge = layout.placedModules
      .filter((m) => m.edgeId === edgeId)
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentOffset = 0;
    if (layout.shape === 'L') {
      if (edgeId === 'edge_A') currentOffset = depthB;
      else if (edgeId === 'edge_B') currentOffset = depthA;
    } else if (layout.shape === 'U') {
      if (edgeId === 'edge_A') currentOffset = depthB;
      else if (edgeId === 'edge_B') currentOffset = depthA;
      else if (edgeId === 'edge_C') currentOffset = depthA;
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

    // Kích thước góc giao nhau cho bếp L và U
    const cornerSize = layout.shape === 'L' || layout.shape === 'U' ? upperDepth : 0;

    // Danh sách các khoảng bị chiếm dụng trên cạnh
    const occupied: { start: number; end: number }[] = [];

    // Chiếm dụng bởi góc
    if (layout.shape === 'L') {
      if (edgeId === 'edge_A' || edgeId === 'edge_B') {
        occupied.push({ start: 0, end: cornerSize });
      }
    } else if (layout.shape === 'U') {
      if (edgeId === 'edge_A') {
        occupied.push({ start: 0, end: cornerSize });
        occupied.push({ start: edge.length - cornerSize, end: edge.length });
      } else {
        occupied.push({ start: 0, end: cornerSize });
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
    setSelectedModuleId: (id) => set({ selectedModuleId: id }),
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

      const baseCodes = baseModuleCodes;

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
      if (genResult.candidates && genResult.candidates.length > 0) {
        placedModules = genResult.candidates[0].layout.placedModules;
      } else {
        // Fallback: Sắp xếp tuần tự các khoang đã chọn theo chuẩn công thái học để luôn tạo được bếp
        const orderRank: Record<string, number> = {
          P01: 10,
          A01: 15,
          F01: 20,
          C01: 30,
          W01: 40,
          S01: 50,
          D01: 60,
          R01: 70,
          B01: 80,
          SP01: 90,
          M01: 100,
          T01: 110,
        };

        const sortedCodes = [...baseCodes].sort(
          (a, b) => (orderRank[a] ?? 999) - (orderRank[b] ?? 999)
        );

        let curOffset = 0;
        let pIdx = 0;
        for (const code of sortedCodes) {
          const mod = state.catalog.find((m) => m.code === code);
          if (!mod) continue;
          const v = mod.variants.find((v) => v.isDefault) || mod.variants[0];
          placedModules.push({
            instanceId: `base-${code}-${pIdx}`,
            moduleId: mod.id,
            variantId: v.id,
            code: mod.code,
            name: mod.name,
            category: mod.category,
            tier: 'base',
            edgeId: 'edge_A',
            positionIndex: pIdx++,
            offset: curOffset,
            width: v.width,
            depth: v.depth,
            height: v.height,
            color: mod.color,
          });
          curOffset += v.width;
        }
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
        const targetLayout = updatedShapeLayouts[newShape]!;
        const rep = ruleEngineInstance.evaluate(targetLayout, state.catalog, targetLayout.designPhase);
        const targetCodes =
          targetLayout.selectedModuleCodes && targetLayout.selectedModuleCodes.length > 0
            ? targetLayout.selectedModuleCodes
            : Array.from(new Set(targetLayout.placedModules.map((m) => m.code)));
        set({
          ...pushHistory(state, targetLayout),
          shapeLayouts: updatedShapeLayouts,
          designPhase: targetLayout.designPhase || 'design_base',
          activeCabinetTier: 'all',
          validationReport: rep,
          selectedModuleCodes: targetCodes,
        });
        return;
      }

      // 3. Nếu chưa có bản vẽ cho newShape, khởi tạo độc lập hoàn toàn (không kế thừa dữ liệu từ kiểu bếp trước)
      const layoutEngine = new LayoutEngine(state.rules);
      const baseCodes =
        newShape === 'I'
          ? ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01']
          : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01', 'K01'];

      let edgeA = { id: 'edge_A' as EdgeId, name: 'Cạnh A', length: 3600, depth: 600, height: 850 };
      let edgeB: { id: EdgeId; name: string; length: number; depth: number; height: number; angle?: number } | undefined = undefined;
      let edgeC: { id: EdgeId; name: string; length: number; depth: number; height: number; angle?: number } | undefined = undefined;

      if (newShape === 'L') {
        edgeA = { id: 'edge_A' as EdgeId, name: 'Cạnh A', length: 3000, depth: 600, height: 850 };
        edgeB = { id: 'edge_B' as EdgeId, name: 'Cạnh B', length: 2400, depth: 600, height: 850, angle: 90 };
      } else if (newShape === 'U') {
        edgeA = { id: 'edge_A' as EdgeId, name: 'Cạnh A', length: 2700, depth: 600, height: 850 };
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
      if (genResult.candidates && genResult.candidates.length > 0) {
        placedModules = genResult.candidates[0].layout.placedModules;
      } else {
        // Fallback: Sắp xếp tuần tự các khoang đã chọn theo chuẩn công thái học để luôn tạo được bếp
        const orderRank: Record<string, number> = {
          P01: 10,
          A01: 15,
          F01: 20,
          C01: 30,
          W01: 40,
          S01: 50,
          D01: 60,
          R01: 70,
          B01: 80,
          SP01: 90,
          M01: 100,
          T01: 110,
        };

        const sortedCodes = [...baseCodes].sort(
          (a, b) => (orderRank[a] ?? 999) - (orderRank[b] ?? 999)
        );

        let curOffset = 0;
        let pIdx = 0;
        for (const code of sortedCodes) {
          const mod = state.catalog.find((m) => m.code === code);
          if (!mod) continue;
          const v = mod.variants.find((v) => v.isDefault) || mod.variants[0];
          placedModules.push({
            instanceId: `base-${code}-${pIdx}`,
            moduleId: mod.id,
            variantId: v.id,
            code: mod.code,
            name: mod.name,
            category: mod.category,
            tier: 'base',
            edgeId: 'edge_A',
            positionIndex: pIdx++,
            offset: curOffset,
            width: v.width,
            depth: v.depth,
            height: v.height,
            color: mod.color,
          });
          curOffset += v.width;
        }
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

    // Module Placement & Reordering
    addModuleToEdge: (moduleId, edgeId, variantId, targetIndex) => {
      const state = get();
      const mod = state.catalog.find((m) => m.id === moduleId);
      if (!mod) return;

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

        newEdgeModules.splice(targetIndex, 0, updatedTarget);
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

        newEdgeModules.splice(targetIndex, 0, updatedTarget);
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

      // 1. Khoang chậu rửa tủ dưới (S01): Tùy chỉnh linh hoạt từ 830mm đến 900mm (Chuẩn mặc định 850mm)
      const targetBase = state.layout.placedModules.find(
        (m) => m.instanceId === instanceId && m.code === 'S01'
      );
      if (targetBase) {
        const validWidth = Math.max(830, Math.min(900, Math.round(customWidth)));
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

      // 2. Khoang tủ chứa đồ tủ trên (UT01) tùy chỉnh kích cỡ linh động
      const targetUpper = (state.layout.placedUpperModules || []).find(
        (m) => m.instanceId === instanceId
      );
      if (!targetUpper || targetUpper.code !== 'UT01') return;

      // CHỐNG ĐÈ: Giới hạn kích thước không được vượt quá maxAllowedWidth
      const spaceInfo = getUpperModuleSpaceInfo(instanceId, state.layout);
      const validWidth = Math.max(
        300,
        Math.min(spaceInfo.maxAllowedWidth, Math.round(customWidth))
      );

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
