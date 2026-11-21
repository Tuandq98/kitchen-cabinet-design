import {
  KitchenLayout,
  DesignRule,
  ValidationReport,
  RuleViolation,
  WorkTriangleMetrics,
  KitchenModule,
  EdgeId,
} from '../../types';
import { calculateLayout2D, getDistanceBetweenModules, getAvailableEdgeLength, getModuleGap } from '../../utils/geometry';

export class RuleEngine {
  private rules: DesignRule[];

  constructor(initialRules: DesignRule[] = []) {
    this.rules = initialRules;
  }

  public setRules(rules: DesignRule[]) {
    this.rules = rules;
  }

  public getRules(): DesignRule[] {
    return this.rules;
  }

  /**
   * Chạy toàn bộ quá trình kiểm tra rule trên layout
   * Khi phase === 'design_base' (đang sửa tủ dưới), bỏ qua toàn bộ rule của tủ trên.
   * Chỉ khi phase === 'design_upper' (sửa tủ trên), mới check các rule của tủ trên.
   */
  public evaluate(
    layout: KitchenLayout,
    catalog: KitchenModule[] = [],
    currentPhase?: 'setup' | 'design_base' | 'design_upper'
  ): ValidationReport {
    const activeRules = this.rules.filter((r) => r.enabled);
    const violations: RuleViolation[] = [];
    const layout2D = calculateLayout2D(layout);

    const effectivePhase = currentPhase || layout.designPhase || 'design_base';

    // 1. Tính toán Work Triangle Metrics
    const workTriangle = this.calculateWorkTriangle(layout2D);

    // 2. Chạy từng rule đã kích hoạt
    for (const rule of activeRules) {
      // Khi đang khởi tạo hoặc sửa tủ dưới, không kiểm tra các quy tắc của tủ trên
      if ((effectivePhase === 'design_base' || effectivePhase === 'setup') && rule.type.startsWith('UPPER_')) {
        continue;
      }

      switch (rule.type) {
        case 'REQUIRED_MODULE':
          this.checkRequiredModules(layout, rule, violations);
          break;

        case 'MIN_DISTANCE':
          this.checkMinDistance(layout2D, rule, violations);
          break;

        case 'EDGE_OVERFLOW':
          this.checkEdgeOverflow(layout, rule, violations);
          break;

        case 'WORK_TRIANGLE':
          this.checkWorkTriangle(workTriangle, rule, violations);
          break;

        case 'ADJACENCY':
          this.checkAdjacency(layout2D, rule, violations);
          break;

        case 'ORDER':
          this.checkModuleOrder(layout, layout2D, rule, violations);
          break;

        case 'COOKTOP_EDGE_CLEARANCE':
          this.checkCooktopEdgeClearance(layout, layout2D, rule, violations);
          break;

        case 'COOKTOP_NEAR_TALL_UNIT':
          this.checkCooktopNearTallUnits(layout2D, rule, violations, catalog);
          break;

        case 'FRIDGE_AT_EDGE':
          this.checkFridgeAtEdge(layout, rule, violations);
          break;

        case 'TALL_UNITS_AT_EDGE':
          this.checkTallUnitsAtEdge(layout, rule, violations);
          break;

        case 'TALL_PANTRY_APPLIANCE_ADJACENT':
          this.checkTallPantryApplianceAdjacent(layout, rule, violations);
          break;

        case 'UPPER_MAX_STORAGE_WIDTH':
          this.checkUpperMaxStorageWidth(layout, rule, violations);
          break;

        case 'UPPER_HOOD_ALIGN_COOKTOP':
          this.checkUpperHoodAlignCooktop(layout, layout2D, rule, violations);
          break;

        case 'UPPER_DISH_ALIGN_SINK':
          this.checkUpperDishAlignSink(layout, layout2D, rule, violations);
          break;

        case 'UPPER_MULTI_DISH_PRIORITY':
          this.checkUpperMultiDishPriority(layout, layout2D, rule, violations);
          break;

        case 'UPPER_NO_OVERLAP_TALL_UNIT':
          this.checkUpperNoOverlapTallUnits(layout, rule, violations, catalog);
          break;

        default:
          break;
      }
    }

    // 3. Tính điểm (Score: 0 - 100)
    let totalScore = 100;
    let hardValid = true;
    let passedCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    for (const violation of violations) {
      if (violation.severity === 'ERROR') {
        hardValid = false;
        failedCount++;
        totalScore -= 30; // Trừ nặng cho lỗi nghiêm trọng
      } else if (violation.severity === 'WARNING') {
        warningCount++;
        totalScore -= 10; // Trừ điểm cảnh báo
      }
    }

    passedCount = Math.max(0, activeRules.length - failedCount - warningCount);
    totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    return {
      timestamp: new Date().toISOString(),
      score: totalScore,
      hardValid,
      passedCount,
      failedCount,
      warningCount,
      violations,
      workTriangle,
    };
  }

  // --- PRIVATE RULE EVALUATION HELPERS ---

