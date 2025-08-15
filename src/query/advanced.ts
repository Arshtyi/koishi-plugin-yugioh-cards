import { h } from "koishi";
import { segment } from "koishi";
import { searchAllByKeyword } from "./search";
import { queryCardById } from "./query";

/**
 * 高级查卡：尝试多个 XPath 位置以收集所有匹配的卡片 ID，并返回合并的转发消息
 * @param keyword 搜索关键词
 */
export async function advancedSearch(keyword: string) {
    const ids = await searchAllByKeyword(keyword);
    const messages: any[] = [];
    console.log(
        `高级查卡: 关键词 "${keyword}" 返回 ${ids.length} 个 id: ${ids.join(
            ", "
        )}`
    );
    if (!ids || ids.length === 0) {
        messages.push(h("message", `查询到 0 张卡片`));
        return h("message", { forward: true }, messages);
    }
    messages.push(h("message", `查询到 ${ids.length} 张卡片：`));
    for (const id of ids) {
        try {
            const res = await queryCardById(id);
            messages.push(
                h("message", [res.imageSegment, `\n${res.cardInfo}`])
            );
        } catch (e) {
            console.warn(`高级查卡处理 ${id} 失败:`, e);
        }
    }
    return h("message", { forward: true }, messages);
}
