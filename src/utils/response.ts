import { segment } from "koishi";
export interface PluginResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}
export function success<T>(message: string, data?: T): PluginResponse<T> {
    return {
        success: true,
        message,
        data,
    };
}
export function failure(message: string, error?: string): PluginResponse {
    return {
        success: false,
        message,
        error,
    };
}
export function formatResponse(
    response: PluginResponse
):
    | string
    | ReturnType<typeof segment.image>
    | Array<string | ReturnType<typeof segment.image>> {
    if (!response.success) {
        return `${response.message}${
            response.error ? `\n错误详情: ${response.error}` : ""
        }`;
    }

    // 处理数组类型的数据
    if (Array.isArray(response.data)) {
        return response.data;
    }

    if (
        response.data &&
        typeof response.data === "object" &&
        "type" in response.data
    ) {
        return response.data;
    }
    if (response.data && typeof response.data === "string") {
        return response.data;
    }
    return response.message;
}
