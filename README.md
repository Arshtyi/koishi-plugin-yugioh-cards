# koishi-plugin-yugioh-cards

[![npm](https://img.shields.io/npm/v/koishi-plugin-yugioh-cards?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-yugioh-cards)

## 命令说明

-   `ygo.random` 或 `随机一卡` - 随机抽取一张游戏王卡牌并显示。随机抽取的卡片包含图片和详细信息。
-   `ygo.query <cardIds>` 或 `查卡 <cardIds>` - 根据 ID 查询卡牌，支持查询多张卡牌（用空格分隔多个 ID）。
-   `ygo.update` - 更新卡牌数据库（需要管理员权限）。此命令会从仓库下载最新的卡片数据和图片。供简单易用的游戏王卡片查询功能，包括随机抽卡、根据 ID 查询卡片等功能。
-   暂时没有办法根据卡名查询，因为没有数据

## 数据来源

本插件的卡片数据和图片来源于 [YuGiOh-Cards-Maker](https://github.com/Arshtyi/YuGiOh-Cards-Maker) 仓库。

## 权限说明

-   更新卡牌数据库需要管理员权限（authority: 4）。
-   随机卡牌和查询卡牌功能所有用户可用。