  private checkRequiredModules(
    layout: KitchenLayout,
    rule: DesignRule,
    violations: RuleViolation[]
  ) {
    const requiredCategories: string[] =
      rule.config?.requiredCategories || ['cooking', 'sink', 'refrigeration'];

    const presentCategories = new Set(
      layout.placedModules.map((m) => m.category)
    );

    const categoryNames: Record<string, string> = {
      cooking: 'Khoang bếp nấu',
      sink: 'Khoang chậu rửa',
      refrigeration: 'Khoang tủ lạnh',
      appliance: 'Thiết bị phụ trợ',
      prep: 'Khoang sơ chế/dao thớt',
    };

    for (const reqCat of requiredCategories) {
      if (!presentCategories.has(reqCat as any)) {
        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: rule.severity,
          message: `Thiếu khoang bắt buộc: ${categoryNames[reqCat] || reqCat}`,
          recommendation: `Kéo thả ít nhất một ${categoryNames[reqCat] || reqCat} từ thư viện vào bản thiết kế.`,
          involvedModuleIds: [],
        });
      }
    }
  }

  private checkMinDistance(
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[]
  ) {
    const fromCat = rule.config?.fromCategory || 'cooking';
    const toCat = rule.config?.toCategory || 'sink';
    const minDistanceMm = Number(rule.config?.minDistanceMm || 300);

    const fromModules = layout2D.modules.filter((m) => m.category === fromCat);
    const toModules = layout2D.modules.filter((m) => m.category === toCat);

    for (const fMod of fromModules) {
      for (const tMod of toModules) {
        // Nếu cùng 1 cạnh, tính khoảng cách khoảng hở mép-tới-mép dọc theo cạnh đó
        if (fMod.edgeId === tMod.edgeId) {
          const gap = getModuleGap(fMod, tMod);
          if (gap < minDistanceMm) {
            violations.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleName: rule.name,
              severity: rule.severity,
              message: `${fMod.name} và ${tMod.name} cách nhau ${Math.round(gap)}mm, nhỏ hơn khoảng cách tối thiểu ${minDistanceMm}mm.`,
              recommendation: `Bố trí khoang bàn chuẩn bị hoặc tủ gia vị ở giữa để đảm bảo khoảng cách an toàn >= ${minDistanceMm}mm.`,
              involvedModuleIds: [fMod.instanceId, tMod.instanceId],
            });
          }
        } else {
          // Khác cạnh (chữ L / U): khoảng cách Euclide 2D tâm tới tâm
          const dist = getDistanceBetweenModules(fMod, tMod);
          if (dist < minDistanceMm + 300) {
            violations.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleName: rule.name,
              severity: rule.severity,
              message: `${fMod.name} và ${tMod.name} nằm quá gần góc nối (khoảng cách thực tế: ${dist}mm < ${minDistanceMm + 300}mm).`,
              recommendation: `Dịch chuyển ${fMod.name} hoặc ${tMod.name} ra xa góc nối để người đứng thao tác không bị vướng nhau.`,
              involvedModuleIds: [fMod.instanceId, tMod.instanceId],
            });
          }
        }
      }
    }
  }

  private checkEdgeOverflow(
    layout: KitchenLayout,
    rule: DesignRule,
    violations: RuleViolation[]
  ) {
    const edgesToCheck: Array<{ id: 'edge_A' | 'edge_B' | 'edge_C'; name: string }> = [
      { id: 'edge_A', name: layout.edgeA.name || 'Cạnh A' },
    ];
    if (layout.shape === 'L' || layout.shape === 'U') {
      if (layout.edgeB) edgesToCheck.push({ id: 'edge_B', name: layout.edgeB.name || 'Cạnh B' });
    }
    if (layout.shape === 'U') {
      if (layout.edgeC) edgesToCheck.push({ id: 'edge_C', name: layout.edgeC.name || 'Cạnh C' });
    }

    for (const edge of edgesToCheck) {
      const avail = getAvailableEdgeLength(layout, edge.id);
      const modulesOnEdge = layout.placedModules.filter((m) => m.edgeId === edge.id);
      const totalWidth = modulesOnEdge.reduce((acc, m) => acc + m.width, 0);

      if (totalWidth > avail) {
        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: 'ERROR',
          message: `${edge.name} bị tràn kích thước: tổng khoang (${totalWidth}mm) vượt quá chiều dài khả dụng (${avail}mm) là ${totalWidth - avail}mm.`,
          recommendation: `Giảm bớt khoang trên ${edge.name} hoặc đổi sang biến thể kích thước nhỏ hơn.`,
          involvedModuleIds: modulesOnEdge.map((m) => m.instanceId),
        });
      }
    }
  }

  private checkWorkTriangle(
    wt: WorkTriangleMetrics,
    rule: DesignRule,
    violations: RuleViolation[]
  ) {
    if (!wt.sinkCoord || !wt.cooktopCoord || !wt.fridgeCoord) {
      // Đã có rule required check rồi, bỏ qua
      return;
    }

    const minPerimeter = Number(rule.config?.minPerimeterMm || 3500);
    const maxPerimeter = Number(rule.config?.maxPerimeterMm || 8500);

    if (wt.perimeter < minPerimeter) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Tam giác công năng quá chật hẹp: chu vi ${Math.round(wt.perimeter)}mm (chuẩn NKBA: ${minPerimeter}-${maxPerimeter}mm).`,
        recommendation: `Không gian làm việc có thể bị bí bách khi có nhiều hơn 1 người cùng nấu ăn. Giãn cách các khoang nếu có thể.`,
        involvedModuleIds: [],
      });
    } else if (wt.perimeter > maxPerimeter) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Tam giác công năng quá rộng: chu vi ${Math.round(wt.perimeter)}mm (vượt quá ${maxPerimeter}mm).`,
        recommendation: `Khoảng cách di chuyển giữa Tủ lạnh - Chậu rửa - Bếp nấu quá xa gây mệt mỏi khi thao tác liên tục.`,
        involvedModuleIds: [],
      });
    }
  }

  private checkAdjacency(
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[]
  ) {
    const srcCat = rule.config?.sourceCategory;
    const srcCode = rule.config?.sourceCode;
    const targetCat = rule.config?.targetCategory;
    const targetCats: string[] = rule.config?.targetCategories || (targetCat ? [targetCat] : []);
    const targetCode = rule.config?.targetCode;
    const maxDistanceMm = Number(rule.config?.maxDistanceMm || 900);

    const srcModules = layout2D.modules.filter((m) => {
      if (srcCode) return m.code === srcCode;
      if (srcCat) return m.category === srcCat;
      return true;
    });

    const targetModules = layout2D.modules.filter((m) => {
      if (targetCode) return m.code === targetCode;
      if (targetCats.length > 0) return targetCats.includes(m.category);
      return true;
    });

    if (srcModules.length === 0 || targetModules.length === 0) return;

    for (const src of srcModules) {
      let minDistanceFound = Infinity;
      let closestTarget: (typeof targetModules)[0] | null = null;

      for (const tgt of targetModules) {
        const dist = getModuleGap(src, tgt);

        if (dist < minDistanceFound) {
          minDistanceFound = dist;
          closestTarget = tgt;
        }
      }

      if (minDistanceFound > maxDistanceMm && closestTarget) {
        let recommendation = `Nên bố trí ${src.name} (${src.code}) ngay cạnh hoặc gần ${closestTarget.name} (${closestTarget.code}) để tối ưu thao tác.`;
        if (rule.code === 'RULE_04B') {
          recommendation = `Bố trí khoang dao thớt gần chậu rửa để thuận tiện lấy thớt sơ chế rau củ, thịt cá ngay sau khi rửa.`;
        } else if (rule.code === 'RULE_04C') {
          recommendation = `Bố trí khoang gia vị ngay cạnh bếp nấu để người nấu dễ dàng với tay lấy mắm, muối, gia vị nêm nếm khi đang chế biến.`;
        } else if (rule.code === 'RULE_04A') {
          recommendation = `Bố trí máy rửa bát ngay cạnh chậu rửa để tiện kết nối ống nước và gạt thức ăn thừa.`;
        }

        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: rule.severity,
          message: `${src.name} (${src.code}) cách ${closestTarget.name} (${closestTarget.code}) ${Math.round(minDistanceFound)}mm (quá xa, yêu cầu <= ${maxDistanceMm}mm).`,
          recommendation,
          involvedModuleIds: [src.instanceId, closestTarget.instanceId],
        });
      }
    }
  }

  private checkModuleOrder(
    layout: KitchenLayout,
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[]
  ) {
    if (rule.code === 'RULE_04D') {
      // Tìm 3 khoang: Dao thớt, Chậu rửa, Máy rửa bát
      const cutlery = layout2D.modules.find(
        (m) => m.code === 'C01' || (m.category === 'prep' && m.name.toLowerCase().includes('dao'))
      );
      const sink = layout2D.modules.find(
        (m) => m.category === 'sink' || m.code === 'S01'
      );
      const dishwasher = layout2D.modules.find(
        (m) => m.code === 'D01' || m.name.toLowerCase().includes('máy rửa bát')
      );

      // Quy tắc chỉ áp dụng khi CẢ 3 KHOANG CÙNG CÓ MẶT trên thiết kế
      if (!cutlery || !sink || !dishwasher) return;

      // Tính vị trí toàn cục theo luồng mặt bằng (Global sequence order)
      const getGlobalRank = (mod: (typeof layout2D.modules)[0]) => {
        let edgeMultiplier = 0;
        if (layout.shape === 'I') {
          edgeMultiplier = 0;
        } else if (layout.shape === 'L') {
          edgeMultiplier = mod.edgeId === 'edge_A' ? 0 : 1;
        } else if (layout.shape === 'U') {
          if (mod.edgeId === 'edge_B') edgeMultiplier = 0;
          else if (mod.edgeId === 'edge_A') edgeMultiplier = 1;
          else if (mod.edgeId === 'edge_C') edgeMultiplier = 2;
        }
        const placed = layout.placedModules.find((p) => p.instanceId === mod.instanceId);
        const posIndex = placed?.positionIndex ?? 0;
        return edgeMultiplier * 1000 + posIndex;
      };

      const rankC = getGlobalRank(cutlery);
      const rankS = getGlobalRank(sink);
      const rankD = getGlobalRank(dishwasher);

      const isSinkBetween =
        (rankC < rankS && rankS < rankD) || (rankD < rankS && rankS < rankC);

      if (!isSinkBetween) {
        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: rule.severity,
          message: `${sink.name} (${sink.code}) không nằm giữa ${cutlery.name} (${cutlery.code}) và ${dishwasher.name} (${dishwasher.code}).`,
          recommendation: `Bố trí chậu rửa ở giữa khoang dao thớt và máy rửa bát (Thứ tự tối ưu: Dao thớt ⟷ Chậu rửa ⟷ Máy rửa bát) để tạo luồng sơ chế - rửa - gạt rác dọn rửa tối ưu, tránh chéo tay.`,
          involvedModuleIds: [cutlery.instanceId, sink.instanceId, dishwasher.instanceId],
        });
      }
    }
  }

  private checkCooktopEdgeClearance(
    layout: KitchenLayout,
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[]
  ) {
    const minClearanceMm = Number(rule.config?.minEdgeClearanceMm || 300);
    const cooktopBoxes = layout2D.modules.filter(
      (m) => m.category === 'cooking' || m.code.startsWith('B')
    );

    if (cooktopBoxes.length === 0) return;

    for (const cook of cooktopBoxes) {
      if (layout.shape === 'I') {
        // Bếp chữ I: cả 2 đầu Cạnh A đều là mép tự do ra lối đi / mép tường
        const distLeft = cook.x;
        const distRight = Math.max(0, layout.edgeA.length - (cook.x + cook.width));

        if (distLeft < minClearanceMm) {
          violations.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleName: rule.name,
            severity: rule.severity,
            message: `${cook.name} (${cook.code}) đặt quá sát đầu bên trái cạnh bếp (cách mép ngoài chỉ ${Math.round(distLeft)}mm < ${minClearanceMm}mm).`,
            recommendation: `Bố trí khoang bàn đệm sơ chế hoặc tủ gia vị (tối thiểu ${minClearanceMm}mm) ở mép ngoài để đảm bảo an toàn, tránh va quẹt cán chảo ra lối đi.`,
            involvedModuleIds: [cook.instanceId],
          });
        }
        if (distRight < minClearanceMm) {
          violations.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleName: rule.name,
            severity: rule.severity,
            message: `${cook.name} (${cook.code}) đặt quá sát đầu bên phải cạnh bếp (cách mép ngoài chỉ ${Math.round(distRight)}mm < ${minClearanceMm}mm).`,
            recommendation: `Bố trí khoang bàn đệm sơ chế hoặc tủ gia vị (tối thiểu ${minClearanceMm}mm) ở mép ngoài để đảm bảo an toàn, tránh va quẹt cán chảo ra lối đi.`,
            involvedModuleIds: [cook.instanceId],
          });
        }
      } else if (layout.shape === 'L') {
        if (cook.edgeId === 'edge_A') {
          // Cuối cạnh A là mép ngoài tự do
          const distEndA = Math.max(0, layout.edgeA.length - (cook.x + cook.width));
          if (distEndA < minClearanceMm) {
            violations.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleName: rule.name,
              severity: rule.severity,
              message: `${cook.name} (${cook.code}) đặt quá sát mép ngoài cùng Cạnh A (cách mép ngoài chỉ ${Math.round(distEndA)}mm < ${minClearanceMm}mm).`,
              recommendation: `Bố trí khoang bàn đệm sơ chế hoặc tủ gia vị (tối thiểu ${minClearanceMm}mm) ở mép ngoài để đảm bảo an toàn, tránh va quẹt cán chảo ra lối đi.`,
              involvedModuleIds: [cook.instanceId],
            });
          }
        } else if (cook.edgeId === 'edge_B' && layout.edgeB) {
          // Cuối cạnh B là mép ngoài tự do
          const distEndB = Math.max(0, layout.edgeB.length - (cook.y + cook.height));
          if (distEndB < minClearanceMm) {
            violations.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleName: rule.name,
              severity: rule.severity,
              message: `${cook.name} (${cook.code}) đặt quá sát mép ngoài cùng Cạnh B (cách mép ngoài chỉ ${Math.round(distEndB)}mm < ${minClearanceMm}mm).`,
              recommendation: `Bố trí khoang bàn đệm sơ chế hoặc tủ gia vị (tối thiểu ${minClearanceMm}mm) ở mép ngoài để đảm bảo an toàn, tránh va quẹt cán chảo ra lối đi.`,
              involvedModuleIds: [cook.instanceId],
            });
          }
        }
      } else if (layout.shape === 'U') {
        if (cook.edgeId === 'edge_B' && layout.edgeB) {
          const distEndB = Math.max(0, layout.edgeB.length - (cook.y + cook.height));
          if (distEndB < minClearanceMm) {
            violations.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleName: rule.name,
              severity: rule.severity,
              message: `${cook.name} (${cook.code}) đặt quá sát mép ngoài cùng Cạnh B (cách mép ngoài chỉ ${Math.round(distEndB)}mm < ${minClearanceMm}mm).`,
              recommendation: `Bố trí khoang bàn đệm sơ chế hoặc tủ gia vị (tối thiểu ${minClearanceMm}mm) ở mép ngoài để đảm bảo an toàn, tránh va quẹt cán chảo ra lối đi.`,
              involvedModuleIds: [cook.instanceId],
            });
          }
        } else if (cook.edgeId === 'edge_C' && layout.edgeC) {
          const distEndC = Math.max(0, layout.edgeC.length - (cook.y + cook.height));
          if (distEndC < minClearanceMm) {
            violations.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleName: rule.name,
              severity: rule.severity,
              message: `${cook.name} (${cook.code}) đặt quá sát mép ngoài cùng Cạnh C (cách mép ngoài chỉ ${Math.round(distEndC)}mm < ${minClearanceMm}mm).`,
              recommendation: `Bố trí khoang bàn đệm sơ chế hoặc tủ gia vị (tối thiểu ${minClearanceMm}mm) ở mép ngoài để đảm bảo an toàn, tránh va quẹt cán chảo ra lối đi.`,
              involvedModuleIds: [cook.instanceId],
            });
          }
        }
      }
    }
  }

  private checkCooktopNearTallUnits(
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[],
    catalog: KitchenModule[] = []
  ) {
    const minDistanceMm = Number(rule.config?.minDistanceMm || 300);

    const cooktopBoxes = layout2D.modules.filter(
      (m) => m.category === 'cooking' || m.code.startsWith('B')
    );

    // Tìm tất cả khoang tủ cao: Tủ lạnh F01, Tủ khô cao P01, Tủ thiết bị cao A01 hoặc có cờ isTallUnit
    const tallUnitBoxes = layout2D.modules.filter((m) => {
      if (m.category === 'refrigeration') return true;
      if (['F01', 'P01', 'A01'].includes(m.code)) return true;
      const catMod = catalog.find((c) => c.code === m.code);
      return catMod?.metadata?.isTallUnit === true;
    });

    if (cooktopBoxes.length === 0 || tallUnitBoxes.length === 0) return;

    for (const cook of cooktopBoxes) {
      for (const tall of tallUnitBoxes) {
        const dist = getModuleGap(cook, tall);

        if (dist < minDistanceMm) {
          violations.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleName: rule.name,
            severity: rule.severity,
            message: `${cook.name} (${cook.code}) đặt quá gần tủ cao ${tall.name} (${tall.code}), cách nhau chỉ ${Math.round(dist)}mm (yêu cầu >= ${minDistanceMm}mm).`,
            recommendation: `Nhiệt lượng và dầu mỡ từ bếp nấu sẽ làm nóng và hỏng vách tủ cao ${tall.name}. Bố trí khoang đệm (gia vị/tủ ngăn kéo >= ${minDistanceMm}mm) ở giữa.`,
            involvedModuleIds: [cook.instanceId, tall.instanceId],
          });
        }
      }
    }
  }

  private checkFridgeAtEdge(
    layout: KitchenLayout,
    rule: DesignRule,
    violations: RuleViolation[]
  ): void {
    const fridgeModules = layout.placedModules.filter(
      (m) => m.code === 'F01' || m.category === 'refrigeration'
    );
    if (fridgeModules.length === 0) return;

    for (const fridge of fridgeModules) {
      const edgeModules = layout.placedModules
        .filter((m) => m.edgeId === fridge.edgeId)
        .sort((a, b) => a.positionIndex - b.positionIndex);

      if (edgeModules.length <= 1) continue;

      const idx = edgeModules.findIndex((m) => m.instanceId === fridge.instanceId);
      const isFirst = idx === 0;
      const isLast = idx === edgeModules.length - 1;

      // Kiểm tra xem phía ngoài của tủ lạnh chỉ toàn là hệ tủ cao (P01, A01) hay bị kẹp bởi mặt bàn bếp
      const leftModules = edgeModules.slice(0, idx);
      const rightModules = edgeModules.slice(idx + 1);
      const leftIsAllTall = leftModules.length > 0 && leftModules.every((m) => ['P01', 'A01'].includes(m.code));
      const rightIsAllTall = rightModules.length > 0 && rightModules.every((m) => ['P01', 'A01'].includes(m.code));

      // Kiểm tra vị trí sát mép ngoài của dãy tủ bếp (hoặc nằm trong khối tủ cao ở mép ngoài)
      let isEdgeValid = false;
      if (layout.shape === 'I') {
        // Với bếp chữ I, cả 2 đầu (đầu hoặc cuối) đều là mép ngoài cùng (kể cả khi đứng cạnh khối tủ cao P01, A01 ở mép)
        isEdgeValid = isFirst || isLast || leftIsAllTall || rightIsAllTall;
      } else if (layout.shape === 'L') {
        // Với bếp chữ L, vị trí đầu (idx=0) là góc, mép ngoài cùng thực sự là vị trí cuối (isLast) hoặc liền kề tủ cao ở cuối (rightIsAllTall)
        isEdgeValid = isLast || rightIsAllTall;
      } else if (layout.shape === 'U') {
        // Với bếp chữ U, Cạnh A bị kẹp bởi 2 góc ở cả 2 đầu. Chỉ có cạnh B hoặc C ở vị trí cuối mới là mép ngoài
        if (fridge.edgeId === 'edge_A') {
          isEdgeValid = false;
        } else {
          isEdgeValid = isLast || rightIsAllTall;
        }
      }

      if (!isEdgeValid) {
        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: rule.severity,
          message: `Khoang tủ lạnh (${fridge.name} - ${fridge.code}) đang bị kẹp ở giữa các khoang bàn bếp (vị trí thứ ${idx + 1}/${edgeModules.length} trên ${fridge.edgeId === 'edge_A' ? 'Cạnh A' : fridge.edgeId === 'edge_B' ? 'Cạnh B' : 'Cạnh C'}).`,
          recommendation: `Khoang tủ lạnh là hệ tủ cao, bắt buộc phải đặt ở sát mép ngoài cùng của dãy tủ bếp (không bị kẹp giữa các bề mặt thao tác) để không chia cắt mặt bàn sơ chế và nấu nướng.`,
          involvedModuleIds: [fridge.instanceId],
        });
      }
    }
  }

  private checkTallUnitsAtEdge(
    layout: KitchenLayout,
    rule: DesignRule,
    violations: RuleViolation[]
  ): void {
    const tallCodes = ['P01', 'A01', 'F01'];
    const tallModules = layout.placedModules.filter((m) =>
      tallCodes.includes(m.code) || m.category === 'refrigeration'
    );
    if (tallModules.length === 0) return;

    for (const tall of tallModules) {
      const edgeModules = layout.placedModules
        .filter((m) => m.edgeId === tall.edgeId)
        .sort((a, b) => a.positionIndex - b.positionIndex);

      if (edgeModules.length <= 1) continue;

      const idx = edgeModules.findIndex((m) => m.instanceId === tall.instanceId);
      const isFirst = idx === 0;
      const isLast = idx === edgeModules.length - 1;

      // Kiểm tra xem phía ngoài của khoang này có phải chỉ toàn là các khoang tủ đứng (F01, P01, A01) hay không
      const leftModules = edgeModules.slice(0, idx);
      const rightModules = edgeModules.slice(idx + 1);
      const leftIsAllTall = leftModules.length > 0 && leftModules.every((m) => tallCodes.includes(m.code) || m.category === 'refrigeration');
      const rightIsAllTall = rightModules.length > 0 && rightModules.every((m) => tallCodes.includes(m.code) || m.category === 'refrigeration');

      let isEdgeValid = false;
      if (layout.shape === 'I') {
        // Bếp chữ I: 2 đầu cạnh là mép ngoài cùng (hoặc nằm liền kề trong khối tủ cao ở mép ngoài)
        isEdgeValid = isFirst || isLast || leftIsAllTall || rightIsAllTall;
      } else if (layout.shape === 'L') {
        // Bếp chữ L: idx=0 là góc giao, mép ngoài cùng là cuối cạnh hoặc liền kề cụm tủ cao ở cuối
        isEdgeValid = isLast || rightIsAllTall;
      } else if (layout.shape === 'U') {
        // Bếp chữ U: Cạnh A bị kẹp bởi 2 góc. Chỉ có cuối Cạnh B hoặc Cạnh C mới là mép ngoài
        if (tall.edgeId === 'edge_A') {
          isEdgeValid = false;
        } else {
          isEdgeValid = isLast || rightIsAllTall;
        }
      }

      if (!isEdgeValid) {
        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: rule.severity,
          message: `Khoang tủ đứng "${tall.name}" (${tall.code}) đang bị kẹp ở giữa các khoang bàn bếp thao tác (vị trí thứ ${idx + 1}/${edgeModules.length} trên ${tall.edgeId === 'edge_A' ? 'Cạnh A' : tall.edgeId === 'edge_B' ? 'Cạnh B' : 'Cạnh C'}).`,
          recommendation: `Các tủ đứng cao tầng (Tủ lạnh, Tủ đồ khô, Tủ thiết bị cao) phải được bố trí ở phía ngoài cùng của dãy tủ bếp để không làm đứt đoạn mặt bàn bếp sơ chế và nấu nướng.`,
          involvedModuleIds: [tall.instanceId],
        });
      }
    }

    // Kiểm tra ưu tiên: "Ưu tiên tủ lạnh đặt trước, sau đó đến vị trí hai loại tủ này"
    const edgesToCheck: EdgeId[] = ['edge_A', 'edge_B', 'edge_C'];
    for (const eId of edgesToCheck) {
      const edgeMods = layout.placedModules
        .filter((m) => m.edgeId === eId)
        .sort((a, b) => a.positionIndex - b.positionIndex);
      const fIdx = edgeMods.findIndex((m) => m.code === 'F01');
      if (fIdx === -1) continue;

      const pIdx = edgeMods.findIndex((m) => m.code === 'P01');
      const aIdx = edgeMods.findIndex((m) => m.code === 'A01');
      const otherTallIndices = [pIdx, aIdx].filter((i) => i !== -1);
      if (otherTallIndices.length === 0) continue;

      // Nếu cùng nằm trong 1 cụm tủ đứng ở mép
      if (otherTallIndices.some((idx) => Math.abs(idx - fIdx) <= 2)) {
        const minIdx = Math.min(fIdx, ...otherTallIndices);
        const maxIdx = Math.max(fIdx, ...otherTallIndices);

        if (minIdx === 0 && fIdx !== 0) {
          // Nằm ở đầu mép trái nhưng F01 không đứng ở ngoài cùng nhất
          violations.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleName: rule.name,
            severity: 'WARNING',
            message: `Tại khối tủ đứng ở đầu mép trái, Khoang tủ lạnh (F01) nên được ưu tiên đặt ở vị trí mép ngoài cùng nhất trước khoang tủ đồ khô/thiết bị cao tầng để thuận tiện tiếp cận thực phẩm.`,
            recommendation: `Đổi vị trí để Khoang tủ lạnh (F01) nằm ở mép ngoài cùng (vị trí số 1), sau đó tiếp giáp đến các khoang tủ đồ khô/thiết bị cao tầng.`,
            involvedModuleIds: [edgeMods[fIdx].instanceId],
          });
        } else if (maxIdx === edgeMods.length - 1 && fIdx !== edgeMods.length - 1 && minIdx > 0) {
          const allAreTall = edgeMods.slice(minIdx).every((m) => tallCodes.includes(m.code));
          if (allAreTall && fIdx < Math.max(...otherTallIndices)) {
            violations.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleName: rule.name,
              severity: 'WARNING',
              message: `Tại khối tủ đứng ở mép ngoài cùng bên phải, Khoang tủ lạnh (F01) nên được ưu tiên đặt ở vị trí mép ngoài cùng trước các khoang tủ đồ khô/thiết bị cao tầng.`,
              recommendation: `Bố trí Khoang tủ lạnh (F01) ở vị trí ngoài cùng của khối tủ cao.`,
              involvedModuleIds: [edgeMods[fIdx].instanceId],
            });
          }
        }
      }
    }
  }

  private checkTallPantryApplianceAdjacent(
    layout: KitchenLayout,
    rule: DesignRule,
    violations: RuleViolation[]
  ): void {
    const p01 = layout.placedModules.find((m) => m.code === 'P01');
    const a01 = layout.placedModules.find((m) => m.code === 'A01');

    if (!p01 || !a01) return;

    // 1. Kiểm tra có nằm cùng trên một cạnh hay không
    if (p01.edgeId !== a01.edgeId) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Khoang tủ đồ khô (${p01.name} - P01) và Khoang tủ thiết bị (${a01.name} - A01) đang nằm ở 2 cạnh khác nhau (${p01.edgeId === 'edge_A' ? 'Cạnh A' : p01.edgeId === 'edge_B' ? 'Cạnh B' : 'Cạnh C'} và ${a01.edgeId === 'edge_A' ? 'Cạnh A' : a01.edgeId === 'edge_B' ? 'Cạnh B' : 'Cạnh C'}).`,
        recommendation: `Khoang tủ đồ khô cao tầng và khoang tủ thiết bị cao tầng nên đặt cạnh nhau để tạo thành khối tủ đứng thống nhất, cân đối với vị trí tủ lạnh ở khu vực rìa đối diện.`,
        involvedModuleIds: [p01.instanceId, a01.instanceId],
      });
      return;
    }

    // 2. Nếu cùng cạnh, kiểm tra xem có đặt liền kề nhau không (không bị các khoang khác xen vào giữa)
    const edgeModules = layout.placedModules
      .filter((m) => m.edgeId === p01.edgeId)
      .sort((a, b) => a.positionIndex - b.positionIndex);

    const idxP = edgeModules.findIndex((m) => m.instanceId === p01.instanceId);
    const idxA = edgeModules.findIndex((m) => m.instanceId === a01.instanceId);

    if (Math.abs(idxP - idxA) !== 1) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Khoang tủ đồ khô cao tầng (P01) và Khoang tủ thiết bị cao tầng (A01) đang bị phân tách bởi các khoang khác.`,
        recommendation: `Nên đặt khoang tủ đồ khô và khoang tủ thiết bị cao tầng liền kề nhau để tạo thành khối tủ đứng đồng nhất, cân đối với tủ lạnh ở rìa đối diện.`,
        involvedModuleIds: [p01.instanceId, a01.instanceId],
      });
    }
  }

  private checkUpperMaxStorageWidth(
    layout: KitchenLayout,
    rule: DesignRule,
    violations: RuleViolation[]
  ): void {
    const upperModules = layout.placedUpperModules || [];
    const maxWidthMm = rule.config.maxWidthMm || 900;

    for (const m of upperModules) {
      if (m.code === 'UT01' || m.category === 'storage') {
        if (m.width > maxWidthMm) {
          violations.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Khoang để đồ tủ trên "${m.name}" (${m.code}) có chiều rộng ${m.width}mm vượt quá giới hạn tối đa ${maxWidthMm}mm.`,
            recommendation: `Chia nhỏ thành các khoang <= ${maxWidthMm}mm (ví dụ 600mm, 700mm, 800mm, 900mm) để tránh võng đợt gỗ và xệ bản lề theo thời gian.`,
            involvedModuleIds: [m.instanceId],
          });
        }
      }
    }
  }

  private checkUpperHoodAlignCooktop(
    layout: KitchenLayout,
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[]
  ): void {
    const baseCooktop = layout2D.modules.find(
      (m) => m.category === 'cooking' || m.code === 'B01'
    );
    const upperHood = layout2D.upperModules.find(
      (m) => m.code === 'UH01' || m.category === 'appliance'
    );

    if (!baseCooktop || !upperHood) return;

    const maxToleranceMm = rule.config.maxToleranceMm ?? 30;

    if (baseCooktop.edgeId !== upperHood.edgeId) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Khoang hút mùi (${upperHood.name}) đặt ở ${upperHood.edgeId === 'edge_A' ? 'Cạnh A' : 'Cạnh B'} trong khi Bếp nấu (${baseCooktop.name}) đặt ở ${baseCooktop.edgeId === 'edge_A' ? 'Cạnh A' : 'Cạnh B'}.`,
        recommendation: `Bố trí khoang hút mùi nằm cùng cạnh với bếp nấu và căn tim thẳng hàng để hút mùi hiệu quả.`,
        involvedModuleIds: [baseCooktop.instanceId, upperHood.instanceId],
      });
      return;
    }

    let cookCenter = 0;
    let hoodCenter = 0;

    if (baseCooktop.edgeId === 'edge_A') {
      cookCenter = baseCooktop.centerX;
      hoodCenter = upperHood.centerX;
    } else {
      cookCenter = baseCooktop.centerY;
      hoodCenter = upperHood.centerY;
    }

    const diff = Math.abs(hoodCenter - cookCenter);

    if (diff > maxToleranceMm) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Tim khoang hút mùi (${upperHood.name}) lệch ${Math.round(diff)}mm so với tim khoang bếp nấu (${baseCooktop.name}) (tiêu chuẩn cho phép <= ${maxToleranceMm}mm).`,
        recommendation: `Dịch chuyển khoang hút mùi để tim hút mùi thẳng tim bếp nấu (độ lệch 0mm) giúp khói và mùi thức ăn được thu gom triệt để và thẩm mỹ cân đối.`,
        involvedModuleIds: [baseCooktop.instanceId, upperHood.instanceId],
      });
    }
  }

  private checkUpperDishAlignSink(
    layout: KitchenLayout,
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[]
  ): void {
    const baseSink = layout2D.modules.find(
      (m) => m.category === 'sink' || m.code === 'S01'
    );
    if (!baseSink) return;

    const dishRacks = layout2D.upperModules.filter((m) =>
      ['UB01', 'UB02', 'UB03'].includes(m.code)
    );
    if (dishRacks.length === 0) return;

    const fixedRack = dishRacks.find((m) => m.code === 'UB02');
    const targetRack = dishRacks.length > 1 && fixedRack ? fixedRack : dishRacks[0];

    const maxToleranceMm = rule.config.maxToleranceMm ?? 30;

    if (targetRack.edgeId !== baseSink.edgeId) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Khoang giá bát (${targetRack.name}) đặt ở cạnh khác so với khoang chậu rửa (${baseSink.name}).`,
        recommendation: `Bố trí khoang giá bát nằm ngay trên chậu rửa để nước ráo từ bát đĩa mới rửa chảy thẳng vào lòng chậu.`,
        involvedModuleIds: [baseSink.instanceId, targetRack.instanceId],
      });
      return;
    }

    const sinkCenter = baseSink.edgeId === 'edge_A' ? baseSink.centerX : baseSink.centerY;
    const rackCenter = targetRack.edgeId === 'edge_A' ? targetRack.centerX : targetRack.centerY;
    const diff = Math.abs(rackCenter - sinkCenter);

    if (diff > maxToleranceMm) {
      violations.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Tim khoang giá bát (${targetRack.name} - ${targetRack.code}) lệch ${Math.round(diff)}mm so với tim khoang chậu rửa (${baseSink.name}) (yêu cầu <= ${maxToleranceMm}mm).`,
        recommendation: `Bố trí khoang giá bát thẳng tim phía trên chậu rửa để thao tác úp bát đĩa thuận tiện, nước không rỏ xuống mặt bếp.`,
        involvedModuleIds: [baseSink.instanceId, targetRack.instanceId],
      });
    }
  }

  private checkUpperMultiDishPriority(
    layout: KitchenLayout,
    layout2D: ReturnType<typeof calculateLayout2D>,
    rule: DesignRule,
    violations: RuleViolation[]
  ): void {
    const upperModules = layout2D.upperModules;
    const fixedRack = upperModules.find((m) => m.code === 'UB02');
    const pullDownRack = upperModules.find((m) => ['UB01', 'UB03'].includes(m.code));

    if (!fixedRack || !pullDownRack) return;

    const baseSink = layout2D.modules.find(
      (m) => m.category === 'sink' || m.code === 'S01'
    );
    const baseDishwasher = layout2D.modules.find(
      (m) => m.category === 'appliance' && (m.code === 'D01' || m.name.toLowerCase().includes('rửa bát'))
    );

    // 1. Kiểm tra giá bát cố định thẳng chậu rửa
    if (baseSink) {
      const sinkCenter = baseSink.edgeId === 'edge_A' ? baseSink.centerX : baseSink.centerY;
      const fixedCenter = fixedRack.edgeId === 'edge_A' ? fixedRack.centerX : fixedRack.centerY;
      const diffFixed = Math.abs(fixedCenter - sinkCenter);

      if (fixedRack.edgeId !== baseSink.edgeId || diffFixed > 30) {
        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: rule.severity,
          message: `Khi sử dụng cả 2 giá bát, giá bát cố định (${fixedRack.name}) chưa được ưu tiên đặt thẳng tim chậu rửa (${baseSink.name}).`,
          recommendation: `Chuyển khoang giá bát cố định (UB02) về vị trí thẳng tim chậu rửa (S01), và chuyển giá bát nâng hạ (${pullDownRack.name}) sang vị trí trên máy rửa bát.`,
          involvedModuleIds: [fixedRack.instanceId, baseSink.instanceId],
        });
      }
    }

    // 2. Kiểm tra giá bát nâng hạ nằm trên máy rửa bát
    if (baseDishwasher) {
      const dwCenter = baseDishwasher.edgeId === 'edge_A' ? baseDishwasher.centerX : baseDishwasher.centerY;
      const pullDownCenter = pullDownRack.edgeId === 'edge_A' ? pullDownRack.centerX : pullDownRack.centerY;
      const diffPullDown = Math.abs(pullDownCenter - dwCenter);

      if (pullDownRack.edgeId !== baseDishwasher.edgeId || diffPullDown > 100) {
        violations.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          severity: rule.severity,
          message: `Khoang giá bát nâng hạ (${pullDownRack.name}) nên nằm ngay trên khoang máy rửa bát (${baseDishwasher.name}) để thao tác cất bát đĩa tối ưu.`,
          recommendation: `Bố trí khoang giá bát nâng hạ (${pullDownRack.code}) ở tủ trên thẳng hàng với khoang máy rửa bát (D01) ở tủ dưới để khi dỡ bát đĩa từ máy ra có thể xếp ngay lên giá.`,
          involvedModuleIds: [pullDownRack.instanceId, baseDishwasher.instanceId],
        });
      }
    }
  }

  private checkUpperNoOverlapTallUnits(
    layout: KitchenLayout,
    rule: DesignRule,
    violations: RuleViolation[],
    catalog: KitchenModule[]
  ): void {
    const upperModules = layout.placedUpperModules || [];
    if (upperModules.length === 0) return;

    // Tìm các khoang tủ cao ở tủ dưới (F01 tủ lạnh, P01 tủ đồ khô, A01 tủ thiết bị)
    const baseModules = layout.placedModules;
    const tallUnits = baseModules.filter((m) => {
      if (m.code === 'F01' || m.code === 'P01' || m.code === 'A01') return true;
      const catMod = catalog.find((cm) => cm.id === m.moduleId || cm.code === m.code);
      return catMod?.metadata?.isTallUnit;
    });

    if (tallUnits.length === 0) return;

    for (const upper of upperModules) {
      for (const tall of tallUnits) {
        if (upper.edgeId !== tall.edgeId) continue;

        const upperStart = upper.offset;
        const upperEnd = upper.offset + upper.width;
        const tallStart = tall.offset;
        const tallEnd = tall.offset + tall.width;

        const overlap = Math.max(0, Math.min(upperEnd, tallEnd) - Math.max(upperStart, tallStart));

        if (overlap > 10) {
          violations.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Khoang tủ trên (${upper.name} - ${upper.code}) đang chồng lấn ${overlap}mm vào vị trí khoang tủ cao (${tall.name} - ${tall.code}).`,
            recommendation: `Khoang tủ cao chiếm trọn chiều cao từ sàn tới trần. Chỉ thiết kế hệ tủ trên vào các khoảng trống phía trên bàn bếp của tủ dưới, không đặt đè lên khoang tủ cao.`,
            involvedModuleIds: [upper.instanceId, tall.instanceId],
          });
        }
      }
    }
  }

  private calculateWorkTriangle(
    layout2D: ReturnType<typeof calculateLayout2D>
  ): WorkTriangleMetrics {
    const sink = layout2D.modules.find((m) => m.category === 'sink');
    const cook = layout2D.modules.find((m) => m.category === 'cooking');
    const fridge = layout2D.modules.find((m) => m.category === 'refrigeration');

    if (!sink || !cook || !fridge) {
      return {
        sinkToCooktop: 0,
        cooktopToFridge: 0,
        fridgeToSink: 0,
        perimeter: 0,
        isValid: false,
      };
    }

    const sCoord = { x: sink.centerX, y: sink.centerY };
    const cCoord = { x: cook.centerX, y: cook.centerY };
    const fCoord = { x: fridge.centerX, y: fridge.centerY };

    const distSC = Math.round(
      Math.hypot(sCoord.x - cCoord.x, sCoord.y - cCoord.y)
    );
    const distCF = Math.round(
      Math.hypot(cCoord.x - fCoord.x, cCoord.y - fCoord.y)
    );
    const distFS = Math.round(
      Math.hypot(fCoord.x - sCoord.x, fCoord.y - sCoord.y)
    );
    const perimeter = distSC + distCF + distFS;

    const isValid = perimeter >= 3500 && perimeter <= 8500;

    return {
      sinkCoord: sCoord,
      cooktopCoord: cCoord,
      fridgeCoord: fCoord,
      sinkToCooktop: distSC,
      cooktopToFridge: distCF,
      fridgeToSink: distFS,
      perimeter,
      isValid,
    };
  }
}
