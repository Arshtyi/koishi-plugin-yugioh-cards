import { Context, Schema, segment, h } from "koishi";
import { update } from "./update/update";
import { randomPicture } from "./random/random";
import { queryCards, createCardMessage } from "./query/query";
import { formatResponse, success, failure } from "./utils/response";
import { usage } from "./usage";
export const name = "ygo";
export { usage };
export interface Config {}
export const Config: Schema<Config> = Schema.object({});
export function apply(ctx: Context) {
    const cmd = ctx.command("ygo", "YuGiOh相关功能").usage(usage);
    cmd.subcommand(".update", "更新卡牌数据库，请勿大量调用", {
        authority: 4,
    }).action(async ({ session }) => {
        try {
            return await update();
        } catch (error) {
            console.error("更新卡牌时出错:", error);
            return formatResponse(failure("更新卡牌数据库失败", error.message));
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

    cmd.subcommand(".query <cardIds:text>", "根据ID查询卡牌")
        .alias("查卡")
        .example("ygo.query 10000040 - 查询ID为10000040的卡牌")
        .example("查卡 10000040 - 使用别名查询卡牌")
        .example("ygo.query 10000040 10000080 - 查询多张卡牌")
        .action(async ({ session }, cardIds) => {
            if (!cardIds) {
                return formatResponse(failure("查询卡牌失败", "请提供卡片ID"));
            }
            try {
                const idList = cardIds.split(/\s+/);
                const results = await queryCards(idList);
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
}
