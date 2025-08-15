import { formatResponse, success, failure } from "../utils/response";
import { segment } from "koishi";
import type { Element } from "koishi";
import * as fs from "fs-extra";
import * as path from "path";
import axios from "axios";
import { spawn } from "child_process";
import * as crypto from "crypto";
declare const process: {
    env: Record<string, string | undefined>;
    send?: (message: any) => void;
};
declare const __dirname: string;
const REPO = "Arshtyi/YuGiOh-Cards-Maker";
const TAG = "latest";
const DOWNLOAD_FILES = [
    "cards.json",
    "cards_0.tar.xz",
    "cards_0.tar.xz.sha256",
    "cards_1.tar.xz",
    "cards_1.tar.xz.sha256",
    "forbidden_and_limited_list.tar.xz",
    "forbidden_and_limited_list.tar.xz.sha256",
];
interface UpdateStats {
    processedFiles: number;
    imageCount: number;
    cardCount: string | number;
    timings: {
        total: number;
        downloads: Record<string, number>;
        extractions: Record<string, number>;
    };
    limitCounts?: {
        ocg?: { forbidden: number; limited: number; semiLimited: number };
        tcg?: { forbidden: number; limited: number; semiLimited: number };
        md?: { forbidden: number; limited: number; semiLimited: number };
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
        const cfgDir = path.join(baseDir, "cfg");
        const targetFigDir = path.join(cfgDir, "fig");
        const targetCardsDir = path.join(cfgDir, "cards");
        const targetLimitDir = path.join(cfgDir, "limit");
        console.log("准备目录结构...");
        await fs.ensureDir(tmpDir);
        await fs.ensureDir(cfgDir).then(() => fs.emptyDir(cfgDir));
        await Promise.all([
            fs.ensureDir(targetFigDir),
            fs.ensureDir(targetCardsDir),
            fs.ensureDir(targetLimitDir),
        ]);
        const proxyConfig = getProxyConfig();
        const stats = await downloadAndProcessFiles(
            DOWNLOAD_FILES,
            REPO,
            TAG,
            tmpDir,
            { fig: targetFigDir, cards: targetCardsDir, limit: targetLimitDir },
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
        for (const file of DOWNLOAD_FILES) {
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
        if (stats.limitCounts) {
            resultParts.push("禁限卡表统计:");
            const lc = stats.limitCounts;
            const fmt = (
                name: string,
                obj?: {
                    forbidden: number;
                    limited: number;
                    semiLimited: number;
                }
            ) => {
                if (!obj) return `- ${name}: 无数据`;
                return `- ${name}: 禁止 ${obj.forbidden}，限制 ${obj.limited}，准限制 ${obj.semiLimited}`;
            };
            resultParts.push(fmt("OCG", lc.ocg));
            resultParts.push(fmt("TCG", lc.tcg));
            resultParts.push(fmt("MD", lc.md));
        }
        resultParts.push(
            `源仓库: https://github.com/${REPO} ，发布 tag: ${TAG}`
        );
        const resultMessage = resultParts.join("\n");
        console.log(resultMessage);
        return formatResponse(success(resultMessage));
    } catch (error) {
        console.error("更新过程中发生错误:", error);
        return formatResponse(failure("更新失败", (error as any).message));
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
    targets: { fig: string; cards: string; limit: string },
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
                response.data.on("data", (chunk: Buffer) => {
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
                console.error(
                    `下载 ${file} 失败:`,
                    (error as any).message || error
                );
                if (retryCount < maxRetries) {
                    console.log("将于3秒后重试...");
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        }
        if (!success) {
            throw new Error(`多次尝试后仍无法下载 ${file} 或文件为空`);
        }
        processedFiles++;
    }

    await Promise.all([
        fs.emptyDir(targets.fig),
        fs.emptyDir(targets.cards),
        fs.emptyDir(targets.limit),
    ]);

    const verifySha256 = async (
        filePath: string,
        shaPath: string
    ): Promise<boolean> => {
        if (!(await fs.pathExists(shaPath))) {
            console.warn(
                `没有找到校验文件 ${path.basename(shaPath)}，跳过校验`
            );
            return false;
        }
        try {
            const shaContent = (await fs.readFile(shaPath, "utf8")).trim();
            const m = shaContent.match(/([a-fA-F0-9]{64})/);
            const expected = m
                ? m[1].toLowerCase()
                : shaContent.split(/\s+/)[0].toLowerCase();
            const hash = crypto.createHash("sha256");
            await new Promise<void>((resolve, reject) => {
                const rs = fs.createReadStream(filePath);
                rs.on("data", (chunk) => hash.update(chunk));
                rs.on("end", () => resolve());
                rs.on("error", (err) => reject(err));
            });
            const actual = hash.digest("hex");
            if (actual === expected) {
                console.log(`${path.basename(filePath)} 的 sha256 校验通过`);
                return true;
            } else {
                throw new Error(
                    `sha256 校验失败: 期望 ${expected}，实际 ${actual}`
                );
            }
        } catch (err) {
            console.error(
                `校验 ${path.basename(filePath)} 时出错:`,
                (err as any).message || err
            );
            throw err;
        }
    };

    const cardsJsonTmp = path.join(tmpDir, "cards.json");
    if (await fs.pathExists(cardsJsonTmp)) {
        console.log("正在移动 cards.json 到 cfg/cards/ ...");
        await fs.move(cardsJsonTmp, path.join(targets.cards, "cards.json"), {
            overwrite: true,
        });
    } else {
        console.warn("未找到下载的 cards.json");
    }

    const tarFiles = [
        { name: "cards_0.tar.xz", target: targets.fig },
        { name: "cards_1.tar.xz", target: targets.fig },
        { name: "forbidden_and_limited_list.tar.xz", target: targets.limit },
    ];

    for (const t of tarFiles) {
        const tmpTar = path.join(tmpDir, t.name);
        if (!(await fs.pathExists(tmpTar))) {
            console.warn(`未找到 ${t.name}，跳过`);
            continue;
        }
        const shaFile = `${t.name}.sha256`;
        const tmpSha = path.join(tmpDir, shaFile);
        try {
            await verifySha256(tmpTar, tmpSha);
        } catch (err) {
            throw new Error(`校验失败: ${t.name} - ${(err as any).message}`);
        }

        console.log(`正在解压 ${t.name} 到 ${t.target} ...`);
        const extractStart = Date.now();
        const heartbeatInterval = setInterval(() => {
            if (process.send)
                process.send({
                    type: "heartbeat",
                    message: `解压中: ${t.name}`,
                });
            console.log(`仍在解压 ${t.name} ...`);
        }, 30000);
        try {
            await extractTarXz(tmpTar, t.target);
            timings.extractions[t.name] = Date.now() - extractStart;
            console.log(
                `解压 ${t.name} 完成，用时 ${formatDuration(
                    timings.extractions[t.name]
                )}`
            );
        } finally {
            clearInterval(heartbeatInterval);
        }
        await fs.remove(tmpTar);
        if (await fs.pathExists(tmpSha)) await fs.remove(tmpSha);
    }

    const imageCount = await countImagesInDirectory(targets.fig);
    const cardDetails = await getCardDetails(
        path.join(targets.cards, "cards.json")
    );

    const limitCounts: UpdateStats["limitCounts"] = {};
    const limitFiles = [
        {
            key: "ocg",
            file: path.join(path.dirname(targets.fig), "limit", "ocg.json"),
        },
        {
            key: "tcg",
            file: path.join(path.dirname(targets.fig), "limit", "tcg.json"),
        },
        {
            key: "md",
            file: path.join(path.dirname(targets.fig), "limit", "md.json"),
        },
    ];
    for (const lf of limitFiles) {
        try {
            if (await fs.pathExists(lf.file)) {
                const data = await fs.readJSON(lf.file);
                const forbidden = Array.isArray(data.forbidden)
                    ? data.forbidden.length
                    : 0;
                const limited = Array.isArray(data.limited)
                    ? data.limited.length
                    : 0;
                const semi = Array.isArray(data["semi-limited"])
                    ? data["semi-limited"].length
                    : 0;
                (limitCounts as any)[lf.key] = {
                    forbidden,
                    limited,
                    semiLimited: semi,
                };
            } else {
                (limitCounts as any)[lf.key] = {
                    forbidden: 0,
                    limited: 0,
                    semiLimited: 0,
                };
            }
        } catch (err) {
            console.error(
                `读取限制表 ${lf.file} 时出错:`,
                (err as any).message || err
            );
            (limitCounts as any)[lf.key] = {
                forbidden: 0,
                limited: 0,
                semiLimited: 0,
            };
        }
    }

    return {
        processedFiles,
        imageCount,
        cardCount: cardDetails.count,
        timings: timings,
        limitCounts,
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
                reject(new Error(`解压过程超时，可能已卡死，已强制终止`));
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
                reject(new Error(`解压失败，退出码: ${code}`));
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
        const exts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
        const seen = new Set<string>();
        let count = 0;
        async function walk(p: string) {
            const entries = await fs.readdir(p);
            for (const entry of entries) {
                const full = path.join(p, entry);
                let stat;
                try {
                    stat = await fs.stat(full);
                } catch (e) {
                    continue;
                }
                if (stat.isDirectory()) {
                    await walk(full);
                } else if (stat.isFile()) {
                    const ext = path.extname(entry).toLowerCase();
                    if (!exts.has(ext)) continue;
                    let real;
                    try {
                        real = await fs.realpath(full);
                    } catch (e) {
                        real = full;
                    }
                    if (!seen.has(real)) {
                        seen.add(real);
                        count++;
                    }
                }
            }
        }
        if (!(await fs.pathExists(dir))) return 0;
        await walk(dir);
        return count;
    } catch (error) {
        console.error("计算图片数量时出错:", error);
        return 0;
    }
}

async function getCardDetails(
    jsonFilePath: string
): Promise<{ count: number | string }> {
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

export async function update(): Promise<
    string | Element | Array<string | ReturnType<typeof segment.image>>
> {
    try {
        const updatePromise = updateImplementation();
        console.log("开始更新，这可能需要几分钟时间...");
        const updateWithMonitoring = async () => {
            const startTime = Date.now();
            const updateProcess = await updatePromise;
            const totalTime = Date.now() - startTime;
            console.log(`更新完成，总耗时: ${totalTime / 1000}秒`);
            return updateProcess;
        };
        return await updateWithMonitoring();
    } catch (error) {
        if ((error as any).name === "TimeoutError") {
            console.error("更新操作超时，但可能仍在后台进行:", error);
            return formatResponse(
                failure(
                    "更新操作超时",
                    "操作耗时过长，但更新可能仍在后台进行.请稍后检查数据库状态."
                )
            );
        }
        console.error("更新过程中发生错误:", error);
        return formatResponse(
            failure("更新失败", (error as any).message || "未知错误")
        );
    }
}
