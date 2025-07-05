import * as fs from "fs-extra";
import * as path from "path";
import { segment } from "koishi";
import { getCardInfo, formatCardInfo } from "../utils/card-info";

export interface RandomCardResult {
    imagePath: string;
    imageSegment: ReturnType<typeof segment.image>;
    cardId: string;
    cardInfo: string;
}
export async function randomPicture(): Promise<RandomCardResult> {
    const pictureDir = path.join(__dirname, "../../cfg/fig");
    if (await fs.pathExists(pictureDir)) {
        try {
            const stats = await fs.stat(pictureDir);
            if (!stats.isDirectory()) {
                throw new Error(`${pictureDir} 不是一个目录`);
            }
            return await getRandomImageFromDir(pictureDir);
        } catch (error) {
            console.error(`在图片目录中读取图片出错: ${error.message}`);
            throw new Error(
                "读取卡片图片出错，请先使用 ygo.update 命令更新卡牌数据"
            );
        }
    } else {
        console.error(`目录 ${pictureDir} 不存在`);
        throw new Error(
            "卡片图片目录不存在，请先使用 ygo.update 命令更新卡牌数据"
        );
    }
}
async function getRandomImageFromDir(dir: string): Promise<RandomCardResult> {
    const files = await fs.readdir(dir);
    const imageFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ext === ".jpg";
    });
    if (imageFiles.length === 0) {
        throw new Error(
            "卡片图片目录中没有图片，请先使用 ygo.update 命令更新卡牌数据"
        );
    }
    const randomIndex = Math.floor(Math.random() * imageFiles.length);
    const randomImage = imageFiles[randomIndex];
    const imagePath = path.join(dir, randomImage);
    const cardId = path.basename(randomImage, ".jpg");
    const cardInfoObj = await getCardInfo(cardId);
    const cardInfo = formatCardInfo(cardInfoObj);
    const imageSegment = segment.image(imagePath);
    return {
        imagePath,
        imageSegment,
        cardId,
        cardInfo,
    };
}
