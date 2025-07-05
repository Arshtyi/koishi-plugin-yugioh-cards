import * as fs from "fs-extra";
import * as path from "path";
import { segment } from "koishi";
import { getCardInfo, formatCardInfo } from "../utils/card-info";

export interface QueryCardResult {
    imagePath: string;
    imageSegment: ReturnType<typeof segment.image>;
    cardId: string;
    cardInfo: string;
}

/**
 * 根据卡片ID查询卡片
 * @param cardId 卡片ID
 * @returns 卡片查询结果
 */
export async function queryCardById(cardId: string): Promise<QueryCardResult> {
    const pictureDir = path.join(__dirname, "../../cfg/fig");
    const imagePath = path.join(pictureDir, `${cardId}.jpg`);

    // 检查图片是否存在
    if (!(await fs.pathExists(imagePath))) {
        throw new Error(`卡片图片不存在: ${cardId}`);
    }

    // 获取卡片信息
    const cardInfoObj = await getCardInfo(cardId);
    if (!cardInfoObj) {
        throw new Error(`无法获取卡片信息: ${cardId}`);
    }

    const cardInfo = formatCardInfo(cardInfoObj);
    const imageSegment = segment.image(imagePath);

    return {
        imagePath,
        imageSegment,
        cardId,
        cardInfo,
    };
}

/**
 * 查询多张卡片并生成结果
 * @param cardIds 卡片ID数组
 * @returns 所有卡片的查询结果
 */
export async function queryCards(
    cardIds: string[]
): Promise<QueryCardResult[]> {
    const results: QueryCardResult[] = [];

    // 过滤出有效的卡片ID（防止传入空参数）
    const validCardIds = cardIds.filter((id) => id && id.trim());

    if (validCardIds.length === 0) {
        throw new Error("请提供至少一个有效的卡片ID");
    }

    // 对每个卡片ID进行查询
    for (const cardId of validCardIds) {
        try {
            const result = await queryCardById(cardId);
            results.push(result);
        } catch (error) {
            console.error(`查询卡片 ${cardId} 出错:`, error);
            // 继续处理其他卡片，不中断整个过程
        }
    }

    if (results.length === 0) {
        throw new Error("未能查询到任何有效卡片");
    }

    return results;
}

/**
 * 创建包含图片和信息的消息内容
 * @param result 卡片查询结果
 * @returns 消息内容
 */
export function createCardMessage(
    result: QueryCardResult
): Array<string | ReturnType<typeof segment.image>> {
    return [result.imageSegment, `\n${result.cardInfo}`];
}
