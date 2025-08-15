import * as fs from "fs-extra";
import * as path from "path";

interface CardInfo {
    name: string;
    id: number;
    description: string;
    cardType: "monster" | "spell" | "trap";
    frameType: string;
    attribute: string;
    limit?: { ocg?: string | null; tcg?: string | null; md?: string | null };
    atk?: number;
    def?: number;
    level?: number;
    race?: string;
    scale?: number;
    pendulumDescription?: string;
    linkVal?: number;
    linkMarkers?: string[];
    typeline?: string;
    cardImage?: string;
}

/**
 * 获取卡片数据
 * @param cardId 卡片ID
 * @returns 卡片数据或null
 */
export async function getCardInfo(cardId: string): Promise<CardInfo | null> {
    try {
        const jsonPath = path.join(__dirname, "../../cfg/cards/cards.json");
        if (!(await fs.pathExists(jsonPath))) {
            console.error("卡片数据文件不存在");
            return null;
        }
        const cardsData = await fs.readJSON(jsonPath);
        const strId = cardId.toString();
        if (cardsData[strId]) {
            const card = cardsData[strId];
            let normalizedLimit:
                | {
                      ocg?: string | null;
                      tcg?: string | null;
                      md?: string | null;
                  }
                | undefined;
            if (Array.isArray(card.limit)) {
                normalizedLimit = {};
                for (const item of card.limit) {
                    if (item && typeof item === "object") {
                        if (Object.prototype.hasOwnProperty.call(item, "ocg"))
                            normalizedLimit.ocg = item.ocg as any;
                        if (Object.prototype.hasOwnProperty.call(item, "tcg"))
                            normalizedLimit.tcg = item.tcg as any;
                        if (Object.prototype.hasOwnProperty.call(item, "md"))
                            normalizedLimit.md = item.md as any;
                    }
                }
            }
            const result = { ...card, id: parseInt(strId, 10) } as CardInfo;
            if (normalizedLimit) result.limit = normalizedLimit;
            return result;
        } else {
            return null;
        }
    } catch (error) {
        console.error("读取卡片数据出错:", error);
        return null;
    }
}

/**
 * 格式化卡片信息为可读文本
 * @param cardInfo 卡片信息
 * @returns 格式化后的文本
 */
