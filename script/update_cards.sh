#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897
REPO="Arshtyi/YuGiOh-Cards-Maker"
TMP_DIR="${BASE_DIR}/tmp"
TARGET_FIG_DIR="${BASE_DIR}/cfg/fig"
TARGET_JSON_DIR="${BASE_DIR}/cfg/json"
CARDS_FILES=("cards_0.tar.xz" "cards_1.tar.xz" "cards.json")
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "错误: 找不到命令 $1，请先安装"
        exit 1
    fi
}
check_command curl
check_command tar
TAG="latest"
PROCESSED_FILES=0
echo "创建并清空目标目录..."
mkdir -p "$TMP_DIR"
mkdir -p "$TARGET_FIG_DIR"
mkdir -p "$TARGET_JSON_DIR"
rm -rf "$TARGET_FIG_DIR"/*
rm -rf "$TARGET_JSON_DIR"/*
for FILE in "${CARDS_FILES[@]}"; do
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/$FILE"
    DOWNLOAD_PATH="$TMP_DIR/$FILE"
    echo "正在下载 $FILE..."
    echo "下载URL: $DOWNLOAD_URL"
    echo "保存路径: $DOWNLOAD_PATH"
    MAX_RETRIES=3
    RETRY_COUNT=0
    SUCCESS=false
    while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SUCCESS" = "false" ]; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "下载尝试 $RETRY_COUNT/$MAX_RETRIES..."
        curl -L -o "$DOWNLOAD_PATH" "$DOWNLOAD_URL"
        CURL_EXIT=$?
        if [ $CURL_EXIT -eq 0 ] && [ -f "$DOWNLOAD_PATH" ] && [ -s "$DOWNLOAD_PATH" ]; then
            echo "下载 $FILE 成功!"
            SUCCESS=true
        else
            echo "下载 $FILE 失败，退出代码: $CURL_EXIT"
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo "将在3秒后重试..."
                sleep 3
            fi
        fi
    done
    if [ "$SUCCESS" = "false" ]; then
        echo "错误: 多次尝试后仍无法下载 $FILE 或文件为空"
        exit 1
    fi
    if [[ "$FILE" == *.tar.xz ]]; then
        echo "正在解压 $FILE 到 $TARGET_FIG_DIR..."
        tar -xf "$DOWNLOAD_PATH" -C "$TARGET_FIG_DIR"
        if [ $? -ne 0 ]; then
            echo "错误: 解压 $FILE 失败"
            exit 1
        fi
    elif [[ "$FILE" == *.json ]]; then
        echo "正在移动 $FILE 到 $TARGET_JSON_DIR..."
        mv "$DOWNLOAD_PATH" "$TARGET_JSON_DIR/"
        if [ $? -ne 0 ]; then
            echo "错误: 移动 $FILE 到 $TARGET_JSON_DIR 失败"
            exit 1
        fi
    else
        echo "未知文件类型: $FILE，跳过处理"
        rm "$DOWNLOAD_PATH"
        continue
    fi
    if [[ "$FILE" != *.json ]]; then
        rm "$DOWNLOAD_PATH"
    fi
    PROCESSED_FILES=$((PROCESSED_FILES + 1))
    echo "成功处理文件: $FILE"
done
if [ $PROCESSED_FILES -eq 0 ]; then
    echo "错误: 没有成功处理任何文件"
    echo "请检查网络连接和代理设置"
    echo "请确认以下文件是否存在于最新release中:"
    for FILE in "${CARDS_FILES[@]}"; do
        echo "- $FILE"
    done
    exit 1
fi
rm -rf "$TMP_DIR"
IMAGE_COUNT=$(find "$TARGET_FIG_DIR" -type f -name "*.jpg" | wc -l)
JSON_EXISTS=$([ -f "$TARGET_JSON_DIR/cards.json" ] && echo "true" || echo "false")
echo "更新完成，成功处理 $PROCESSED_FILES 个文件"
echo "卡牌数据库已更新，包含 ${IMAGE_COUNT} 张卡图"
if [ "$JSON_EXISTS" = "true" ]; then
    echo "卡牌数据已保存到 $TARGET_JSON_DIR"
    if command -v jq &> /dev/null; then
        CARD_COUNT=$(jq 'length' "$TARGET_JSON_DIR/cards.json" 2>/dev/null || echo "未知")
        echo "卡牌信息数据库包含 ${CARD_COUNT} 条记录"
    else
        JSON_SIZE=$(du -h "$TARGET_JSON_DIR/cards.json" | cut -f1)
        echo "卡牌信息数据库大小: ${JSON_SIZE}"
    fi
fi

exit 0
