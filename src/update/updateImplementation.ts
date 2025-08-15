import * as fs from "fs-extra";
import * as path from "path";
import axios from "axios";
import { spawn } from "child_process";
import { formatResponse, success, failure } from "../utils/response";
import { Element, segment } from "koishi";
declare const process: {
    env: Record<string, string | undefined>;
    send?: (message: any) => void;
};
declare const __dirname: string;

const REPO = "Arshtyi/YuGiOh-Cards-Maker";
const TAG = "latest";
const CARDS_FILES = ["cards_0.tar.xz", "cards_1.tar.xz", "cards.json"];
interface UpdateStats {
    processedFiles: number;
    imageCount: number;
    cardCount: string | number;
    timings: {
        total: number;
        downloads: Record<string, number>;
        extractions: Record<string, number>;
    };
}
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}毫秒`;
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const parts = [];
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);
    return parts.join("");
}
export async function updateImplementation(): Promise<
    string | Element | Array<string | ReturnType<typeof segment.image>>
> {
    try {
        const startTime = Date.now();
        const baseDir = path.resolve(__dirname, "../..");
        const tmpDir = path.join(baseDir, "tmp");
        const targetFigDir = path.join(baseDir, "cfg/fig");
        const targetJsonDir = path.join(baseDir, "cfg/json");
        console.log("准备目录结构...");
        await Promise.all([
            fs.ensureDir(tmpDir),
            fs.ensureDir(targetFigDir).then(() => fs.emptyDir(targetFigDir)),
            fs.ensureDir(targetJsonDir).then(() => fs.emptyDir(targetJsonDir)),
        ]);
        const proxyConfig = getProxyConfig();
        const stats = await downloadAndProcessFiles(
            CARDS_FILES,
            REPO,
            TAG,
            tmpDir,
            targetFigDir,
            targetJsonDir,
            proxyConfig
        );
        await fs.remove(tmpDir);
        const totalTime = Date.now() - startTime;
        stats.timings.total = totalTime;
        const resultParts = [
            `更新完成，共处理了 ${stats.processedFiles} 个文件` +
                (stats.imageCount ? `，包含 ${stats.imageCount} 张卡图` : "") +
                (stats.cardCount && stats.cardCount !== "未知"
                    ? `，卡牌信息数据库有 ${stats.cardCount} 条记录`
                    : ""),
            `总用时: ${formatDuration(stats.timings.total)}`,
            "文件处理详情:",
        ];
        for (const file of CARDS_FILES) {
            const details = [];
            if (stats.timings.downloads[file]) {
                details.push(
                    `下载用时 ${formatDuration(stats.timings.downloads[file])}`
                );
            }
            if (stats.timings.extractions[file]) {
                details.push(
                    `解压用时 ${formatDuration(
                        stats.timings.extractions[file]
                    )}`
                );
            }
            resultParts.push(`- ${file}: ${details.join(", ")}`);
        }
        const resultMessage = resultParts.join("\n");
        console.log(resultMessage);
        return formatResponse(success(resultMessage));
    } catch (error) {
        console.error("更新过程中发生错误:", error);
        return formatResponse(failure("更新失败", error.message));
    }
}
function getProxyConfig() {
    return {
        httpProxy: process.env.http_proxy || process.env.HTTP_PROXY,
        httpsProxy: process.env.https_proxy || process.env.HTTPS_PROXY,
        allProxy: process.env.all_proxy || process.env.ALL_PROXY,
    };
}
async function downloadAndProcessFiles(
    files: string[],
    repo: string,
    tag: string,
    tmpDir: string,
    targetFigDir: string,
    targetJsonDir: string,
    proxyConfig: { httpProxy?: string; httpsProxy?: string; allProxy?: string }
): Promise<UpdateStats> {
    let processedFiles = 0;
    const timings = {
        total: 0,
        downloads: {} as Record<string, number>,
        extractions: {} as Record<string, number>,
    };

    for (const file of files) {
        const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${file}`;
        const downloadPath = path.join(tmpDir, file);
        console.log(`正在下载 ${file}... (URL: ${downloadUrl})`);
        let success = false;
        const maxRetries = 3;
        const downloadStartTime = Date.now();
        for (
            let retryCount = 1;
            retryCount <= maxRetries && !success;
            retryCount++
        ) {
            console.log(`下载尝试 ${retryCount}/${maxRetries}...`);
            try {
                const response = await axios({
                    method: "get",
                    url: downloadUrl,
                    responseType: "stream",
                    proxy: proxyConfig.httpsProxy
                        ? {
                              host: new URL(proxyConfig.httpsProxy).hostname,
                              port: Number(
                                  new URL(proxyConfig.httpsProxy).port
                              ),
                              protocol: new URL(
                                  proxyConfig.httpsProxy
                              ).protocol.replace(":", ""),
                          }
                        : undefined,
                });
                const writer = fs.createWriteStream(downloadPath);
                let bytesReceived = 0;
                const totalBytes = parseInt(
                    response.headers["content-length"] || "0"
                );
                let lastReportedProgress = 0;
                response.data.on("data", (chunk) => {
                    bytesReceived += chunk.length;
                    if (totalBytes > 0) {
                        const progress = Math.floor(
                            (bytesReceived / totalBytes) * 100
                        );
                        if (progress >= lastReportedProgress + 20) {
                            lastReportedProgress =
                                Math.floor(progress / 20) * 20;
                            const progressMsg = `下载中: ${file} ${lastReportedProgress}%`;
                            console.log(progressMsg);
                            if (process.send) {
                                process.send({
                                    type: "heartbeat",
                                    message: progressMsg,
                                });
                            }
                        }
                    }
                });
                response.data.pipe(writer);
                await new Promise<void>((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });
                const fileStats = await fs.stat(downloadPath);
                if (fileStats.size > 0) {
                    timings.downloads[file] = Date.now() - downloadStartTime;
                    console.log(
                        `下载 ${file} 成功! 用时: ${formatDuration(
                            timings.downloads[file]
                        )}`
                    );
                    success = true;
                } else {
                    throw new Error("下载的文件大小为0");
                }
            } catch (error) {
                console.error(`下载 ${file} 失败:`, error.message);
                if (retryCount < maxRetries) {
                    console.log("将在3秒后重试...");
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        }
        if (!success) {
            throw new Error(`多次尝试后仍无法下载 ${file} 或文件为空`);
        }

        if (file.endsWith(".tar.xz")) {
            console.log(`正在解压 ${file} 到 ${targetFigDir}...`);
            const extractStartTime = Date.now();
            const progressMsg = `解压中: ${file}`;
            const heartbeatInterval = setInterval(() => {
                if (process.send) {
                    process.send({ type: "heartbeat", message: progressMsg });
                }
                console.log(`仍在解压 ${file}，请耐心等待...`);
            }, 30000);

            try {
                await extractTarXz(downloadPath, targetFigDir);
                timings.extractions[file] = Date.now() - extractStartTime;
                console.log(
                    `解压 ${file} 完成! 用时: ${formatDuration(
                        timings.extractions[file]
                    )}`
                );
            } finally {
                clearInterval(heartbeatInterval);
            }
        } else if (file.endsWith(".json")) {
            console.log(`正在移动 ${file} 到 ${targetJsonDir}...`);
            await fs.move(downloadPath, path.join(targetJsonDir, file), {
                overwrite: true,
            });
        } else {
            console.log(`未知文件类型: ${file}，跳过处理`);
            await fs.remove(downloadPath);
            continue;
        }
        if (!file.endsWith(".json")) {
            await fs.remove(downloadPath);
        }
        processedFiles++;
        console.log(`成功处理文件: ${file}`);
    }

    if (processedFiles === 0) {
        throw new Error(
            `没有成功处理任何文件.请检查网络连接和代理设置，并确认以下文件是否存在于最新release中: ${files.join(
                ", "
            )}`
        );
    }
    const imageCount = await countImagesInDirectory(targetFigDir);
    const cardDetails = await getCardDetails(
        path.join(targetJsonDir, "cards.json")
    );

    return {
        processedFiles,
        imageCount,
        cardCount: cardDetails.count,
        timings: timings,
    };
}
async function extractTarXz(
    filePath: string,
    targetDir: string
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const tar = spawn("nice", [
            "-n",
            "19",
            "tar",
            "-xf",
            filePath,
            "-C",
            targetDir,
            "--checkpoint=5000",
            "--checkpoint-action=echo='处理 %u 个文件...'",
        ]);
        let lastProgressOutput = Date.now();
        const MIN_PROGRESS_INTERVAL = 5000;
        const handleOutput = (source: string) => (data: Buffer) => {
            const now = Date.now();
            if (now - lastProgressOutput > MIN_PROGRESS_INTERVAL) {
                console.log(`解压进度${source}: ${data.toString().trim()}`);
                lastProgressOutput = now;
            }
        };

        tar.stdout.on("data", handleOutput(""));
        tar.stderr.on("data", handleOutput(" (stderr)"));
        let lastActivity = Date.now();
        const activityCheck = setInterval(() => {
            const inactiveTime = Date.now() - lastActivity;
            if (inactiveTime > 300000) {
                clearInterval(activityCheck);
                tar.kill("SIGKILL");
                reject(
                    new Error(`解压过程超过5分钟无活动，可能已卡死，已强制终止`)
                );
            }
        }, 30000);
        const updateActivity = () => {
            lastActivity = Date.now();
        };

        tar.on("close", (code) => {
            clearInterval(activityCheck);
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`解压失败，退出代码: ${code}`));
            }
        });
        tar.on("error", (err) => {
            clearInterval(activityCheck);
            reject(new Error(`解压时发生错误: ${err.message}`));
        });
        tar.stdout.on("data", updateActivity);
        tar.stderr.on("data", updateActivity);
    });
}
async function countImagesInDirectory(dir: string): Promise<number> {
    try {
        return await new Promise<number>((resolve, reject) => {
            const find = spawn("find", [
                dir,
                "-type",
                "f",
                "(",
                "-name",
                "*.jpg",
                "-o",
                "-name",
                "*.jpeg",
                ")",
            ]);

            let output = "";
            find.stdout.on("data", (data) => {
                output += data.toString();
            });

            find.on("close", (code) => {
                if (code === 0) {
                    const count = output.split("\n").filter(Boolean).length;
                    resolve(count);
                } else {
                    reject(new Error(`查找图片失败，退出代码: ${code}`));
                }
            });

            find.on("error", (err) => {
                reject(new Error(`查找图片时发生错误: ${err.message}`));
            });
        });
    } catch (error) {
        console.error("计算图片数量时出错:", error);
        return 0;
    }
}
async function getCardDetails(jsonFilePath: string): Promise<{
    count: number | string;
}> {
    try {
        if (await fs.pathExists(jsonFilePath)) {
            const data = await fs.readJSON(jsonFilePath);
            let count: number | string = "未知";
            if (Array.isArray(data)) {
                count = data.length;
            } else if (typeof data === "object" && data !== null) {
                count = Object.keys(data).length;
            }

            return { count };
        }
        return { count: "未知" };
    } catch (error) {
        console.error("获取卡牌数据时出错:", error);
        return { count: "未知" };
    }
}