export function formatCardInfo(cardInfo: CardInfo | null): string {
    if (!cardInfo) {
        return "无法获取卡片信息";
    }
    let result = `卡名： ${cardInfo.name}\nID: ${cardInfo.id}\n`;
    const isMonster = cardInfo.cardType === "monster";
    const isSpell = cardInfo.cardType === "spell";
    const isTrap = cardInfo.cardType === "trap";
    const isLink = cardInfo.frameType === "link";
    const isPendulum = cardInfo.frameType?.includes("pendulum");
    const isToken = cardInfo.frameType === "token";
    const isXyz = cardInfo.frameType?.includes("xyz");
    const isSynchro = cardInfo.frameType?.includes("synchro");
    const isFusion = cardInfo.frameType?.includes("fusion");
    const isRitual = cardInfo.frameType?.includes("ritual");
    if (isMonster) {
        const cleanTypeline = cardInfo.typeline
            .replace(/^【/, "")
            .replace(/】$/, "");
        result += `类型: ${cleanTypeline}\n`;
    } else if (isSpell) {
        const spellType = cardInfo.race || "normal";
        const spellTypeMap: Record<string, string> = {
            normal: "通常",
            continuous: "永续",
            equip: "装备",
            "quick-play": "速攻",
            field: "场地",
            ritual: "仪式",
        };
        const typeStr = spellTypeMap[spellType.toLowerCase()] || spellType;
        result += `类型: ${typeStr}魔法\n`;
    } else if (isTrap) {
        const trapType = cardInfo.race || "normal";
        const trapTypeMap: Record<string, string> = {
            normal: "通常",
            continuous: "永续",
            counter: "反击",
        };
        const typeStr = trapTypeMap[trapType.toLowerCase()] || trapType;
        result += `类型: ${typeStr}陷阱\n`;
    }
    if (isMonster) {
        if (cardInfo.attribute) {
            const translatedAttr = translateAttribute(cardInfo.attribute);
            result += `属性: ${translatedAttr}\n`;
        }
        if (cardInfo.race) {
            result += `种族: ${cardInfo.race}\n`;
        }
        if (isXyz && cardInfo.level) {
            result += `阶级: ${
                cardInfo.level === -1 ? "不确定" : cardInfo.level
            }\n`;
        } else if (!isLink && cardInfo.level) {
            result += `等级: ${
                cardInfo.level === -1 ? "不确定" : cardInfo.level
            }\n`;
        }
        if (isPendulum && cardInfo.scale !== undefined) {
            result += `灵摆刻度: ${
                cardInfo.scale === -1 ? "不确定" : cardInfo.scale
            }\n`;
        }
        if (isLink) {
            if (cardInfo.linkVal) {
                result += `连接值: ${cardInfo.linkVal}\n`;
            }
            if (cardInfo.linkMarkers && cardInfo.linkMarkers.length > 0) {
                result += `连接标记: ${cardInfo.linkMarkers
                    .map((m) => translateLinkMarker(m))
                    .join(", ")}\n`;
            }
        }
        if (cardInfo.atk !== undefined) {
            result += `攻击力: ${cardInfo.atk === -1 ? "?" : cardInfo.atk}\n`;
        }
        if (!isLink && cardInfo.def !== undefined) {
            result += `守备力: ${cardInfo.def === -1 ? "?" : cardInfo.def}\n`;
        }
    }
    if (cardInfo.description) {
        result += `情报:\n${cardInfo.description}`;
    }
    if (isPendulum && cardInfo.pendulumDescription) {
        result += `\n灵摆效果:\n${cardInfo.pendulumDescription}`;
    }
    if (cardInfo.limit) {
        const mapLimit = (v: string | null | undefined) => {
            if (v === null || v === undefined) return "无限制";
            const s = String(v).toLowerCase();
            if (s === "forbidden" || s === "forbidden") return "禁止";
            if (s === "limited" || s === "limit") return "限制";
            if (s === "semi-limited" || s === "semi" || s === "semi-limited")
                return "准限制";
            return String(v);
        };
        result += `\n\n禁限信息:\nOCG: ${mapLimit(
            cardInfo.limit.ocg
        )}\nTCG: ${mapLimit(cardInfo.limit.tcg)}\nMD: ${mapLimit(
            cardInfo.limit.md
        )}`;
    }
    return result;
}

let _cardsCache: Record<string, any> | null = null;
function ensureCardsCache() {
    if (_cardsCache) return;
    try {
        const jsonPath = path.join(__dirname, "../../cfg/cards/cards.json");
        if (fs.pathExistsSync(jsonPath)) {
            _cardsCache = fs.readJSONSync(jsonPath) as Record<string, any>;
        } else {
            _cardsCache = {};
        }
    } catch (e) {
        _cardsCache = {};
    }
}

export function getCardNameById(cardId: string): string | null {
    ensureCardsCache();
    const str = String(cardId);
    if (!_cardsCache) return null;
    const card = (_cardsCache as any)[str];
    if (!card) return null;
    return card.name || null;
}

/**
 * 翻译属性
 */
function translateAttribute(attribute: string): string {
    const chineseAttributes = ["地", "水", "炎", "风", "光", "暗", "神"];
    if (chineseAttributes.includes(attribute)) {
        return attribute;
    }
    const attributeMap: Record<string, string> = {
        EARTH: "地",
        WATER: "水",
        FIRE: "炎",
        WIND: "风",
        LIGHT: "光",
        DARK: "暗",
        DIVINE: "神",
        earth: "地",
        water: "水",
        fire: "炎",
        wind: "风",
        light: "光",
        dark: "暗",
        divine: "神",
    };
    return attributeMap[attribute] || attribute;
}

/**
 * 翻译连接标记
 */
function translateLinkMarker(marker: string): string {
    const chineseMarkers = [
        "上",
        "下",
        "左",
        "右",
        "左上",
        "右上",
        "左下",
        "右下",
    ];
    const markerMap: Record<string, string> = {
        Top: "上",
        Bottom: "下",
        Left: "左",
        Right: "右",
        "Top-Left": "左上",
        "Top-Right": "右上",
        "Bottom-Left": "左下",
        "Bottom-Right": "右下",
        top: "上",
        bottom: "下",
        left: "左",
        right: "右",
        "top-left": "左上",
        "top-right": "右上",
        "bottom-left": "左下",
        "bottom-right": "右下",
    };
    return markerMap[marker] || marker;
}
