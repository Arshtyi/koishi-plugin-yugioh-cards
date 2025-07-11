/**
 * 插件使用说明
 */
export const usage = `
## 游戏王卡片查询插件

此插件提供简单易用的游戏王卡片查询功能，包括随机抽卡、根据卡名查询卡片等功能。

## 数据来源
本插件的卡片数据和图片来源于 [YuGiOh-Cards-Maker](https://github.com/Arshtyi/YuGiOh-Cards-Maker) 仓库。
卡片ID搜索通过 [ygocdb.com](https://ygocdb.com/) 进行查询。

## 命令说明
* \`ygo.random\` 或 \`随机一卡\` - 随机抽取一张游戏王卡牌并显示。随机抽取的卡片包含图片和详细信息。
* \`ygo.query <cardName>\` 或 \`查卡 <cardName>\` - 根据卡名查询卡牌，支持查询多张卡牌（用空格分隔多个卡名）。
* \`ygo.update\` - 更新卡牌数据库（需要管理员权限）。此命令会从仓库下载最新的卡片数据和图片。

## 权限说明
* 更新卡牌数据库需要管理员权限（authority: 4）。
* 随机卡牌和查询卡牌功能所有用户可用。

## 使用方法

### 随机抽卡
输入 \`ygo.random\` 或 \`随机一卡\` 即可随机抽取一张游戏王卡牌，机器人会返回卡片图片和详细信息，包括：
- 卡名
- 卡片ID
- 类型（怪兽Typeline/魔法/陷阱）
- 属性（对于怪兽卡）
- 等级/阶级/连接值（对于相应类型的怪兽卡）
- 连接箭头
- 攻击力/守备力（对于怪兽卡）
- 卡片效果

### 查询卡片
输入 \`ygo.query <cardName>\` 或 \`查卡 <cardName>\` 可以查询特定卡名的卡片，例如：
* \`ygo.query 青眼白龙\` - 查询青眼白龙卡牌。
* \`查卡 青眼白龙\` - 使用别名查询青眼白龙卡牌。
* \`ygo.query 10000040\` - 查询ID为10000040的卡牌。
* \`ygo.query 青眼白龙 黑魔术师\` - 同时查询多张卡牌，结果将以转发消息形式发送。

查询流程：
1. 输入卡名或ID
2. 系统自动从ygocdb.com搜索相应的卡片ID
3. 使用获取到的ID在本地数据库中查询详细信息和图片

当查询单张卡片时，机器人会直接返回卡片图片和详细信息。
当查询多张卡片时，机器人会将结果打包为转发消息，每条消息包含一张卡片的图片和详细信息。

### 更新卡片数据
管理员可以通过 \`ygo.update\` 命令更新卡片数据库。更新过程会下载最新的卡片数据和图片，并自动解压和配置。更新过程可能需要一些时间，视网络状况而定。

## 数据说明
* 卡片数据和图片由 [YuGiOh-Cards-Maker](https://github.com/Arshtyi/YuGiOh-Cards-Maker) 仓库提供。
* 卡片ID查询通过 [ygocdb.com](https://ygocdb.com/) 网站进行。
* 卡片数据文件存放在 \`cfg/fig\` 目录中。

## 注意事项
* 更新功能会下载所有卡片数据和图片，可能消耗较多流量和存储空间。
* 请勿大量调用更新功能，以免给服务器造成负担。
* 如果查询不到某些卡片，可能是数据库中尚未包含该卡片，或者卡片名称输入有误。
* 目前支持大多数官方发行的游戏王卡片，但可能不包含一些最新发行的卡片。
* 查询功能依赖于ygocdb.com网站，若该网站无法访问，可能会影响查询功能。
`;
