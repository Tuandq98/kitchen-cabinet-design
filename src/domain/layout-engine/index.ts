import {
  KitchenLayout,
  KitchenModule,
  DesignRule,
  LayoutPlanCandidate,
  PlacedModuleInstance,
  EdgeId,
} from '../../types';
import { RuleEngine } from '../rule-engine';
import { getAvailableEdgeLength } from '../../utils/geometry';

export interface GenerationInput {
  shape: 'I' | 'L' | 'U';
  edgeA: { length: number; depth: number; height: number };
  edgeB?: { length: number; depth: number; height: number; angle?: number };
  edgeC?: { length: number; depth: number; height: number; angle?: number };
  catalog: KitchenModule[];
  rules: DesignRule[];
  selectedModuleCodes?: string[];
  currentPlacedModules?: PlacedModuleInstance[];
  preferences?: {
    includeDishwasher?: boolean;
    includeCutleryTray?: boolean;
    includeOven?: boolean;
    prioritizePrepSpace?: boolean;
  };
}

export class LayoutEngine {
  private ruleEngine: RuleEngine;

  constructor(rules: DesignRule[]) {
    this.ruleEngine = new RuleEngine(rules);
  }

  /**
   * Sinh các phương án bố trí tự động theo thuật toán Heuristic CSP + Scoring
   */
  public generateLayouts(input: GenerationInput): {
    candidates: LayoutPlanCandidate[];
    error?: string;
  } {
    const { shape, edgeA, edgeB, edgeC, catalog, preferences } = input;

    // 1. Kiểm tra kích thước mặt bằng cơ sở
    const minRequiredLength = 2400; // Chiều dài tối thiểu để bố trí Bếp + Chậu + Tủ lạnh chuẩn
    if (shape === 'I' && edgeA.length < minRequiredLength) {
      return {
        candidates: [],
        error: `Chiều dài cạnh bếp chữ I (${edgeA.length}mm) quá nhỏ. Cần tối thiểu ${minRequiredLength}mm để bố trí đủ Tủ lạnh, Chậu rửa và Bếp nấu hợp lệ.`,
      };
    }

    if (shape === 'L' && (!edgeB || edgeA.length < 2000 || edgeB.length < 1600)) {
      return {
        candidates: [],
        error: `Kích thước bếp chữ L không đủ không gian. Cạnh A cần tối thiểu 2000mm và Cạnh B cần tối thiểu 1600mm.`,
      };
    }

    if (
      shape === 'U' &&
      (!edgeB || !edgeC || edgeA.length < 2400 || edgeB.length < 1800 || edgeC.length < 1800)
    ) {
      return {
        candidates: [],
        error: `Kích thước bếp chữ U không đủ không gian. Cạnh A cần tối thiểu 2400mm, Cạnh B và C cần tối thiểu 1800mm.`,
      };
    }

    // 2. Tìm các modules cốt lõi trong Catalog
    const fridgeMod = catalog.find((m) => m.category === 'refrigeration') || catalog.find((m) => m.code === 'F01');
    const sinkMod = catalog.find((m) => m.category === 'sink') || catalog.find((m) => m.code === 'S01');
    const cookMod = catalog.find((m) => m.category === 'cooking') || catalog.find((m) => m.code === 'B01');
    const dishMod = catalog.find((m) => m.category === 'appliance' && m.metadata?.isDishwasher) || catalog.find((m) => m.code === 'D01');
    const cutleryMod = catalog.find((m) => m.code === 'C01') || catalog.find((m) => m.category === 'prep' && m.name.includes('dao'));
    const spiceMod = catalog.find((m) => m.code === 'SP01') || catalog.find((m) => m.category === 'prep' && m.name.includes('gia vị'));
    const storageMod = catalog.find((m) => m.category === 'storage') || catalog.find((m) => m.code === 'T01');
    const ovenMod = catalog.find((m) => m.code === 'M01');
    const riceMod = catalog.find((m) => m.code === 'R01' || m.metadata?.isRiceDispenser);
    const wasteMod = catalog.find((m) => m.code === 'W01' || m.metadata?.isWasteBin);
    const tallPantryMod = catalog.find((m) => m.code === 'P01');
    const tallApplianceMod = catalog.find((m) => m.code === 'A01');

    if (!fridgeMod || !sinkMod || !cookMod) {
      return {
        candidates: [],
        error: 'Thư viện thiếu các khoang bắt buộc: Bếp nấu, Chậu rửa hoặc Tủ lạnh.',
      };
    }

    // 3. Xây dựng các chiến lược phân bổ không gian (Heuristic Strategies)
    const rawCandidates: LayoutPlanCandidate[] = [];

    const availableMods = {
      fridgeMod,
      sinkMod,
      cookMod,
      dishMod,
      cutleryMod,
      spiceMod,
      storageMod,
      ovenMod,
      riceMod,
      wasteMod,
      tallPantryMod,
      tallApplianceMod,
    };

    if (shape === 'I') {
      this.generateForShapeI(input, availableMods, rawCandidates);
    } else if (shape === 'L') {
      this.generateForShapeL(input, availableMods, rawCandidates);
    } else if (shape === 'U') {
      this.generateForShapeU(input, availableMods, rawCandidates);
    }

    // 4. Lọc bỏ các phương án vi phạm Hard Constraints và sắp xếp theo Điểm số
    const validCandidates = rawCandidates.filter((cand) => {
      const rep = this.ruleEngine.evaluate(cand.layout);
      return rep.hardValid; // Chỉ chấp nhận hardValid
    });

    if (validCandidates.length === 0) {
      return {
        candidates: [],
        error: 'Không tìm thấy phương án nào thỏa mãn các ràng buộc cứng (Hard Constraints) với kích thước hiện tại. Vui lòng tăng kích thước cạnh bếp hoặc chọn biến thể khoang nhỏ hơn.',
      };
    }

    // Sắp xếp giảm dần theo điểm số
    validCandidates.sort((a, b) => b.score - a.score);

    // Lấy top 5 phương án tốt nhất
    const topCandidates = validCandidates.slice(0, 5);

    return {
      candidates: topCandidates,
    };
  }

