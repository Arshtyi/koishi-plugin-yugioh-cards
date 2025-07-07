import axios from "axios";

/**
 * 根据关键词从ygocdb.com搜索卡片ID
 * @param keyword 搜索关键词
 * @returns 搜索到的卡片ID或null
 */
export async function searchCardByKeyword(
    keyword: string
): Promise<string | null> {
    try {
        const url = `https://ygocdb.com/?search=${encodeURIComponent(keyword)}`;
        const headers = {
            "user-agent": "nonebot-plugin-ygo",
            referer: "https://ygocdb.com/",
        };
        console.log(`正在搜索卡片: ${keyword}, URL: ${url}`);
        const response = await axios.get(url, { headers });
        const html = response.data;
        const regex = /<h3[^>]*>.*?<span[^>]*>(\d+)<\/span>/gs;
        let cardId: string | null = null;
        const matches = html.match(regex);
        if (matches && matches.length > 0) {
            const idMatch = /<span[^>]*>(\d+)<\/span>/.exec(matches[0]);
            if (idMatch && idMatch[1]) {
                cardId = idMatch[1];
            }
        }
        if (!cardId) {
            console.log(`未找到匹配的卡片ID: ${keyword}`);
            return null;
        }
        console.log(`找到卡片ID: ${cardId}`);
        return cardId;
    } catch (error) {
        console.error(`搜索卡片出错:`, error);
        return null;
    }
}
