import { KitchenModule, DesignRule, KitchenLayout } from '../../types';

export const DEFAULT_MODULES: KitchenModule[] = [
  {
    id: 'mod-cooktop-01',
    code: 'B01',
    name: 'Khoang bếp nấu',
    category: 'cooking',
    description: 'Khoang đặt bếp từ/gas và hút mùi phía trên, kèm ngăn kéo gia vị hoặc lò bên dưới',
    color: '#ef4444', // Red-500
    variants: [
      { id: 'var-b01-600', width: 600, depth: 600, height: 850, isDefault: true },
      { id: 'var-b01-700', width: 700, depth: 600, height: 850 },
      { id: 'var-b01-800', width: 800, depth: 600, height: 850 },
      { id: 'var-b01-900', width: 900, depth: 600, height: 850 },
    ],
    metadata: {
      isCooktop: true,
      requiresPower: true,
      requiresVentilation: true,
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-sink-01',
    code: 'S01',
    name: 'Khoang chậu rửa',
    category: 'sink',
    description: 'Khoang chậu rửa đôi/đơn, vòi nước nóng lạnh và khoang chứa máy lọc nước',
    color: '#0ea5e9', // Sky-500
    variants: [
      { id: 'var-s01-800', width: 800, depth: 600, height: 850, isDefault: true },
      { id: 'var-s01-700', width: 700, depth: 600, height: 850 },
      { id: 'var-s01-900', width: 900, depth: 600, height: 850 },
      { id: 'var-s01-1000', width: 1000, depth: 600, height: 850 },
    ],
    metadata: {
      isSink: true,
      requiresPlumbing: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-fridge-01',
    code: 'F01',
    name: 'Khoang tủ lạnh',
    category: 'refrigeration',
    description: 'Khoang tủ lạnh đứng (Side-by-side hoặc 2 cánh) kèm tủ bao nóc',
    color: '#3b82f6', // Blue-500
    variants: [
      { id: 'var-f01-900', width: 900, depth: 650, height: 1800, isDefault: true },
      { id: 'var-f01-750', width: 750, depth: 650, height: 1800 },
      { id: 'var-f01-800', width: 800, depth: 650, height: 1800 },
      { id: 'var-f01-1000', width: 1000, depth: 700, height: 1800 },
    ],
    metadata: {
      isFridge: true,
      isTallUnit: true, // Tủ cao
      requiresPower: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-dishwasher-01',
    code: 'D01',
    name: 'Khoang máy rửa bát',
    category: 'appliance',
    description: 'Khoang máy rửa bát âm tủ toàn phần hoặc bán phần',
    color: '#8b5cf6', // Violet-500
    variants: [
      { id: 'var-d01-600', width: 600, depth: 600, height: 850, isDefault: true },
      { id: 'var-d01-450', width: 450, depth: 600, height: 850 },
    ],
    metadata: {
      isDishwasher: true,
      requiresPlumbing: true,
      requiresPower: true,
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-cutlery-01',
    code: 'C01',
    name: 'Khoang dao thớt',
    category: 'prep',
    description: 'Giá để dao thớt, đũa muỗng nan inox ray trượt giảm chấn thông minh',
    color: '#10b981', // Emerald-500
    variants: [
      { id: 'var-c01-400', width: 400, depth: 600, height: 850, isDefault: true },
      { id: 'var-c01-350', width: 350, depth: 600, height: 850 },
      { id: 'var-c01-300', width: 300, depth: 600, height: 850 },
      { id: 'var-c01-250', width: 250, depth: 600, height: 850 },
    ],
    metadata: {
      isCutleryOrPrep: true,
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-spice-01',
    code: 'SP01',
    name: 'Khoang gia vị',
    category: 'prep',
    description: 'Giá gia vị, chai lọ dầu ăn nước mắm nan inox ray trượt giảm chấn gần bếp nấu',
    color: '#14b8a6', // Teal-500
    variants: [
      { id: 'var-sp01-400', width: 400, depth: 600, height: 850, isDefault: true },
      { id: 'var-sp01-350', width: 350, depth: 600, height: 850 },
      { id: 'var-sp01-300', width: 300, depth: 600, height: 850 },
      { id: 'var-sp01-250', width: 250, depth: 600, height: 850 },
    ],
    metadata: {
      isSpiceRack: true,
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-storage-01',
    code: 'T01',
    name: 'Khoang tủ chứa đồ',
    category: 'storage',
    description: 'Tủ ngăn kéo 2 tầng hoặc cánh mở chia đợt để xoong nồi, đồ khô',
    color: '#f59e0b', // Amber-500
    variants: [
      { id: 'var-t01-600', width: 600, depth: 600, height: 850, isDefault: true },
      { id: 'var-t01-300', width: 300, depth: 600, height: 850 },
      { id: 'var-t01-400', width: 400, depth: 600, height: 850 },
      { id: 'var-t01-500', width: 500, depth: 600, height: 850 },
      { id: 'var-t01-800', width: 800, depth: 600, height: 850 },
    ],
    metadata: {
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-oven-01',
    code: 'M01',
    name: 'Khoang lò nướng / vi sóng',
    category: 'appliance',
    description: 'Khoang lắp lò nướng âm hoặc lò vi sóng tích hợp',
    color: '#ec4899', // Pink-500
    variants: [
      { id: 'var-m01-600', width: 600, depth: 600, height: 850, isDefault: true },
    ],
    metadata: {
      requiresPower: true,
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-corner-01',
    code: 'K01',
    name: 'Khoang góc liên hoàn',
    category: 'corner',
    description: 'Khoang góc chữ L/U tích hợp mâm xoay góc hoặc góc chết tối ưu',
    color: '#64748b', // Slate-500
    variants: [
      { id: 'var-k01-900', width: 900, depth: 900, height: 850, isDefault: true },
      { id: 'var-k01-600', width: 600, depth: 600, height: 850 },
    ],
    metadata: {
      isCorner: true,
      doorSwing: 'none',
    },
  },
  {
    id: 'mod-rice-01',
    code: 'R01',
    name: 'Khoang thùng gạo thông minh',
    category: 'prep',
    description: 'Khoang thùng gạo nút nhấn âm tủ tiện lợi (chỉ thiết kế khi có yêu cầu)',
    color: '#f97316', // Orange-500
    variants: [
      { id: 'var-r01-300', width: 300, depth: 600, height: 850, isDefault: true },
      { id: 'var-r01-250', width: 250, depth: 600, height: 850 },
    ],
    metadata: {
      isRiceDispenser: true,
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-waste-01',
    code: 'W01',
    name: 'Khoang thùng rác âm tủ',
    category: 'prep',
    description: 'Khoang thùng rác ray trượt giảm chấn 2 ngăn phân loại (chỉ thiết kế khi có yêu cầu)',
    color: '#06b6d4', // Cyan-500
    variants: [
      { id: 'var-w01-300', width: 300, depth: 600, height: 850, isDefault: true },
      { id: 'var-w01-400', width: 400, depth: 600, height: 850 },
    ],
    metadata: {
      isWasteBin: true,
      doorSwing: 'drawer',
    },
  },
  {
    id: 'mod-tall-pantry-01',
    code: 'P01',
    name: 'Khoang tủ đồ khô cao tầng',
    category: 'storage',
    description: 'Tủ kho cao tầng 6 tầng nan inox liên hoàn chứa đồ khô (Tủ cao)',
    color: '#d97706', // Amber-600
    variants: [
      { id: 'var-p01-600', width: 600, depth: 600, height: 2000, isDefault: true },
      { id: 'var-p01-450', width: 450, depth: 600, height: 2000 },
    ],
    metadata: {
      isTallUnit: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-tall-appliance-01',
    code: 'A01',
    name: 'Khoang tủ thiết bị cao tầng',
    category: 'appliance',
    tier: 'base',
    description: 'Tủ đứng cao tầng kết hợp lò nướng, lò vi sóng và ngăn kéo chứa đồ (Tủ cao)',
    color: '#7c3aed', // Violet-600
    variants: [
      { id: 'var-a01-600', width: 600, depth: 600, height: 2000, isDefault: true },
    ],
    metadata: {
      isTallUnit: true,
      requiresPower: true,
      doorSwing: 'drawer',
    },
  },

  // ==========================================
  // THƯ VIỆN KHOANG CÔNG NĂNG TỦ TRÊN (UPPER)
  // ==========================================
  {
    id: 'mod-upper-dish-manual-01',
    code: 'UB01',
    name: 'Khoang giá bát nâng hạ cơ',
    category: 'storage',
    tier: 'upper',
    description: 'Khoang tủ trên lắp giá bát nâng hạ cơ kèm cơ cấu tay đòn trợ lực piston thủy lực đa cấp',
    color: '#0284c7', // Sky-600
    variants: [
      { id: 'var-ub01-800', width: 800, depth: 350, height: 750, isDefault: true },
      { id: 'var-ub01-600', width: 600, depth: 350, height: 750 },
      { id: 'var-ub01-700', width: 700, depth: 350, height: 750 },
      { id: 'var-ub01-900', width: 900, depth: 350, height: 750 },
    ],
    metadata: {
      isUpperDishRackManual: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-upper-dish-fixed-01',
    code: 'UB02',
    name: 'Khoang giá bát cố định',
    category: 'storage',
    tier: 'upper',
    description: 'Khoang tủ trên lắp giá bát inox 304 cố định 2 tầng kèm khay hứng nước inox chống rỏ nước',
    color: '#2563eb', // Blue-600
    variants: [
      { id: 'var-ub02-800', width: 800, depth: 350, height: 750, isDefault: true },
      { id: 'var-ub02-600', width: 600, depth: 350, height: 750 },
      { id: 'var-ub02-700', width: 700, depth: 350, height: 750 },
      { id: 'var-ub02-900', width: 900, depth: 350, height: 750 },
    ],
    metadata: {
      isUpperDishRackFixed: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-upper-dish-electric-01',
    code: 'UB03',
    name: 'Khoang giá bát nâng hạ điện',
    category: 'storage',
    tier: 'upper',
    description: 'Khoang tủ trên lắp giá bát nâng hạ tự động motor điện thông minh, chạm cảm ứng 1 chạm',
    color: '#4f46e5', // Indigo-600
    variants: [
      { id: 'var-ub03-800', width: 800, depth: 350, height: 750, isDefault: true },
      { id: 'var-ub03-600', width: 600, depth: 350, height: 750 },
      { id: 'var-ub03-700', width: 700, depth: 350, height: 750 },
      { id: 'var-ub03-900', width: 900, depth: 350, height: 750 },
    ],
    metadata: {
      isUpperDishRackElectric: true,
      requiresPower: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-upper-spice-manual-01',
    code: 'UG01',
    name: 'Khoang giá gia vị nâng hạ cơ',
    category: 'storage',
    tier: 'upper',
    description: 'Khoang tủ trên giá gia vị nâng hạ cơ cấu tay nâng hạ kéo xuống vừa tầm với người đứng bếp',
    color: '#0d9488', // Teal-600
    variants: [
      { id: 'var-ug01-800', width: 800, depth: 350, height: 750, isDefault: true },
      { id: 'var-ug01-600', width: 600, depth: 350, height: 750 },
      { id: 'var-ug01-700', width: 700, depth: 350, height: 750 },
      { id: 'var-ug01-900', width: 900, depth: 350, height: 750 },
    ],
    metadata: {
      isUpperSpiceRackManual: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-upper-spice-electric-01',
    code: 'UG02',
    name: 'Khoang giá gia vị nâng hạ điện',
    category: 'storage',
    tier: 'upper',
    description: 'Khoang tủ trên giá gia vị nâng hạ điện tự động êm ái tích hợp cảm ứng an toàn chống kẹt',
    color: '#059669', // Emerald-600
    variants: [
      { id: 'var-ug02-800', width: 800, depth: 350, height: 750, isDefault: true },
      { id: 'var-ug02-600', width: 600, depth: 350, height: 750 },
      { id: 'var-ug02-700', width: 700, depth: 350, height: 750 },
      { id: 'var-ug02-900', width: 900, depth: 350, height: 750 },
    ],
    metadata: {
      isUpperSpiceRackElectric: true,
      requiresPower: true,
      doorSwing: 'left',
    },
  },
  {
    id: 'mod-upper-hood-01',
    code: 'UH01',
    name: 'Khoang hút mùi',
    category: 'appliance',
    tier: 'upper',
    description: 'Khoang tủ trên lắp máy hút mùi âm tủ hoặc kính cong gắn tường thẳng tim bếp nấu',
    color: '#e11d48', // Rose-600
    variants: [
      { id: 'var-uh01-810', width: 810, depth: 350, height: 750, isDefault: true },
      { id: 'var-uh01-710', width: 710, depth: 350, height: 750 },
      { id: 'var-uh01-910', width: 910, depth: 350, height: 750 },
    ],
    metadata: {
      isRangeHood: true,
      requiresPower: true,
      requiresVentilation: true,
      doorSwing: 'none',
    },
  },
  {
    id: 'mod-upper-storage-01',
    code: 'UT01',
    name: 'Khoang tủ chứa đồ tủ trên',
    category: 'storage',
    tier: 'upper',
    description: 'Khoang tủ để đồ tủ trên cánh mở chia đợt tiện lợi, kích thước tối đa 900mm',
    color: '#d97706', // Amber-600
    variants: [
      { id: 'var-ut01-600', width: 600, depth: 350, height: 750, isDefault: true },
      { id: 'var-ut01-300', width: 300, depth: 350, height: 750 },
      { id: 'var-ut01-400', width: 400, depth: 350, height: 750 },
      { id: 'var-ut01-500', width: 500, depth: 350, height: 750 },
      { id: 'var-ut01-700', width: 700, depth: 350, height: 750 },
      { id: 'var-ut01-800', width: 800, depth: 350, height: 750 },
      { id: 'var-ut01-900', width: 900, depth: 350, height: 750 },
    ],
    metadata: {
      isUpperStorage: true,
      doorSwing: 'left',
    },
  },
];

export const DEFAULT_RULES: DesignRule[] = [
  // --- NHÓM 1: RÀNG BUỘC CỨNG CỐT LÕI (HARD CONSTRAINTS) ---
  {
    id: 'rule-req-modules',
    code: 'RULE_01',
    name: 'Khoang công năng bắt buộc',
    description: 'Thiết kế bếp bắt buộc phải có đủ 3 khoang trụ cột: Bếp nấu (Cooktop), Chậu rửa (Sink) và Tủ lạnh (Fridge).',
    type: 'REQUIRED_MODULE',
    severity: 'ERROR', // Hard constraint
    enabled: true,
    weight: 25,
    config: {
      requiredCategories: ['cooking', 'sink', 'refrigeration'],
    },
  },
  {
    id: 'rule-edge-overflow',
    code: 'RULE_OVERFLOW',
    name: 'Giới hạn kích thước cạnh bếp',
    description: 'Tổng chiều rộng các khoang không được vượt quá chiều dài khả dụng của từng cạnh bếp.',
    type: 'EDGE_OVERFLOW',
    severity: 'ERROR', // Hard constraint
    enabled: true,
    weight: 20,
    config: {},
  },
  {
    id: 'rule-min-cook-sink-dist',
    code: 'RULE_02',
    name: 'Khoảng cách an toàn Bếp - Chậu rửa',
    description: 'Khoang bếp và khoang chậu rửa phải cách nhau tối thiểu 300mm để đảm bảo an toàn điện - nước và có không gian đặt thớt sơ chế.',
    type: 'MIN_DISTANCE',
    severity: 'ERROR', // Hard constraint
    enabled: true,
    weight: 25,
    config: {
      fromCategory: 'cooking',
      toCategory: 'sink',
      minDistanceMm: 300,
    },
  },
  {
    id: 'rule-cooktop-near-tall-unit',
    code: 'RULE_06',
    name: 'Bếp nấu không đặt sát tủ cao (Tủ lạnh, Tủ khô, Tủ thiết bị)',
    description: 'Khoang bếp nấu không được đặt sát vách các khoang tủ cao (Tủ lạnh F01, Tủ đồ khô P01, Tủ lò nướng cao A01). Nhiệt lượng và dầu mỡ sẽ làm hỏng vách tủ cao, tiềm ẩn nguy cơ hỏa hoạn và cản trở thao tác xoong chảo. Khoảng cách an toàn tối thiểu là 300mm.',
    type: 'COOKTOP_NEAR_TALL_UNIT',
    severity: 'ERROR', // Hard constraint
    enabled: true,
    weight: 20,
    config: {
      minDistanceMm: 300,
    },
  },
  {
    id: 'rule-fridge-at-edge',
    code: 'RULE_07',
    name: 'Khoang tủ lạnh phải đặt sát mép của tủ bếp',
    description: 'Khoang tủ lạnh (F01) là hệ tủ cao (cao 1800-2000mm, sâu 650-700mm). Để đảm bảo không gian mặt bàn bếp liên tục cho sơ chế và nấu nướng, tránh chắn tầm nhìn và nguồn sáng, khoang tủ lạnh phải được bố trí ở sát mép ngoài cùng của dãy tủ bếp (vị trí đầu hoặc cuối cạnh), không đặt ở giữa hai khoang bàn bếp.',
    type: 'FRIDGE_AT_EDGE',
    severity: 'ERROR', // Hard constraint
    enabled: true,
    weight: 25,
    config: {},
  },

  // --- NHÓM 2: AN TOÀN BỀ MẶT THAO TÁC (SAFETY & CLEARANCE) ---
  {
    id: 'rule-cooktop-edge-clearance',
    code: 'RULE_05',
    name: 'Bếp nấu không đặt sát mép ngoài cạnh bếp (Landing Space)',
    description: 'Khoang bếp nấu không nên đặt sát mép ngoài cùng của khu bếp (cần cách mép tối thiểu 300mm). Tránh nguy cơ quẹt phải cán chảo nhô ra lối đi gây đổ dầu mỡ bỏng và có không gian đệm đặt nồi chảo.',
    type: 'COOKTOP_EDGE_CLEARANCE',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 15,
    config: {
      minEdgeClearanceMm: 300,
    },
  },

  // --- NHÓM 3: TAM GIÁC CÔNG NĂNG & CÔNG THÁI HỌC (ERGONOMICS) ---
  {
    id: 'rule-work-triangle',
    code: 'RULE_03',
    name: 'Tam giác công năng (Work Triangle)',
    description: 'Tổng chu vi tam giác nối Chậu rửa - Bếp nấu - Tủ lạnh nên từ 3500mm đến 8500mm (theo tiêu chuẩn NKBA), mỗi cạnh từ 900mm - 3200mm để người làm bếp di chuyển thuận tiện nhất.',
    type: 'WORK_TRIANGLE',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 15,
    config: {
      minPerimeterMm: 3500,
      maxPerimeterMm: 8500,
      minLegMm: 900,
      maxLegMm: 3200,
    },
  },

  // --- NHÓM 4: BỐ TRÍ CÁC KHOANG PHỤ TRỢ (ADJACENCY & CONVENIENCE) ---
  {
    id: 'rule-dishwasher-near-sink',
    code: 'RULE_04A',
    name: 'Máy rửa bát gần chậu rửa nhất có thể',
    description: 'Khoang máy rửa bát (D01) nên nằm liền kề hoặc cách chậu rửa (S01) không quá 900mm để thuận tiện kết nối đường ống cấp/thoát nước và gạt thức ăn thừa trước khi xếp bát.',
    type: 'ADJACENCY',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 10,
    config: {
      sourceCode: 'D01',
      sourceCategory: 'appliance',
      targetCategory: 'sink',
      maxDistanceMm: 900,
    },
  },
  {
    id: 'rule-cutlery-near-sink',
    code: 'RULE_04B',
    name: 'Khoang dao thớt nằm gần khoang chậu rửa nhất có thể',
    description: 'Khoang dao thớt (C01) phải nằm gần khoang chậu rửa (S01) nhất có thể (khoảng cách <= 900mm, khuyến nghị liền kề) để thuận tiện cho việc lấy dao thớt sơ chế thực phẩm sau khi rửa.',
    type: 'ADJACENCY',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 10,
    config: {
      sourceCode: 'C01',
      sourceCategory: 'prep',
      targetCategory: 'sink',
      maxDistanceMm: 900,
    },
  },
  {
    id: 'rule-spice-near-cooktop',
    code: 'RULE_04C',
    name: 'Khoang gia vị nằm gần bếp nhất có thể',
    description: 'Khoang gia vị (SP01) phải nằm gần khoang bếp nấu (B01) nhất có thể (khoảng cách <= 900mm, khuyến nghị liền kề) để người nấu thuận tiện với tay lấy gia vị, nêm nếm khi đang nấu nướng.',
    type: 'ADJACENCY',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 10,
    config: {
      sourceCode: 'SP01',
      sourceCategory: 'prep',
      targetCategory: 'cooking',
      maxDistanceMm: 900,
    },
  },
  {
    id: 'rule-sink-between-cutlery-dishwasher',
    code: 'RULE_04D',
    name: 'Khoang chậu rửa nằm giữa khoang dao thớt và khoang máy rửa bát',
    description: 'Khi có đủ khoang dao thớt, chậu rửa và máy rửa bát, khoang chậu rửa (S01) nên nằm ở giữa khoang dao thớt (C01) và máy rửa bát (D01) tạo thành chuỗi liên hoàn tối ưu: Dao thớt ⟷ Chậu rửa ⟷ Máy rửa bát.',
    type: 'ORDER',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 10,
    config: {},
  },

  // --- NHÓM 5: QUY TẮC THIẾT KẾ TỦ TRÊN (UPPER CABINET RULES) ---
  {
    id: 'rule-upper-max-storage-width',
    code: 'RULE_U01',
    name: 'Khoang để đồ tủ trên kích thước tối đa 900mm',
    description: 'Các khoang tủ chứa đồ tủ trên (UT01) có kích thước chiều rộng tối đa 900mm để đảm bảo kết cấu chịu lực, tránh võng đợt gỗ và xệ bản lề.',
    type: 'UPPER_MAX_STORAGE_WIDTH',
    severity: 'ERROR', // Hard constraint
    enabled: true,
    weight: 15,
    config: {
      maxWidthMm: 900,
    },
  },
  {
    id: 'rule-upper-hood-align-cooktop',
    code: 'RULE_U02',
    name: 'Tim khoang hút mùi thẳng tim khoang bếp',
    description: 'Tim của khoang máy hút mùi (UH01) tủ trên phải thẳng hàng với tim của khoang bếp nấu (B01) tủ dưới (độ lệch cho phép <= 30mm) để đạt hiệu suất hút mùi tối ưu và thẩm mỹ đối xứng.',
    type: 'UPPER_HOOD_ALIGN_COOKTOP',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 20,
    config: {
      maxToleranceMm: 30,
    },
  },
  {
    id: 'rule-upper-dish-align-sink',
    code: 'RULE_U03',
    name: 'Tim khoang giá bát thẳng tim khoang chậu rửa',
    description: 'Tim của khoang giá bát đĩa (UB01, UB02, UB03) ở tủ trên phải thẳng hàng với tim của khoang chậu rửa (S01) ở tủ dưới (độ lệch cho phép <= 30mm) để người làm bếp úp bát đĩa trực tiếp, nước ráo vào lòng chậu.',
    type: 'UPPER_DISH_ALIGN_SINK',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 20,
    config: {
      maxToleranceMm: 30,
    },
  },
  {
    id: 'rule-upper-multi-dish-priority',
    code: 'RULE_U04',
    name: 'Ưu tiên giá bát cố định thẳng chậu, giá bát nâng hạ trên máy rửa bát',
    description: 'Nếu chọn sử dụng cả giá bát cố định (UB02) và giá bát nâng hạ cơ (UB01) hoặc điện (UB03), ưu tiên bố trí giá bát cố định thẳng tim chậu rửa (S01), và giá bát nâng hạ nằm ngay trên khoang máy rửa bát (D01).',
    type: 'UPPER_MULTI_DISH_PRIORITY',
    severity: 'WARNING', // Soft constraint
    enabled: true,
    weight: 15,
    config: {},
  },
  {
    id: 'rule-upper-no-overlap-tall-unit',
    code: 'RULE_U05',
    name: 'Tủ trên không bố trí đè lên vị trí khoang tủ cao',
    description: 'Các khoang tủ cao (Tủ lạnh F01, Tủ đồ khô P01, Tủ thiết bị A01) chiếm trọn chiều cao từ sàn đến trần. Hệ tủ trên chỉ thiết kế vào các khoảng trống phía trên mặt bàn tủ dưới, tuyệt đối không bố trí đè lên các khoang tủ cao.',
    type: 'UPPER_NO_OVERLAP_TALL_UNIT',
    severity: 'ERROR', // Hard constraint
    enabled: true,
    weight: 25,
    config: {},
  },
];

export const INITIAL_LAYOUT: KitchenLayout = {
  id: 'layout-initial',
  name: 'Bản thiết kế mới',
  shape: 'I',
  edgeA: {
    id: 'edge_A',
    name: 'Cạnh A',
    length: 3600,
    depth: 600,
    height: 850,
  },
  placedModules: [],
  placedUpperModules: [],
  upperDepth: 350,
  upperHeight: 750,
  cornerConfig: {
    size: 600,
  },
  selectedModuleCodes: ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01'],
  designPhase: 'setup',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