  /**
   * Điều chỉnh kích thước biến thể của các khoang để phù hợp tối ưu với mét dài người dùng nhập
   */
  private adjustVariantsToFit(
    modules: { mod: KitchenModule; code: string; name: string; cat: string }[],
    availLength: number
  ): { mod: KitchenModule; code: string; name: string; cat: string; variant: { id: string; width: number; depth: number; height: number } }[] | null {
    if (modules.length === 0) return [];

    // Lấy biến thể nhỏ nhất của mỗi khoang
    const minVariants = modules.map((m) => {
      const sorted = [...m.mod.variants].sort((a, b) => a.width - b.width);
      return sorted[0];
    });
    const minSum = minVariants.reduce((sum, v) => sum + v.width, 0);
    if (minSum > availLength) {
      // Chiều dài tường quá nhỏ, không thể chứa đủ tất cả các khoang ngay cả ở kích thước nhỏ nhất
      return null;
    }

    // Ban đầu chọn biến thể mặc định (isDefault) hoặc biến thể tiêu chuẩn của mỗi khoang
    const chosen = modules.map((m) => {
      const sortedDesc = [...m.mod.variants].sort((a, b) => b.width - a.width);
      const defVar = m.mod.variants.find((v) => v.isDefault) || sortedDesc[0];
      const defIdx = sortedDesc.findIndex((v) => v.id === defVar.id);
      return {
        ...m,
        variant: defVar,
        allVariantsDesc: sortedDesc,
        varIdx: defIdx >= 0 ? defIdx : 0,
      };
    });

    let currentSum = chosen.reduce((sum, item) => sum + item.variant.width, 0);

    // Thứ tự ưu tiên giảm kích thước khoang khi không đủ không gian
    // Bảo vệ các khoang thiết bị và đệm an toàn nhiệt
    const shrinkPriority = ['T01', 'C01', 'R01', 'W01', 'P01', 'B01', 'S01', 'F01', 'SP01'];

    while (currentSum > availLength) {
      let shrank = false;

      // Tìm khoang theo thứ tự ưu tiên có thể giảm kích thước
      for (const targetCode of shrinkPriority) {
        const item = chosen.find(
          (c) => c.code === targetCode && c.varIdx < c.allVariantsDesc.length - 1
        );
        if (item) {
          // Bảo vệ khoảng cách an toàn: không giảm SP01 xuống dưới 300mm nếu các khoang khác vẫn có thể giảm
          const nextVar = item.allVariantsDesc[item.varIdx + 1];
          if (item.code === 'SP01' && nextVar.width < 300) {
            const hasOtherChoice = chosen.some(
              (c) => c.code !== 'SP01' && c.varIdx < c.allVariantsDesc.length - 1
            );
            if (hasOtherChoice) continue;
          }

          const oldW = item.variant.width;
          item.varIdx++;
          item.variant = item.allVariantsDesc[item.varIdx];
          currentSum -= oldW - item.variant.width;
          shrank = true;
          break;
        }
      }

      // Nếu không tìm thấy trong priority, tìm bất kỳ khoang nào còn có thể giảm
      if (!shrank) {
        const item = chosen.find((c) => c.varIdx < c.allVariantsDesc.length - 1);
        if (item) {
          const oldW = item.variant.width;
          item.varIdx++;
          item.variant = item.allVariantsDesc[item.varIdx];
          currentSum -= oldW - item.variant.width;
          shrank = true;
        } else {
          break; // Không thể giảm thêm
        }
      }
    }

    // Nếu còn dư không gian và có khoang T01: thử tăng T01 lên để lấp đầy mét dài
    const remaining = availLength - currentSum;
    if (remaining > 0) {
      const storageItem = chosen.find((c) => c.code === 'T01');
      if (storageItem) {
        for (let i = 0; i < storageItem.varIdx; i++) {
          const biggerVar = storageItem.allVariantsDesc[i];
          if (biggerVar.width - storageItem.variant.width <= remaining) {
            currentSum += biggerVar.width - storageItem.variant.width;
            storageItem.variant = biggerVar;
            storageItem.varIdx = i;
            break;
          }
        }
      }
    }

    return chosen.map(({ mod, code, name, cat, variant }) => ({
      mod,
      code,
      name,
      cat,
      variant: {
        id: variant.id,
        width: variant.width,
        depth: variant.depth,
        height: variant.height,
      },
    }));
  }

