import * as fs from "fs-extra";
import * as path from "path";
import { segment } from "koishi";
import { getCardInfo, formatCardInfo } from "../utils/card-info";
import { searchCardByKeyword } from "./search";

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
 * @param terms 卡名数组
 * @returns 所有卡片的查询结果
 */
export async function queryCards(terms: string[]): Promise<QueryCardResult[]> {
    const results: QueryCardResult[] = [];

    // 过滤出有效的查询条件（防止传入空参数）
    const validTerms = terms.filter((term) => term && term.trim());

    if (validTerms.length === 0) {
        throw new Error("请提供至少一个有效的卡片名称");
    }

    // 对每个查询条件进行处理
    for (const term of validTerms) {
        try {
            // 所有输入都作为卡名处理
            const result = await queryCardByKeyword(term);
            results.push(result);
        } catch (error) {
            console.error(`查询卡片 ${term} 出错:`, error);
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

/**
 * 根据关键词搜索卡片
 * @param keyword 搜索关键词
 * @returns 卡片查询结果
 */
export async function queryCardByKeyword(
    keyword: string
): Promise<QueryCardResult> {
    // 从 ygocdb.com 获取卡片ID
    const cardId = await searchCardByKeyword(keyword);

    if (!cardId) {
        throw new Error(`找不到匹配的卡片: ${keyword}`);
    }

    // 使用获取到的ID查询本地卡片
    return await queryCardById(cardId);
}
