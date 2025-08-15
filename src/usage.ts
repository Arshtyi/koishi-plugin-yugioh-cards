export const usage = `
## YuGiOh-Cards

提供随机一卡、卡片查询、禁卡表查询.

数据来源

-   卡片数据与图片：[YuGiOh-Cards-Maker](https://github.com/Arshtyi/YuGiOh-Cards-Maker)
-   禁卡表数据：[YuGiOh-Cards-Maker](https://github.com/Arshtyi/YuGiOh-Cards-Maker)
-   卡片 ID 查询：[ygocdb.com](https://ygocdb.com)

命令
-   ygo.update：更新本地卡片数据库（需要管理员权限）.
-   ygo.limit：返回禁卡表信息.
-   ygo.random 或 随机一卡：随机返回一张卡片（图片 + 详细信息）.
-   ygo.query <卡名|ID>... 或 查卡 <卡名|ID>...：按名称或 ID 查询，支持同时查询多个卡名（以空格分隔），多条结果以转发消息形式返回.
-   ygo.advanced <关键词> 或 高级查卡 <关键词>：按关键词查询，返回所有匹配的卡片


权限

-   更新数据库需管理员权限（ authority: 4）.
-   查询与随机功能对普通用户开放.

注意事项

-   查询依赖于 ygocdb.com 的可用性，如网站不可用则查询失败.
-   更新数据库会下载大量文件，请确保有足够的带宽与存储.
`;
