/**
 * KITCHEN LAYOUT DESIGNER - DOMAIN MODELS & TYPES
 * Clean architecture domain definitions
 */

// 1. MODULE & CATALOG MODELS
export type ModuleCategory =
  | 'cooking'       // Bếp nấu, lò nướng, bếp từ
  | 'sink'          // Chậu rửa bát, vòi
  | 'refrigeration' // Tủ lạnh
  | 'appliance'     // Máy rửa bát, lò vi sóng, hút mùi
  | 'storage'       // Tủ đồ, ngăn kéo, tủ gia vị
  | 'corner'        // Khoang góc (cho bếp chữ L, U)
  | 'prep';         // Khoang bàn chuẩn bị, dao thớt

export type CabinetTier = 'base' | 'upper';

export interface ModuleVariant {
  id: string;
  width: number;   // Chiều rộng (mm)
  depth: number;   // Chiều sâu (mm)
  height: number;  // Chiều cao (mm)
  isDefault?: boolean;
}

export interface KitchenModule {
  id: string;
  code: string;        // B01, S01, D01, F01, C01, T01, UB01, UH01...
  name: string;        // Tên khoang
  category: ModuleCategory;
  tier?: CabinetTier;  // 'base': Tủ dưới (mặc định), 'upper': Tủ trên
  description?: string;
  color: string;       // Màu sắc đại diện trên 2D
  minWidth?: number;
  maxWidth?: number;
  variants: ModuleVariant[];
  metadata: {
    isCooktop?: boolean;
    isSink?: boolean;
    isFridge?: boolean;
    isDishwasher?: boolean;
    isCorner?: boolean;
    isCutleryOrPrep?: boolean;
    isCutlery?: boolean;           // Khoang dao thớt
    isSpiceRack?: boolean;         // Khoang gia vị tủ dưới
    isTallUnit?: boolean;          // Tủ cao: Tủ lạnh, Tủ đồ khô cao tầng, Tủ thiết bị cao tầng
    isWasteBin?: boolean;          // Khoang thùng rác (không bắt buộc)
    isRiceDispenser?: boolean;     // Khoang thùng gạo (không bắt buộc)
    // Metadata cho Tủ trên (Upper Cabinets)
    isUpperDishRackManual?: boolean;   // Khoang giá bát nâng hạ cơ (600-900)
    isUpperDishRackFixed?: boolean;    // Khoang giá bát cố định (600-900)
    isUpperDishRackElectric?: boolean; // Khoang giá bát nâng hạ điện (600-900)
    isUpperSpiceRackManual?: boolean;  // Khoang giá gia vị nâng hạ cơ (600-900)
    isUpperSpiceRackElectric?: boolean;// Khoang giá gia vị nâng hạ điện (600-900)
    isRangeHood?: boolean;             // Khoang hút mùi (710-910)
    isUpperStorage?: boolean;          // Khoang để đồ tủ trên (tối đa 900)
    requiresPlumbing?: boolean;
    requiresVentilation?: boolean;
    requiresPower?: boolean;
    doorSwing?: 'left' | 'right' | 'drawer' | 'none';
  };
}

// 2. PLACED MODULE INSTANCE (Vị trí trên bản thiết kế)
export type EdgeId = 'edge_A' | 'edge_B' | 'edge_C';

export interface PlacedModuleInstance {
  instanceId: string;   // Unique ID cho mỗi instance đặt trên bản vẽ
  moduleId: string;     // Link tới catalog KitchenModule.id
  variantId: string;    // Link tới ModuleVariant.id
  code: string;         // Snapshot code
  name: string;         // Snapshot name
  category: ModuleCategory;
  tier?: CabinetTier;   // 'base' hoặc 'upper'
  edgeId: EdgeId;       // Thuộc cạnh nào của bếp
  positionIndex: number;// Thứ tự từ đầu cạnh đến cuối cạnh (0, 1, 2...)
  offset: number;       // Khoảng cách từ đầu cạnh (mm)
  width: number;        // Kích thước thực tế đặt
  depth: number;
  height: number;
  color: string;
  customName?: string;
}

// 3. KITCHEN FLOOR PLAN & DIMENSIONS
export type KitchenShape = 'I' | 'L' | 'U';

