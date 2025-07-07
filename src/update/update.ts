import { formatResponse, success, failure } from "../utils/response";
import { Element, segment } from "koishi";
import { updateImplementation } from "./updateImplementation";

export async function update(): Promise<
    string | Element | Array<string | ReturnType<typeof segment.image>>
> {
    try {
        return await updateImplementation();
    } catch (error) {
        console.error("更新过程中发生错误:", error);
        return formatResponse(failure("更新失败", error.message));
    }
}
