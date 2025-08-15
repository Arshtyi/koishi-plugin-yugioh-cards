import * as fs from "fs-extra";
import * as path from "path";
import { h } from "koishi";
import { segment } from "koishi";
import { getCardNameById } from "../utils/card-info";

async function readLimitJson(limitDir: string, env: string) {
    const file = path.join(limitDir, `${env}.json`);
    if (!(await fs.pathExists(file))) return null;
    const data = await fs.readJSON(file);
    return data;
}

function formatListEntries(ids: number[] | undefined) {
    if (!ids || ids.length === 0) return "（无）";
    const parts: string[] = [];
    for (const id of ids) {
        try {
            const name = getCardNameById(String(id));
            parts.push(`${name || "未知名称"} (${id})`);
        } catch (e) {
            parts.push(`未知名称 (${id})`);
        }
        if (parts.length >= 1000) break; // 防止消息过长
    }
    return parts.join("\n");
}

export async function listLimits() {
    const base = path.join(__dirname, "../../cfg/limit");
    const envs = ["ocg", "tcg", "md"];
    const messages: any[] = [];

    for (const env of envs) {
        const data = await readLimitJson(base, env);
        if (!data) {
            messages.push(h("message", `${env.toUpperCase()}: 无数据`));
            continue;
        }
        const forbiddenArr: number[] = data.forbidden || [];
        const limitedArr: number[] = data.limited || [];
        const semiArr: number[] = data["semi-limited"] || [];
        messages.push(
            h(
                "message",
                `${env.toUpperCase()}: 禁止 ${forbiddenArr.length}，限制 ${
                    limitedArr.length
                }，准限制 ${semiArr.length}`
            )
        );

        if (forbiddenArr.length === 0) {
            messages.push(h("message", `${env.toUpperCase()} 禁止：\n（无）`));
        } else {
            messages.push(
                h(
                    "message",
                    `${env.toUpperCase()} 禁止：\n${formatListEntries(
                        forbiddenArr
                    )}`
                )
            );
        }

        if (limitedArr.length === 0) {
            messages.push(h("message", `${env.toUpperCase()} 限制：\n（无）`));
        } else {
            messages.push(
                h(
                    "message",
                    `${env.toUpperCase()} 限制：\n${formatListEntries(
                        limitedArr
                    )}`
                )
            );
        }

        if (semiArr.length === 0) {
            messages.push(
                h("message", `${env.toUpperCase()} 准限制：\n（无）`)
            );
        } else {
            messages.push(
                h(
                    "message",
                    `${env.toUpperCase()} 准限制：\n${formatListEntries(
                        semiArr
                    )}`
                )
            );
        }
    }

    return h("message", { forward: true }, messages);
}

export default listLimits;