export interface KitchenEdge {
  id: EdgeId;
  name: string;
  length: number;  // mm (chiều dài tổng thể)
  depth: number;   // mm (độ sâu mặt bàn bếp, thường 600mm)
  height: number;  // mm (chiều cao mặt bếp, thường 850mm)
  angle?: number;  // góc (90 độ)
}

export interface KitchenLayout {
  id: string;
  name: string;
  shape: KitchenShape;
  edgeA: KitchenEdge;
  edgeB?: KitchenEdge; // Cho chữ L, chữ U
  edgeC?: KitchenEdge; // Cho chữ U
  placedModules: PlacedModuleInstance[];        // Các khoang Tủ Dưới (Base)
  placedUpperModules?: PlacedModuleInstance[];   // Các khoang Tủ Trên (Upper)
  upperDepth?: number;                          // Chiều sâu tủ trên (mm), mặc định 350mm
  upperHeight?: number;                         // Chiều cao tủ trên (mm), mặc định 750mm
  cornerConfig: {
    size: number; // Kích thước khoảng góc giao nhau (thường bằng depth của cạnh liền kề, vd 600mm)
  };
  selectedModuleCodes?: string[]; // Danh sách mã khoang công năng được chọn đưa vào thiết kế
  designPhase?: 'setup' | 'design_base' | 'design_upper'; // Giai đoạn: Setup (Khởi tạo) | Bước 1 (Tủ dưới) | Bước 2 (Tủ trên)
  createdAt: string;
  updatedAt: string;
}

// 4. DESIGN RULE ENGINE MODELS
export type RuleType =
  | 'REQUIRED_MODULE'
  | 'MIN_DISTANCE'
  | 'MAX_DISTANCE'
  | 'ADJACENCY'
  | 'ORDER'
  | 'POSITION'
  | 'WORK_TRIANGLE'
  | 'EDGE_OVERFLOW'
  | 'COOKTOP_EDGE_CLEARANCE'
  | 'COOKTOP_NEAR_TALL_UNIT'
  | 'FRIDGE_AT_EDGE'
  | 'TALL_UNITS_AT_EDGE'
  | 'TALL_PANTRY_APPLIANCE_ADJACENT'
  | 'UPPER_MAX_STORAGE_WIDTH'
  | 'UPPER_HOOD_ALIGN_COOKTOP'
  | 'UPPER_DISH_ALIGN_SINK'
  | 'UPPER_MULTI_DISH_PRIORITY'
  | 'UPPER_NO_OVERLAP_TALL_UNIT'
  | 'CUSTOM';

export type RuleSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface DesignRule {
  id: string;
  code: string;
  name: string;
  description: string;
  type: RuleType;
  severity: RuleSeverity; // ERROR = Hard constraint, WARNING = Soft constraint
  enabled: boolean;
  weight: number; // Điểm số cho soft rule evaluation (0-100)
  config: Record<string, any>;
}

export interface RuleViolation {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  severity: RuleSeverity;
  message: string;
  recommendation?: string;
  involvedModuleIds: string[]; // instanceIds of placed modules
}

export interface WorkTriangleMetrics {
  sinkCoord?: { x: number; y: number };
  cooktopCoord?: { x: number; y: number };
  fridgeCoord?: { x: number; y: number };
  sinkToCooktop: number;  // mm
  cooktopToFridge: number;// mm
  fridgeToSink: number;   // mm
  perimeter: number;      // mm
  isValid: boolean;       // Perimeter 4000mm - 7900mm (NKBA Standard)
}

export interface ValidationReport {
  timestamp: string;
  score: number;          // 0 - 100
  hardValid: boolean;     // true if 0 ERROR violations
  passedCount: number;
  failedCount: number;
  warningCount: number;
  violations: RuleViolation[];
  workTriangle: WorkTriangleMetrics;
}

// 5. AUTO GENERATED CANDIDATE PLAN
export interface LayoutPlanCandidate {
  id: string;
  title: string;
  score: number;
  layout: KitchenLayout;
  remainingWidths: Record<EdgeId, number>; // Kích thước còn dư trên từng cạnh
  ruleSummary: {
    passedCount: number;
    violationCount: number;
    warningsCount: number;
  };
  workTrianglePerimeter: number;
  pros: string[];
  cons: string[];
}
