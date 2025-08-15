import { Context, Schema, segment, h } from "koishi";
import { update } from "./update/update";
import { randomPicture } from "./random/random";
import { queryCards, createCardMessage } from "./query/query";
import { listLimits } from "./limit/list";
import { advancedSearch } from "./query/advanced";
import { formatResponse, success, failure } from "./utils/response";
import { usage } from "./usage";

export const name = "ygo";
export { usage };
export interface Config {}
export const Config: Schema<Config> = Schema.object({});
export function apply(ctx: Context) {
    const cmd = ctx.command("ygo", "YuGiOh相关功能").usage(usage);
    let updateInProgress = false;
    let lastUpdateTime = 0;
    cmd.subcommand(".update", "更新卡牌数据库，请勿大量调用", {
        authority: 4,
    }).action(async ({ session }) => {
        try {
            if (updateInProgress) {
                return formatResponse(
                    failure(
                        "更新操作进行中",
                        "已有更新操作在进行中，请等待其完成"
                    )
                );
            }
            const now = Date.now();
            if (lastUpdateTime && now - lastUpdateTime < 30 * 60 * 1000) {
                const minutesAgo = Math.floor((now - lastUpdateTime) / 60000);
                return formatResponse(
                    failure(
                        "更新过于频繁",
                        `上次更新仅在${minutesAgo}分钟前，请至少间隔30分钟再次更新`
                    )
                );
            }
            updateInProgress = true;
            try {
                session.send("更新已开始，这可能需要几分钟时间...");
                const result = await update();
                lastUpdateTime = Date.now();
                return result;
            } finally {
                updateInProgress = false;
            }
        } catch (error) {
            console.error("更新卡牌时出错:", error);
            return formatResponse(
                failure("更新卡牌数据库失败", error.message || "未知错误")
            );
        }
    });
    cmd.subcommand(".random", "随机卡牌")
        .alias("随机一卡")
        .action(async ({ session }) => {
            try {
                const result = await randomPicture();
                return formatResponse(
                    success("随机卡牌", [
                        result.imageSegment,
                        `\n${result.cardInfo}`,
                    ])
                );
            } catch (error) {
                console.error("随机卡牌时出错:", error);
                return formatResponse(failure("随机卡牌失败", error.message));
            }
        });

    cmd.subcommand(".query <cardName:text>", "根据卡名查询卡牌")
        .alias("查卡")
        .example("ygo.query 青眼白龙 - 查询青眼白龙")
        .example("查卡 青眼白龙 - 使用别名查询青眼白龙")
        .example("ygo.query 10000040 - 查询ID为10000040的卡牌")
        .example("ygo.query 青眼白龙 黑魔术师 - 查询多张卡牌")
        .action(async ({ session }, cardName) => {
            if (!cardName) {
                return formatResponse(
                    failure("查询卡牌失败", "请提供卡片名称")
                );
            }
            try {
                const nameList = cardName.split(/\s+/);
                const results = await queryCards(nameList);
                if (results.length === 1) {
                    return formatResponse(
                        success("卡牌查询", createCardMessage(results[0]))
                    );
                } else {
                    const messages = [];
                    messages.push(
                        h("message", `查询到${results.length}张卡片：`)
                    );
                    for (const result of results) {
                        messages.push(
                            h("message", [
                                result.imageSegment,
                                `\n${result.cardInfo}`,
                            ])
                        );
                    }
                    return h("message", { forward: true }, messages);
                }
            } catch (error) {
                console.error("查询卡牌时出错:", error);
                return formatResponse(failure("查询卡牌失败", error.message));
            }
        });
    cmd.subcommand(".limit", "列出禁限表（OCG/TCG/MD）")
        .alias("禁卡表")
        .action(async () => {
            try {
                return await listLimits();
            } catch (err) {
                console.error("列出禁限表时出错:", err);
                return formatResponse(
                    failure("列出禁限表失败", (err as any).message)
                );
            }
        });

    cmd.subcommand(
        ".advanced <keyword:text>",
        "高级查卡：针对复杂页面结构收集所有匹配卡片"
    )
        .alias("高级查卡")
        .action(async ({ session }, keyword) => {
            if (!keyword)
                return formatResponse(failure("高级查卡失败", "请提供关键词"));
            try {
                return await advancedSearch(keyword);
            } catch (err) {
                console.error("高级查卡出错:", err);
                return formatResponse(
                    failure("高级查卡失败", (err as any).message || String(err))
                );
            }
        });
}