  // --- HÀNH TRÌNH TẠO BỐ TRÍ CHO BẾP CHỮ I ---
  private generateForShapeI(
    input: GenerationInput,
    mods: Record<string, KitchenModule | undefined>,
    results: LayoutPlanCandidate[]
  ) {
    const { edgeA } = input;
    const availLength = edgeA.length;

    const rawSelectedCodes =
      input.selectedModuleCodes && input.selectedModuleCodes.length > 0
        ? input.selectedModuleCodes
        : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01'];

    // Khoang góc nối chỉ được sinh ra khi làm bếp chữ L và chữ U. Bếp chữ I tuyệt đối không có khoang góc K01.
    const selectedCodes = rawSelectedCodes.filter((c) => c !== 'K01');

    // Tạo các tổ hợp chiến lược hợp lý
    const strategyConfigs: {
      id: string;
      title: string;
      order: string[];
      pros: string[];
      cons: string[];
    }[] = [];

    // 1. ƯU TIÊN SỐ 1: BẢO TOÀN THỨ TỰ KHOANG HIỆN TẠI NGƯỜI DÙNG ĐÃ BỐ TRÍ TRÊN CANVAS
    if (input.currentPlacedModules && input.currentPlacedModules.length > 0) {
      const currentEdgeModules = input.currentPlacedModules
        .filter((m) => m.edgeId === 'edge_A')
        .sort((a, b) => a.positionIndex - b.positionIndex);
      const currentCodes = currentEdgeModules.map((m) => m.code);
      if (currentCodes.length > 0) {
        strategyConfigs.push({
          id: 'strat-i-current',
          title: 'Phương án 1: Bố trí hiện tại tinh chỉnh kích thước vừa khít',
          order: currentCodes,
          pros: [
            'Bảo toàn 100% trật tự các khoang công năng bạn đã tinh chỉnh trên mặt bằng',
            'Tự động co giãn kích thước biến thể phù hợp với mét dài mới nhập',
          ],
          cons: ['Dựa trên bố trí hiện tại trên mặt bằng'],
        });
      }
    }

    strategyConfigs.push(
      {
        id: 'strat-i-opt1',
        title: 'Phương án chuẩn NKBA: Tủ lạnh mép trái ➔ Chậu rửa ➔ Bếp nấu ➔ Cụm tủ cao đối diện mép phải',
        order: ['F01', 'C01', 'W01', 'S01', 'D01', 'R01', 'B01', 'SP01', 'M01', 'T01', 'P01', 'A01'],
        pros: [
          'Tủ lạnh đặt ở mép ngoài cùng bên trái tiện tiếp cận thực phẩm',
          'Chậu rửa kẹp giữa bàn sơ chế và máy rửa bát theo chu trình liên hoàn',
          'Bếp nấu cách ly an toàn với chậu rửa và tủ cao',
          'Cụm tủ cao (tủ khô & thiết bị) kề nhau ở mép phải đối diện tạo thế đối trọng cân xứng',
        ],
        cons: ['Cần chiều dài mặt bằng tương ứng số khoang đã chọn'],
      },
      {
        id: 'strat-i-opt2',
        title: 'Phương án sơ chế trung tâm: Tủ lạnh ➔ Máy rửa bát ➔ Chậu ➔ Dao thớt ➔ Bếp ➔ Cụm tủ cao đối diện',
        order: ['F01', 'D01', 'W01', 'S01', 'C01', 'R01', 'B01', 'SP01', 'M01', 'T01', 'P01', 'A01'],
        pros: [
          'Chậu rửa kẹp giữa Máy rửa bát và Dao thớt',
          'Khoang dao thớt đóng vai trò bàn đệm sơ chế lớn ngay trước bếp nấu',
          'Cụm tủ cao ở mép phải đối diện hoàn toàn với tủ lạnh mép trái',
          'An toàn điện nước tuyệt đối',
        ],
        cons: ['Máy rửa bát đặt cạnh tủ lạnh'],
      },
      {
        id: 'strat-i-opt3',
        title: 'Phương án an toàn nhiệt: Tủ lạnh mép trái ➔ Bếp nấu ➔ Sơ chế ➔ Chậu rửa ➔ Cụm tủ cao đối diện',
        order: ['F01', 'SP01', 'B01', 'C01', 'W01', 'S01', 'D01', 'R01', 'M01', 'T01', 'P01', 'A01'],
        pros: [
          'Tủ lạnh mép trái và cụm tủ cao (tủ khô & thiết bị) ở mép phải đối diện',
          'Khoang máy rửa bát và chậu rửa đóng vai trò đệm an toàn giữa bếp nấu và tủ cao',
          'Mặt bàn bếp trải dài liền mạch',
        ],
        cons: ['Bếp nấu nằm gần phía tủ lạnh'],
      },
      {
        id: 'strat-i-opt4',
        title: 'Phương án đảo chiều: Cụm tủ cao mép trái ➔ Chậu & Bếp ➔ Tủ lạnh đối diện mép phải',
        order: ['P01', 'A01', 'T01', 'M01', 'D01', 'W01', 'S01', 'C01', 'R01', 'B01', 'SP01', 'F01'],
        pros: [
          'Thích hợp khi luồng di chuyển hoặc nguồn cấp điện nước ở phía phải',
          'Cụm tủ cao (P01 & A01) kề nhau ở mép trái, tủ lạnh đặt sát mép ngoài cùng bên phải',
          'Đối trọng thẩm mỹ cân đối hoàn hảo',
        ],
        cons: ['Đảo ngược vị trí tủ lạnh sang phải'],
      }
    );

    for (const strat of strategyConfigs) {
      // Lọc các khoang thực tế có trong selectedCodes theo thứ tự của chiến lược
      const activeModules: { mod: KitchenModule; code: string; name: string; cat: string }[] = [];
      for (const code of strat.order) {
        if (!selectedCodes.includes(code)) continue;
        const mod = this.findModuleByCode(code, mods);
        if (mod) {
          activeModules.push({
            mod,
            code: mod.code,
            name: mod.name,
            cat: mod.category,
          });
        }
      }

      // Điều chỉnh kích thước biến thể của các khoang để phù hợp tối ưu với mét dài
      const fitted = this.adjustVariantsToFit(activeModules, availLength);
      if (!fitted || fitted.length === 0) continue;

      const placed: PlacedModuleInstance[] = [];
      let currentOffset = 0;
      let pIdx = 0;

      for (const item of fitted) {
        placed.push({
          instanceId: `cand-${strat.id}-${item.code}-${pIdx}`,
          moduleId: item.mod.id,
          variantId: item.variant.id,
          code: item.code,
          name: item.name,
          category: item.cat as any,
          edgeId: 'edge_A',
          positionIndex: pIdx++,
          offset: currentOffset,
          width: item.variant.width,
          depth: item.variant.depth,
          height: item.variant.height,
          color: item.mod.color,
        });
        currentOffset += item.variant.width;
      }

      const totalFittedWidth = currentOffset;
      const finalRemain = Math.max(0, availLength - totalFittedWidth);

      const testLayout: KitchenLayout = {
        id: `layout-${strat.id}-${Date.now()}`,
        name: strat.title,
        shape: 'I',
        edgeA: { ...input.edgeA, id: 'edge_A', name: 'Cạnh A' },
        cornerConfig: { size: 600 },
        placedModules: placed,
        upperDepth: 350,
        upperHeight: 750,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      testLayout.placedUpperModules = this.generateUpperCabinetsForCandidate(
        testLayout,
        selectedCodes,
        input.catalog
      );

      const report = this.ruleEngine.evaluate(testLayout, input.catalog);
      if (report.hardValid) {
        results.push({
          id: `${strat.id}-${totalFittedWidth}`,
          title: strat.title,
          score: report.score,
          layout: testLayout,
          remainingWidths: {
            edge_A: finalRemain,
            edge_B: 0,
            edge_C: 0,
          },
          ruleSummary: {
            passedCount: report.passedCount,
            violationCount: report.failedCount,
            warningsCount: report.warningCount,
          },
          workTrianglePerimeter: report.workTriangle.perimeter,
          pros: strat.pros,
          cons: [
            ...strat.cons,
            finalRemain > 0
              ? `Kích thước dư cuối cạnh: ${finalRemain}mm (làm nẹp chỉ tường / filler)`
              : 'Khoang vừa khít chiều dài mặt bằng',
          ],
        });
      }
    }
  }

  // --- HÀNH TRÌNH TẠO BỐ TRÍ CHO BẾP CHỮ L ---
  private generateForShapeL(
    input: GenerationInput,
    mods: Record<string, KitchenModule | undefined>,
    results: LayoutPlanCandidate[]
  ) {
    const { edgeA, edgeB } = input;
    if (!edgeB) return;

    const depthA = edgeA.depth || 600;
    const depthB = edgeB.depth || 600;
    const cornerWidthBase = 1000;
    const cornerWidthUpper = 750;

    const selectedCodes =
      input.selectedModuleCodes && input.selectedModuleCodes.length > 0
        ? input.selectedModuleCodes
        : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01', 'K01'];

    const filterCodes = (codes: string[]) =>
      codes.filter((c) => selectedCodes.includes(c));

    // Chiến lược bếp chữ L:
    const strategies = [
      {
        id: 'strat-l-opt1',
        title: 'Phương án 1: Tam giác công năng chuẩn NKBA (Lưu trữ + Chậu Cạnh A | Bếp & Khối tủ cao Cạnh B)',
        assign: {
          edgeA: filterCodes(['W01', 'S01', 'D01', 'T01', 'F01']),
          edgeB: filterCodes(['C01', 'R01', 'B01', 'SP01', 'M01', 'T01', 'P01', 'A01']),
        },
        pros: [
          'Tam giác công năng cực kỳ lý tưởng',
          'Tủ lạnh ở rìa Cạnh A, khối tủ cao kề nhau (tủ khô & thiết bị) ở rìa Cạnh B tạo thế cân đối',
          'Bếp tách riêng khỏi chậu tạo không gian nấu thoáng',
        ],
        cons: ['Cạnh B cần đủ dài cho khoang bếp và khối tủ cao'],
      },
      {
        id: 'strat-l-opt2',
        title: 'Phương án 2: Bếp nấu & Khối tủ cao Cạnh A, Tủ lạnh & Chậu Cạnh B',
        assign: {
          edgeA: filterCodes(['C01', 'B01', 'SP01', 'R01', 'M01', 'T01', 'P01', 'A01']),
          edgeB: filterCodes(['W01', 'S01', 'D01', 'T01', 'F01']),
        },
        pros: [
          'Tủ lạnh tách biệt ở cuối Cạnh B, khối tủ cao kề nhau ở cuối Cạnh A',
          'Đạt đầy đủ tiêu chuẩn cách ly nhiệt độ và cân đối không gian',
        ],
        cons: ['Cạnh B cần đủ dài cho khoang chậu và tủ lạnh'],
      },
      {
        id: 'strat-l-opt3',
        title: 'Phương án 3: Bàn bếp Cạnh A, Toàn bộ khối tủ cao quy tụ Cạnh B',
        assign: {
          edgeA: filterCodes(['W01', 'S01', 'D01', 'C01', 'B01', 'SP01', 'M01', 'R01', 'T01']),
          edgeB: filterCodes(['T01', 'P01', 'A01', 'F01']),
        },
        pros: [
          'Khu vực nấu và chuẩn bị trải dài thoáng đãng trên Cạnh A',
          'Hệ tủ cao quy tụ ở rìa Cạnh B với tủ lạnh ở mép ngoài cùng',
        ],
        cons: ['Cạnh B cần đủ dài cho cụm 3 tủ cao'],
      },
    ];

    for (const strat of strategies) {
      const placed: PlacedModuleInstance[] = [];

      // Phân bổ cạnh A
      const edgeAMods: { mod: KitchenModule; code: string; name: string; cat: string }[] = [];
      for (const code of strat.assign.edgeA) {
        const mod = this.findModuleByCode(code, mods);
        if (mod) edgeAMods.push({ mod, code: mod.code, name: mod.name, cat: mod.category });
      }

      // Phân bổ cạnh B
      const edgeBMods: { mod: KitchenModule; code: string; name: string; cat: string }[] = [];
      for (const code of strat.assign.edgeB) {
        const mod = this.findModuleByCode(code, mods);
        if (mod) edgeBMods.push({ mod, code: mod.code, name: mod.name, cat: mod.category });
      }

      // ĐÁNH GIÁ ĐỊNH HƯỚNG QUAY LINH HOẠT CỦA KHOANG GÓC NỐI:
      // Khả năng 1: Góc quay về Cạnh A (A tốn cornerWidthBase, B tốn depthA)
      const availA_optA = edgeA.length - cornerWidthBase;
      const availB_optA = edgeB.length - depthA;

      // Khả năng 2: Góc quay về Cạnh B (A tốn depthB, B tốn cornerWidthBase)
      const availA_optB = edgeA.length - depthB;
      const availB_optB = edgeB.length - cornerWidthBase;

      // Tính tổng chiều rộng tối thiểu cần thiết cho các khoang công năng cốt lõi (B01, S01, SP01, C01)
      const calcMinTotal = (list: { mod: KitchenModule }[]) =>
        list.reduce((sum, item) => {
          const minW = item.mod.minWidth || Math.min(...item.mod.variants.map((v) => v.width));
          return sum + minW;
        }, 0);

      const minA = calcMinTotal(edgeAMods);
      const minB = calcMinTotal(edgeBMods);

      // Quy tắc định hướng:
      // 1. Ưu tiên đảm bảo bộ công năng tối thiểu (Bếp từ - Chậu rửa - Gia vị - Dao thớt)
      const canFitOptA = availA_optA >= minA && availB_optA >= minB;
      const canFitOptB = availA_optB >= minA && availB_optB >= minB;

      let chosenOrient: 'edge_A' | 'edge_B' = 'edge_A';
      if (canFitOptA && !canFitOptB) {
        chosenOrient = 'edge_A';
      } else if (!canFitOptA && canFitOptB) {
        chosenOrient = 'edge_B';
      } else if (canFitOptA && canFitOptB) {
        // 2. Nếu cả 2 đều đủ chỗ: cạnh nào còn dư diện tích chiều dài lớn hơn thì khoang góc sẽ quay về cạnh đó
        const remainCapacityA = edgeA.length - minA;
        const remainCapacityB = edgeB.length - minB;
        chosenOrient = remainCapacityA >= remainCapacityB ? 'edge_A' : 'edge_B';
      } else {
        // Cả 2 đều chật: ưu tiên quay về cạnh dài hơn
        chosenOrient = edgeA.length >= edgeB.length ? 'edge_A' : 'edge_B';
      }

      const availA = chosenOrient === 'edge_A' ? availA_optA : availA_optB;
      const availB = chosenOrient === 'edge_A' ? availB_optA : availB_optB;

      // Tự động điều chỉnh kích thước biến thể của các khoang để phù hợp với mét dài từng cạnh
      let fittedA = this.adjustVariantsToFit(edgeAMods, availA);
      let fittedB = this.adjustVariantsToFit(edgeBMods, availB);

      // Nếu cạnh A thiếu chỗ nhưng cạnh B còn dư: chuyển khoang phụ từ A sang B
      if (!fittedA && edgeAMods.length > 1) {
        const movable = edgeAMods.pop();
        if (movable) {
          edgeBMods.push(movable);
          fittedA = this.adjustVariantsToFit(edgeAMods, availA);
          fittedB = this.adjustVariantsToFit(edgeBMods, availB);
        }
      }

      // Nếu cạnh B thiếu chỗ nhưng cạnh A còn dư: chuyển khoang phụ từ B sang A
      if (!fittedB && edgeBMods.length > 1) {
        const movable = edgeBMods.pop();
        if (movable) {
          edgeAMods.push(movable);
          fittedA = this.adjustVariantsToFit(edgeAMods, availA);
          fittedB = this.adjustVariantsToFit(edgeBMods, availB);
        }
      }

      if (!fittedA || !fittedB) continue;

      let curOffsetA = chosenOrient === 'edge_A' ? cornerWidthBase : depthB;
      let pIdxA = 0;
      let sumA = 0;
      for (const item of fittedA) {
        placed.push({
          instanceId: `cand-${strat.id}-${item.code}-A-${pIdxA}`,
          moduleId: item.mod.id,
          variantId: item.variant.id,
          code: item.code,
          name: item.name,
          category: item.cat as any,
          edgeId: 'edge_A',
          positionIndex: pIdxA++,
          offset: curOffsetA,
          width: item.variant.width,
          depth: item.variant.depth,
          height: item.variant.height,
          color: item.mod.color,
        });
        curOffsetA += item.variant.width;
        sumA += item.variant.width;
      }

      let curOffsetB = chosenOrient === 'edge_B' ? cornerWidthBase : depthA;
      let pIdxB = 0;
      let sumB = 0;
      for (const item of fittedB) {
        placed.push({
          instanceId: `cand-${strat.id}-${item.code}-B-${pIdxB}`,
          moduleId: item.mod.id,
          variantId: item.variant.id,
          code: item.code,
          name: item.name,
          category: item.cat as any,
          edgeId: 'edge_B',
          positionIndex: pIdxB++,
          offset: curOffsetB,
          width: item.variant.width,
          depth: item.variant.depth,
          height: item.variant.height,
          color: item.mod.color,
        });
        curOffsetB += item.variant.width;
        sumB += item.variant.width;
      }

      const testLayout: KitchenLayout = {
        id: `layout-${strat.id}`,
        name: strat.title,
        shape: 'L',
        edgeA: { length: edgeA.length, depth: edgeA.depth, height: edgeA.height, id: 'edge_A', name: 'Cạnh A' },
        edgeB: { length: edgeB.length, depth: edgeB.depth, height: edgeB.height, id: 'edge_B', name: 'Cạnh B', angle: edgeB.angle || 90 },
        cornerConfig: { size: 600 },
        cornerOrientationAB: chosenOrient,
        cornerWidthBaseAB: cornerWidthBase,
        cornerWidthUpperAB: cornerWidthUpper,
        placedModules: placed,
        upperDepth: 350,
        upperHeight: 750,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      testLayout.placedUpperModules = this.generateUpperCabinetsForCandidate(
        testLayout,
        selectedCodes,
        input.catalog
      );

      const report = this.ruleEngine.evaluate(testLayout, input.catalog);
      if (report.hardValid) {
        results.push({
          id: strat.id,
          title: strat.title,
          score: report.score,
          layout: testLayout,
          remainingWidths: {
            edge_A: Math.max(0, availA - sumA),
            edge_B: Math.max(0, availB - sumB),
            edge_C: 0,
          },
          ruleSummary: {
            passedCount: report.passedCount,
            violationCount: report.failedCount,
            warningsCount: report.warningCount,
          },
          workTrianglePerimeter: report.workTriangle.perimeter,
          pros: strat.pros,
          cons: [
            ...strat.cons,
            `Dư cạnh A: ${availA - sumA}mm, cạnh B: ${availB - sumB}mm`,
          ],
        });
      }
    }
  }

  // --- HÀNH TRÌNH TẠO BỐ TRÍ CHO BẾP CHỮ U ---
  private generateForShapeU(
    input: GenerationInput,
    mods: Record<string, KitchenModule | undefined>,
    results: LayoutPlanCandidate[]
  ) {
    const { edgeA, edgeB, edgeC } = input;
    if (!edgeB || !edgeC) return;

    const depthA = edgeA.depth || 600;
    const depthB = edgeB.depth || 600;
    const depthC = edgeC.depth || 600;
    const cornerWidthBase = 1000;
    const cornerWidthUpper = 750;

    const selectedCodes =
      input.selectedModuleCodes && input.selectedModuleCodes.length > 0
        ? input.selectedModuleCodes
        : ['F01', 'S01', 'B01', 'D01', 'C01', 'SP01', 'K01'];

    const filterCodes = (codes: string[]) =>
      codes.filter((c) => selectedCodes.includes(c));

    // Bếp chữ U: Thiết kế các phương án công thái học chuẩn NKBA & Tam giác công năng
    // Phân bổ hợp lý: Tủ lạnh (F01) ở rìa Cạnh B, Chậu (S01) & Chuẩn bị (C01) ở Cạnh A, Bếp (B01) & Tủ cao (P01, A01) ở Cạnh C
    const strategies = [
      {
        id: 'strat-u-opt1',
        title: 'Phương án 1: Bếp chữ U chuẩn - Chậu giữa Cạnh A, Tủ lạnh Cạnh B, Bếp & Khối tủ cao Cạnh C',
        assign: {
          edgeB: filterCodes(['T01', 'F01']),
          edgeA: filterCodes(['W01', 'D01', 'S01', 'C01']),
          edgeC: filterCodes(['R01', 'B01', 'SP01', 'M01', 'T01', 'P01', 'A01']),
        },
        pros: [
          'Phân tách 3 trạm công năng vào 3 cạnh độc lập',
          'Tủ lạnh ở rìa Cạnh B cân đối hoàn hảo với khối tủ cao kề nhau ở rìa Cạnh C',
          'Đạt tỉ lệ tam giác công năng hoàn hảo nhất',
        ],
        cons: ['Cần Cạnh A đủ rộng (tối thiểu 3.0m - 3.4m) để chứa cả chậu và máy rửa bát'],
      },
      {
        id: 'strat-u-opt2',
        title: 'Phương án 2: Bếp chữ U tối ưu không gian - Máy rửa bát kề chậu sang Cạnh B, Bếp & Tủ cao Cạnh C',
        assign: {
          edgeB: filterCodes(['D01', 'T01', 'F01']),
          edgeA: filterCodes(['W01', 'S01', 'C01']),
          edgeC: filterCodes(['R01', 'B01', 'SP01', 'M01', 'T01', 'P01', 'A01']),
        },
        pros: [
          'Chậu rửa và khu sơ chế Cạnh A rộng rãi, máy rửa bát đặt cạnh góc Cạnh B cực kỳ thuận tiện',
          'Tủ lạnh ở rìa Cạnh B đối trọng cân đối với Khối tủ cao kề nhau ở rìa Cạnh C',
          'Phù hợp với hầu hết kích thước bếp chữ U thực tế (Cạnh A từ 2.4m - 3.0m)',
        ],
        cons: ['Máy rửa bát đặt sang cạnh bên vuông góc với chậu'],
      },
      {
        id: 'strat-u-opt3',
        title: 'Phương án 3: Bếp nấu ở giữa Cạnh A, Chậu & Máy rửa bát Cạnh B, Tủ lạnh & Khối tủ cao Cạnh C',
        assign: {
          edgeB: filterCodes(['W01', 'S01', 'D01', 'C01', 'T01']),
          edgeA: filterCodes(['B01', 'SP01', 'M01', 'T01']),
          edgeC: filterCodes(['R01', 'F01', 'P01', 'A01']),
        },
        pros: [
          'Khu vực nấu nướng là tâm điểm chú ý ở Cạnh A',
          'Chậu và máy rửa bát tập trung gọn gàng tại Cạnh B',
        ],
        cons: ['Cần ống hút mùi thoát thẳng hoặc chạy qua trần giả cạnh A'],
      },
      {
        id: 'strat-u-opt4',
        title: 'Phương án 4: Bếp chữ U phân bổ linh hoạt - Tủ lạnh Cạnh B, Chậu Cạnh A, Bếp Cạnh C',
        assign: {
          edgeB: filterCodes(['T01', 'D01', 'F01']),
          edgeA: filterCodes(['C01', 'S01', 'W01']),
          edgeC: filterCodes(['SP01', 'B01', 'M01', 'R01', 'P01', 'A01']),
        },
        pros: [
          'Tối ưu luồng di chuyển: Lưu trữ (B) -> Sơ chế (A) -> Nấu nướng (C)',
          'Khối tủ cao P01 + A01 kề nhau ngoài cùng mép Cạnh C',
        ],
        cons: ['Cần điều chỉnh linh hoạt theo kích thước thực tế'],
      },
    ];

    for (const strat of strategies) {
      const placed: PlacedModuleInstance[] = [];

      // Edge B
      const edgeBMods: { mod: KitchenModule; code: string; name: string; cat: string }[] = [];
      for (const code of strat.assign.edgeB) {
        const mod = this.findModuleByCode(code, mods);
        if (mod) edgeBMods.push({ mod, code: mod.code, name: mod.name, cat: mod.category });
      }

      // Edge A
      const edgeAMods: { mod: KitchenModule; code: string; name: string; cat: string }[] = [];
      for (const code of strat.assign.edgeA) {
        const mod = this.findModuleByCode(code, mods);
        if (mod) edgeAMods.push({ mod, code: mod.code, name: mod.name, cat: mod.category });
      }

      // Edge C
      const edgeCMods: { mod: KitchenModule; code: string; name: string; cat: string }[] = [];
      for (const code of strat.assign.edgeC) {
        const mod = this.findModuleByCode(code, mods);
        if (mod) edgeCMods.push({ mod, code: mod.code, name: mod.name, cat: mod.category });
      }

      // ĐÁNH GIÁ ĐỊNH HƯỚNG QUAY TỐI ƯU CỦA 2 GÓC NỐI (AB và AC):
      const calcMinTotal = (list: { mod: KitchenModule }[]) =>
        list.reduce((sum, item) => {
          const minW = item.mod.minWidth || Math.min(...item.mod.variants.map((v) => v.width));
          return sum + minW;
        }, 0);

      const minB = calcMinTotal(edgeBMods);
      const minA = calcMinTotal(edgeAMods);
      const minC = calcMinTotal(edgeCMods);

      // Thử 4 tổ hợp hướng quay cho AB và AC:
      const combos: { orientAB: 'edge_A' | 'edge_B'; orientAC: 'edge_A' | 'edge_C' }[] = [
        { orientAB: 'edge_B', orientAC: 'edge_C' }, // Tối đa hóa Cạnh A
        { orientAB: 'edge_A', orientAC: 'edge_C' },
        { orientAB: 'edge_B', orientAC: 'edge_A' },
        { orientAB: 'edge_A', orientAC: 'edge_A' },
      ];

      let bestCombo = combos[0];
      for (const c of combos) {
        const tAB_A = c.orientAB === 'edge_A' ? cornerWidthBase : depthB;
        const tAC_A = c.orientAC === 'edge_A' ? cornerWidthBase : depthC;
        const tAB_B = c.orientAB === 'edge_B' ? cornerWidthBase : depthA;
        const tAC_C = c.orientAC === 'edge_C' ? cornerWidthBase : depthA;

        const aA = edgeA.length - tAB_A - tAC_A;
        const aB = edgeB.length - tAB_B;
        const aC = edgeC.length - tAC_C;

        if (aA >= minA && aB >= minB && aC >= minC) {
          bestCombo = c;
          break;
        }
      }

      const takesAB_on_A = bestCombo.orientAB === 'edge_A' ? cornerWidthBase : depthB;
      const takesAC_on_A = bestCombo.orientAC === 'edge_A' ? cornerWidthBase : depthC;
      const takesAB_on_B = bestCombo.orientAB === 'edge_B' ? cornerWidthBase : depthA;
      const takesAC_on_C = bestCombo.orientAC === 'edge_C' ? cornerWidthBase : depthA;

      const availA = edgeA.length - takesAB_on_A - takesAC_on_A;
      const availB = edgeB.length - takesAB_on_B;
      const availC = edgeC.length - takesAC_on_C;

      // Tự động điều chỉnh kích thước biến thể để vừa với từng cạnh
      const fittedB = this.adjustVariantsToFit(edgeBMods, availB);
      const fittedA = this.adjustVariantsToFit(edgeAMods, availA);
      const fittedC = this.adjustVariantsToFit(edgeCMods, availC);

      if (!fittedB || !fittedA || !fittedC) continue;

      let curB = takesAB_on_B;
      let pIdxB = 0;
      let sumB = 0;
      for (const item of fittedB) {
        placed.push({
          instanceId: `cand-${strat.id}-${item.code}-B-${pIdxB}`,
          moduleId: item.mod.id,
          variantId: item.variant.id,
          code: item.code,
          name: item.name,
          category: item.cat as any,
          edgeId: 'edge_B',
          positionIndex: pIdxB++,
          offset: curB,
          width: item.variant.width,
          depth: item.variant.depth,
          height: item.variant.height,
          color: item.mod.color,
        });
        curB += item.variant.width;
        sumB += item.variant.width;
      }

      let curA = takesAB_on_A;
      let pIdxA = 0;
      let sumA = 0;
      for (const item of fittedA) {
        placed.push({
          instanceId: `cand-${strat.id}-${item.code}-A-${pIdxA}`,
          moduleId: item.mod.id,
          variantId: item.variant.id,
          code: item.code,
          name: item.name,
          category: item.cat as any,
          edgeId: 'edge_A',
          positionIndex: pIdxA++,
          offset: curA,
          width: item.variant.width,
          depth: item.variant.depth,
          height: item.variant.height,
          color: item.mod.color,
        });
        curA += item.variant.width;
        sumA += item.variant.width;
      }

      let curC = takesAC_on_C;
      let pIdxC = 0;
      let sumC = 0;
      for (const item of fittedC) {
        placed.push({
          instanceId: `cand-${strat.id}-${item.code}-C-${pIdxC}`,
          moduleId: item.mod.id,
          variantId: item.variant.id,
          code: item.code,
          name: item.name,
          category: item.cat as any,
          edgeId: 'edge_C',
          positionIndex: pIdxC++,
          offset: curC,
          width: item.variant.width,
          depth: item.variant.depth,
          height: item.variant.height,
          color: item.mod.color,
        });
        curC += item.variant.width;
        sumC += item.variant.width;
      }

      const testLayout: KitchenLayout = {
        id: `layout-${strat.id}`,
        name: strat.title,
        shape: 'U',
        edgeA: { length: edgeA.length, depth: edgeA.depth, height: edgeA.height, id: 'edge_A', name: 'Cạnh A' },
        edgeB: { length: edgeB.length, depth: edgeB.depth, height: edgeB.height, id: 'edge_B', name: 'Cạnh B', angle: edgeB.angle || 90 },
        edgeC: { length: edgeC.length, depth: edgeC.depth, height: edgeC.height, id: 'edge_C', name: 'Cạnh C', angle: edgeC.angle || 90 },
        cornerConfig: { size: 600 },
        cornerOrientationAB: bestCombo.orientAB,
        cornerOrientationAC: bestCombo.orientAC,
        cornerWidthBaseAB: cornerWidthBase,
        cornerWidthBaseAC: cornerWidthBase,
        cornerWidthUpperAB: cornerWidthUpper,
        cornerWidthUpperAC: cornerWidthUpper,
        placedModules: placed,
        upperDepth: 350,
        upperHeight: 750,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      testLayout.placedUpperModules = this.generateUpperCabinetsForCandidate(
        testLayout,
        selectedCodes,
        input.catalog
      );

      const report = this.ruleEngine.evaluate(testLayout, input.catalog);
      if (report.hardValid) {
        results.push({
          id: strat.id,
          title: strat.title,
          score: report.score,
          layout: testLayout,
          remainingWidths: {
            edge_A: Math.max(0, availA - sumA),
            edge_B: Math.max(0, availB - sumB),
            edge_C: Math.max(0, availC - sumC),
          },
          ruleSummary: {
            passedCount: report.passedCount,
            violationCount: report.failedCount,
            warningsCount: report.warningCount,
          },
          workTrianglePerimeter: report.workTriangle.perimeter,
          pros: strat.pros,
          cons: [
            ...strat.cons,
            `Dư: Cạnh A (${availA - sumA}mm), B (${availB - sumB}mm), C (${availC - sumC}mm)`,
          ],
        });
      }
    }
  }

  private findModuleByCode(
    code: string,
    mods: Record<string, KitchenModule | undefined>
  ): KitchenModule | undefined {
    if (code === 'F01') return mods.fridgeMod;
    if (code === 'S01') return mods.sinkMod;
    if (code === 'B01') return mods.cookMod;
    if (code === 'D01') return mods.dishMod;
    if (code === 'C01') return mods.cutleryMod;
    if (code === 'SP01') return mods.spiceMod;
    if (code === 'T01') return mods.storageMod;
    if (code === 'M01') return mods.ovenMod;
    if (code === 'R01') return mods.riceMod;
    if (code === 'W01') return mods.wasteMod;
    if (code === 'P01') return mods.tallPantryMod;
    if (code === 'A01') return mods.tallApplianceMod;
    return undefined;
  }

  /**
   * Public API để sinh tủ trên đồng bộ theo bố trí tủ dưới đã xác nhận
   */
  public generateUpperCabinets(
    layout: KitchenLayout,
    selectedCodes: string[] = [],
    catalog: KitchenModule[]
  ): PlacedModuleInstance[] {
    return this.generateUpperCabinetsForCandidate(layout, selectedCodes, catalog);
  }

  /**
   * Tự động sinh các khoang tủ trên tương thích và đồng bộ với tủ dưới:
   * - Hút mùi UH01 thẳng tim bếp nấu B01
   * - Giá bát cố định UB02 thẳng tim chậu rửa S01
   * - Giá bát nâng hạ UB01/UB03 nằm trên máy rửa bát D01 nếu có cả 2 giá bát
   * - Giá gia vị nâng hạ UG01/UG02 đặt cạnh bếp nấu
   * - Lấp đầy các khoảng còn lại bằng khoang để đồ UT01 <= 900mm
   */
  private generateUpperCabinetsForCandidate(
    layout: KitchenLayout,
    selectedCodes: string[],
    catalog: KitchenModule[]
  ): PlacedModuleInstance[] {
    // Nếu danh sách không có khoang tủ trên nào (đang ở giai đoạn thiết kế tủ dưới), không sinh tủ trên
    const hasAnyUpperCode = selectedCodes.some((c) => c.startsWith('U'));
    if (!hasAnyUpperCode) {
      return [];
    }

    const placedUpper: PlacedModuleInstance[] = [];

    const hasUH01 = selectedCodes.includes('UH01');
    const hasUB01 = selectedCodes.includes('UB01');
    const hasUB02 = selectedCodes.includes('UB02');
    const hasUB03 = selectedCodes.includes('UB03');
    const hasUG01 = selectedCodes.includes('UG01');
    const hasUG02 = selectedCodes.includes('UG02');
    const hasUT01 = selectedCodes.includes('UT01');

    const hasMultiDish = hasUB02 && (hasUB01 || hasUB03);
    const chosenPullDownCode = hasUB03 ? 'UB03' : hasUB01 ? 'UB01' : null;
    const defaultDishCode = hasUB02 ? 'UB02' : hasUB01 ? 'UB01' : hasUB03 ? 'UB03' : 'UB02';

    const hoodMod = catalog.find((m) => m.code === 'UH01');
    const dishFixedMod = catalog.find((m) => m.code === 'UB02');
    const dishManualMod = catalog.find((m) => m.code === 'UB01');
    const dishElectricMod = catalog.find((m) => m.code === 'UB03');
    const spiceManualMod = catalog.find((m) => m.code === 'UG01');
    const spiceElectricMod = catalog.find((m) => m.code === 'UG02');
    const storageMod = catalog.find((m) => m.code === 'UT01');

    const edges: EdgeId[] =
      layout.shape === 'I'
        ? ['edge_A']
        : layout.shape === 'L'
        ? ['edge_A', 'edge_B']
        : ['edge_A', 'edge_B', 'edge_C'];

    let upperIdx = 0;

    for (const edgeId of edges) {
      const baseOnEdge = layout.placedModules
        .filter((m) => m.edgeId === edgeId)
        .sort((a, b) => a.positionIndex - b.positionIndex);

      if (baseOnEdge.length === 0) continue;

      const edgeLength =
        edgeId === 'edge_A'
          ? layout.edgeA.length
          : edgeId === 'edge_B'
          ? layout.edgeB?.length || 2400
          : layout.edgeC?.length || 2400;

      const upperDepth = layout.upperDepth || 350;
      const orientAB = layout.cornerOrientationAB || 'edge_A';
      const wUpperAB = layout.cornerWidthUpperAB || 750;
      const orientAC = layout.cornerOrientationAC || 'edge_A';
      const wUpperAC = layout.cornerWidthUpperAC || 750;

      let startEdgeX = 0;
      let endEdgeX = edgeLength;

      if (layout.shape === 'L') {
        if (edgeId === 'edge_A') {
          startEdgeX = orientAB === 'edge_A' ? wUpperAB : upperDepth;
        } else if (edgeId === 'edge_B') {
          startEdgeX = orientAB === 'edge_B' ? wUpperAB : upperDepth;
        }
      } else if (layout.shape === 'U') {
        if (edgeId === 'edge_A') {
          startEdgeX = orientAB === 'edge_A' ? wUpperAB : upperDepth;
          endEdgeX = edgeLength - (orientAC === 'edge_A' ? wUpperAC : upperDepth);
        } else if (edgeId === 'edge_B') {
          startEdgeX = orientAB === 'edge_B' ? wUpperAB : upperDepth;
        } else if (edgeId === 'edge_C') {
          startEdgeX = orientAC === 'edge_C' ? wUpperAC : upperDepth;
        }
      }

      const cookOnEdge = baseOnEdge.find((m) => m.code === 'B01' || m.category === 'cooking');
      const sinkOnEdge = baseOnEdge.find((m) => m.code === 'S01' || m.category === 'sink');
      const dwOnEdge = baseOnEdge.find(
        (m) => m.code === 'D01' || (m.category === 'appliance' && m.name.toLowerCase().includes('rửa bát'))
      );

      // Xác định các khoang tủ cao ở tủ dưới (F01 Tủ lạnh, P01 Tủ đồ khô, A01 Tủ thiết bị)
      // Tủ trên CHỈ ĐƯỢC PHÉP thiết kế vào các khoảng trống, tuyệt đối không đặt đè lên tủ cao
      const tallUnitsOnEdge = baseOnEdge.filter((m) => {
        if (m.code === 'F01' || m.code === 'P01' || m.code === 'A01') return true;
        const catMod = catalog.find((c) => c.id === m.moduleId || c.code === m.code);
        return !!catMod?.metadata?.isTallUnit;
      });

      let openIntervals: { start: number; end: number }[] = [{ start: startEdgeX, end: endEdgeX }];

      for (const tall of tallUnitsOnEdge) {
        const tStart = tall.offset;
        const tEnd = tall.offset + tall.width;
        const nextIntervals: { start: number; end: number }[] = [];
        for (const inv of openIntervals) {
          if (tEnd <= inv.start || tStart >= inv.end) {
            nextIntervals.push(inv);
          } else {
            if (tStart > inv.start + 50) {
              nextIntervals.push({ start: inv.start, end: tStart });
            }
            if (tEnd + 50 < inv.end) {
              nextIntervals.push({ start: tEnd, end: inv.end });
            }
          }
        }
        openIntervals = nextIntervals;
      }

      interface Anchor {
        offset: number;
        width: number;
        mod: KitchenModule;
        code: string;
      }
      const anchors: Anchor[] = [];

      // 1. Khoang hút mùi thẳng tim bếp
      if (cookOnEdge && hoodMod && hasUH01) {
        const defaultHoodVar = hoodMod.variants.find((v) => v.isDefault) || hoodMod.variants[0];
        const hoodW = defaultHoodVar ? defaultHoodVar.width : 710;
        const cookCenter = cookOnEdge.offset + cookOnEdge.width / 2;
        const hoodOffset = Math.round(cookCenter - hoodW / 2);
        // Đảm bảo nằm trong khoảng mở
        anchors.push({
          offset: Math.max(startEdgeX, hoodOffset),
          width: hoodW,
          mod: hoodMod,
          code: 'UH01',
        });
      }

      // 2. Khoang giá bát
      if (sinkOnEdge && (hasUB01 || hasUB02 || hasUB03)) {
        const sinkCenter = sinkOnEdge.offset + sinkOnEdge.width / 2;
        if (hasMultiDish && dishFixedMod) {
          const dishW = sinkOnEdge.width >= 800 ? 800 : 700;
          anchors.push({
            offset: Math.round(sinkCenter - dishW / 2),
            width: dishW,
            mod: dishFixedMod,
            code: 'UB02',
          });

          if (dwOnEdge && chosenPullDownCode) {
            const pullMod = chosenPullDownCode === 'UB03' ? dishElectricMod : dishManualMod;
            if (pullMod) {
              const dwCenter = dwOnEdge.offset + dwOnEdge.width / 2;
              const pullW = 600;
              anchors.push({
                offset: Math.round(dwCenter - pullW / 2),
                width: pullW,
                mod: pullMod,
                code: chosenPullDownCode,
              });
            }
          }
        } else {
          const chosenMod =
            (defaultDishCode === 'UB01'
              ? dishManualMod
              : defaultDishCode === 'UB03'
              ? dishElectricMod
              : dishFixedMod) || dishFixedMod;
          if (chosenMod) {
            const dishW = sinkOnEdge.width >= 800 ? 800 : 700;
            anchors.push({
              offset: Math.round(sinkCenter - dishW / 2),
              width: dishW,
              mod: chosenMod,
              code: chosenMod.code,
            });
          }
        }
      }

      // Chỉ giữ các anchors không bị va chạm với tủ cao
      const validAnchors = anchors.filter((anc) => {
        const aStart = anc.offset;
        const aEnd = anc.offset + anc.width;
        // Kiểm tra xem có nằm trọn vẹn trong một khoảng mở nào không
        return openIntervals.some((inv) => aStart >= inv.start - 20 && aEnd <= inv.end + 20);
      });
      validAnchors.sort((a, b) => a.offset - b.offset);

      // Điền các khoảng trống xung quanh anchors trong từng openInterval bằng UT01 (hoặc UG01)
      const fillSegments: { offset: number; width: number }[] = [];

      for (const inv of openIntervals) {
        const anchorsInInv = validAnchors.filter(
          (anc) => anc.offset >= inv.start - 20 && anc.offset + anc.width <= inv.end + 20
        );

        let curX = inv.start;
        for (const anc of anchorsInInv) {
          if (anc.offset > curX + 50) {
            fillSegments.push({ offset: curX, width: anc.offset - curX });
          }
          curX = anc.offset + anc.width;
        }

        if (inv.end > curX + 50) {
          fillSegments.push({ offset: curX, width: inv.end - curX });
        }
      }

      for (const seg of fillSegments) {
        let segRemain = seg.width;
        let segOffset = seg.offset;

        // Bổ sung khoang gia vị nâng hạ nếu có chọn
        const spiceModToPlace = hasUG02 ? spiceElectricMod : hasUG01 ? spiceManualMod : null;
        if (
          spiceModToPlace &&
          !placedUpper.some((m) => m.code === spiceModToPlace.code) &&
          segRemain >= 600
        ) {
          placedUpper.push({
            instanceId: `upper-${edgeId}-${spiceModToPlace.code}-${upperIdx++}`,
            moduleId: spiceModToPlace.id,
            variantId: spiceModToPlace.variants[0]?.id || 'var-default',
            code: spiceModToPlace.code,
            name: spiceModToPlace.name,
            category: spiceModToPlace.category,
            tier: 'upper',
            edgeId,
            positionIndex: 0,
            offset: segOffset,
            width: 600,
            depth: 350,
            height: 750,
            color: spiceModToPlace.color,
          });
          segOffset += 600;
          segRemain -= 600;
        }

        // Lấp đầy các khoảng còn lại với UT01 <= 900mm nếu có chọn
        while (hasUT01 && segRemain >= 300) {
          let w = 600;
          if (segRemain >= 900) w = segRemain >= 1200 ? 600 : (segRemain <= 900 ? segRemain : 800);
          else if (segRemain >= 800) w = 800;
          else if (segRemain >= 700) w = 700;
          else if (segRemain >= 600) w = 600;
          else if (segRemain >= 500) w = 500;
          else if (segRemain >= 400) w = 400;
          else w = Math.min(350, segRemain);

          if (w > 900) w = 900;

          if (storageMod) {
            placedUpper.push({
              instanceId: `upper-${edgeId}-UT01-${upperIdx++}`,
              moduleId: storageMod.id,
              variantId: storageMod.variants[0]?.id || 'var-ut01-600',
              code: 'UT01',
              name: 'Khoang tủ chứa đồ tủ trên',
              category: 'storage',
              tier: 'upper',
              edgeId,
              positionIndex: 0,
              offset: segOffset,
              width: w,
              depth: 350,
              height: 750,
              color: storageMod.color,
            });
          }
          segOffset += w;
          segRemain -= w;
        }
      }

      // Đưa các anchors hợp lệ vào placedUpper
      for (const anc of validAnchors) {
        placedUpper.push({
          instanceId: `upper-${edgeId}-${anc.code}-${upperIdx++}`,
          moduleId: anc.mod.id,
          variantId: anc.mod.variants[0]?.id || 'var-default',
          code: anc.code,
          name: anc.mod.name,
          category: anc.mod.category,
          tier: 'upper',
          edgeId,
          positionIndex: 0,
          offset: anc.offset,
          width: anc.width,
          depth: 350,
          height: 750,
          color: anc.mod.color,
        });
      }
    }

    // Đánh lại positionIndex
    for (const edgeId of edges) {
      const onEdge = placedUpper
        .filter((m) => m.edgeId === edgeId)
        .sort((a, b) => a.offset - b.offset);
      onEdge.forEach((m, idx) => {
        m.positionIndex = idx;
      });
    }

    return placedUpper;
  }
}
