import { exec } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import { promisify } from "util";
import { formatResponse, success, failure } from "../utils/response";
import { Element, segment } from "koishi";
const execPromise = promisify(exec);
export async function update(): Promise<
    string | Element | Array<string | ReturnType<typeof segment.image>>
> {
    try {
        const scriptPath = path.join(__dirname, "../../script/update_cards.sh");
        if (!(await fs.pathExists(scriptPath))) {
            console.error("更新脚本不存在:", scriptPath);
            return formatResponse(failure("更新失败", "更新脚本不存在"));
        }
        try {
            await fs.chmod(scriptPath, 0o755);
        } catch (error) {
            console.warn("无法设置脚本执行权限:", error);
            // 继续执行，因为可能已经有执行权限
        }
        const { stdout, stderr } = await execPromise(`bash ${scriptPath}`);
        const successInStdout =
            stdout.includes("更新完成") || stdout.includes("成功处理");
        const hasCurlProgress =
            stderr.includes("% Total") &&
            stderr.includes("% Received") &&
            stderr.includes("Dload");
        const hasRealError =
            stderr.includes("错误:") ||
            stderr.includes("失败") ||
            stderr.includes("Error");
        if (!successInStdout && hasRealError) {
            console.error("更新脚本执行出错");
            const limitedError =
                stderr.length > 500
                    ? stderr.substring(0, 500) + "...(错误信息过长，已截断)"
                    : stderr;
            return formatResponse(failure("更新失败", limitedError));
        }
        if (hasCurlProgress && !hasRealError) {
            // curl下载进度信息不作为错误处理
        }
        const match = stdout.match(/更新完成，成功处理\s+(\d+)\s+个文件/);
        const oldFormatMatch =
            !match && stdout.match(/更新完成，共处理了\s+(\d+)\s+个文件/);
        const timestampMatch =
            !match &&
            !oldFormatMatch &&
            stdout.match(
                /\[完成\].*?更新完成，(成功|共)处理(了)?\s+(\d+)\s+个文件/
            );
        const count = match
            ? match[1]
            : oldFormatMatch
            ? oldFormatMatch[1]
            : timestampMatch
            ? timestampMatch[3]
            : "未知数量的";

        const newImageCountMatch = stdout.match(
            /卡牌数据库已更新，包含\s+(\d+)\s+张卡图/
        );
        const oldImageCountMatch = stdout.match(/图片总数:\s+(\d+)\s+张/);
        const imageCount = newImageCountMatch
            ? newImageCountMatch[1]
            : oldImageCountMatch
            ? oldImageCountMatch[1]
            : null;

        const cardInfoMatch = stdout.match(
            /卡牌信息数据库包含\s+(\d+)\s+条记录/
        );
        const cardInfoCount = cardInfoMatch ? cardInfoMatch[1] : null;

        let resultMessage = `更新完成，共处理了 ${count} 个文件`;

        if (imageCount) {
            resultMessage += `，包含 ${imageCount} 张卡图`;
        }

        if (cardInfoCount && cardInfoCount !== "未知") {
            resultMessage += `，卡牌信息数据库有 ${cardInfoCount} 条记录`;
        }

        console.log(resultMessage);
        return formatResponse(success(resultMessage));
    } catch (error) {
        console.error("更新过程中发生错误:", error);
        return formatResponse(failure("更新失败", error.message));
    }
}
