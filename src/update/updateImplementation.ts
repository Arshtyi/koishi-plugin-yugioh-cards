import * as fs from "fs-extra";
import * as path from "path";
import axios from "axios";
import { spawn } from "child_process";
import { formatResponse, success, failure } from "../utils/response";
import { Element, segment } from "koishi";
const REPO = "Arshtyi/YuGiOh-Cards-Maker";
const TAG = "latest";
const CARDS_FILES = ["cards_0.tar.xz", "cards_1.tar.xz", "cards.json"];
interface UpdateStats {
    processedFiles: number;
    imageCount: number;
    cardCount: string | number;
}
export async function updateImplementation(): Promise<
    string | Element | Array<string | ReturnType<typeof segment.image>>
> {
    try {
        const baseDir = path.resolve(__dirname, "../..");
        const tmpDir = path.join(baseDir, "tmp");
        const targetFigDir = path.join(baseDir, "cfg/fig");
        const targetJsonDir = path.join(baseDir, "cfg/json");
        console.log("创建并清空目标目录...");
        await fs.ensureDir(tmpDir);
        await fs.ensureDir(targetFigDir);
        await fs.ensureDir(targetJsonDir);
        await fs.emptyDir(targetFigDir);
        await fs.emptyDir(targetJsonDir);
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
        let resultMessage = `更新完成，共处理了 ${stats.processedFiles} 个文件`;
        if (stats.imageCount) {
            resultMessage += `，包含 ${stats.imageCount} 张卡图`;
        }
        if (stats.cardCount && stats.cardCount !== "未知") {
            resultMessage += `，卡牌信息数据库有 ${stats.cardCount} 条记录`;
        }
        console.log(resultMessage);
        return formatResponse(success(resultMessage));
    } catch (error) {
        console.error("更新过程中发生错误:", error);
        return formatResponse(failure("更新失败", error.message));
    }
}

function getProxyConfig() {
    const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY;
    const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY;
    const allProxy = process.env.all_proxy || process.env.ALL_PROXY;
    return {
        httpProxy,
        httpsProxy,
        allProxy,
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

    for (const file of files) {
        const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${file}`;
        const downloadPath = path.join(tmpDir, file);

        console.log(`正在下载 ${file}...`);
        console.log(`下载URL: ${downloadUrl}`);
        console.log(`保存路径: ${downloadPath}`);

        let success = false;
        const maxRetries = 3;

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
                response.data.pipe(writer);
                await new Promise<void>((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });
                const fileStats = await fs.stat(downloadPath);
                if (fileStats.size > 0) {
                    console.log(`下载 ${file} 成功!`);
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
            await extractTarXz(downloadPath, targetFigDir);
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
            `没有成功处理任何文件。请检查网络连接和代理设置，并确认以下文件是否存在于最新release中: ${files.join(
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
    };
}
async function extractTarXz(
    filePath: string,
    targetDir: string
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const tar = spawn("tar", ["-xf", filePath, "-C", targetDir]);
        tar.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`解压失败，退出代码: ${code}`));
            }
        });
        tar.on("error", (err) => {
            reject(new Error(`解压时发生错误: ${err.message}`));
        });
    });
}

async function countImagesInDirectory(dir: string): Promise<number> {
    try {
        const result = await new Promise<number>((resolve, reject) => {
            const find = spawn("find", [
                dir,
                "-type",
                "f",
                "-name",
                "*.jpg",
                "-o",
                "-name",
                "*.jpeg",
            ]);
            let output = "";
            find.stdout.on("data", (data) => {
                output += data.toString();
            });
            find.on("close", (code) => {
                if (code === 0) {
                    const count = output
                        .split("\n")
                        .filter((line) => line.trim()).length;
                    resolve(count);
                } else {
                    reject(new Error(`查找图片失败，退出代码: ${code}`));
                }
            });
            find.on("error", (err) => {
                reject(new Error(`查找图片时发生错误: ${err.message}`));
            });
        });
        return result;
    } catch (error) {
        console.error("计算图片数量时出错:", error);
        return 0;
    }
}

async function getCardCount(jsonFilePath: string): Promise<number | string> {
    try {
        if (await fs.pathExists(jsonFilePath)) {
            const data = await fs.readJSON(jsonFilePath);
            if (Array.isArray(data)) {
                return data.length;
            } else if (typeof data === "object" && data !== null) {
                return Object.keys(data).length;
            }
            return "未知";
        }
        return "未知";
    } catch (error) {
        console.error("获取卡牌数量时出错:", error);
        return "未知";
    }
}

async function getCardDetails(jsonFilePath: string): Promise<{
    count: number | string;
}> {
    try {
        if (await fs.pathExists(jsonFilePath)) {
            const data = await fs.readJSON(jsonFilePath);
            if (Array.isArray(data)) {
                return {
                    count: data.length,
                };
            } else if (typeof data === "object" && data !== null) {
                // 对象格式，例如 {"10000": {...}, "10001": {...}}
                const keys = Object.keys(data);
                return {
                    count: keys.length,
                };
            }
            return { count: "未知" };
        }
        return { count: "未知" };
    } catch (error) {
        console.error("获取卡牌详情时出错:", error);
        return { count: "未知" };
    }
}
