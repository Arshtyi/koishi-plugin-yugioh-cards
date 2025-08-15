import axios from "axios";
type Node = {
    type: "root" | "element" | "text";
    tag?: string;
    children: Node[];
    text?: string;
    attrs?: Record<string, string>;
};
function parseMinimalHTML(html: string): Node {
    const root: Node = { type: "root", children: [] };
    const stack: Node[] = [root];
    let i = 0;
    const len = html.length;

    while (i < len) {
        if (html.startsWith("<!--", i)) {
            const end = html.indexOf("-->", i + 4);
            i = end >= 0 ? end + 3 : len;
            continue;
        }
        if (html[i] === "<") {
            if (html[i + 1] === "/") {
                const end = html.indexOf(">", i + 2);
                if (end === -1) break;
                const tagName = html
                    .slice(i + 2, end)
                    .trim()
                    .split(/\s+/)[0]
                    .toLowerCase();
                for (let s = stack.length - 1; s > 0; s--) {
                    const node = stack[s];
                    if (node.type === "element" && node.tag === tagName) {
                        stack.splice(s);
                        break;
                    }
                }
                i = end + 1;
                continue;
            }
            const end = html.indexOf(">", i + 1);
            if (end === -1) break;
            const tagContent = html.slice(i + 1, end).trim();
            const selfClose = tagContent.endsWith("/");
            const parts = tagContent.replace(/\/$/, "").split(/\s+/);
            const tagName = parts[0].toLowerCase();
            if (tagName.startsWith("!")) {
                i = end + 1;
                continue;
            }
            // parse attributes (simple but robust for common cases)
            const attrString = tagContent
                .replace(/\/$/, "")
                .slice(tagName.length)
                .trim();
            const attrs: Record<string, string> = {};
            const attrRegex =
                /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
            let attrMatch: RegExpExecArray | null;
            while ((attrMatch = attrRegex.exec(attrString))) {
                attrs[attrMatch[1]] =
                    attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
            }

            const node: Node = {
                type: "element",
                tag: tagName,
                children: [],
                attrs,
            };
            const parent = stack[stack.length - 1];
            parent.children.push(node);
            if (
                !selfClose &&
                !["br", "img", "meta", "link", "input"].includes(tagName)
            ) {
                stack.push(node);
            }
            i = end + 1;
            continue;
        }
        const nextTag = html.indexOf("<", i);
        const end = nextTag === -1 ? len : nextTag;
        const txt = html.slice(i, end);
        const parent = stack[stack.length - 1];
        const cleaned = txt.replace(/\s+/g, " ").trim();
        if (cleaned)
            parent.children.push({ type: "text", children: [], text: cleaned });
        i = end;
    }
    return root;
}

function selectByAbsolutePath(root: Node, path: string): Node | null {
    const steps = path.split("/").filter(Boolean);
    let current: Node | null = root;
    for (const step of steps) {
        if (!current) return null;
        const m = step.match(/^([a-zA-Z0-9_-]+)(?:\[(\d+)\])?$/);
        if (!m) return null;
        const tag = m[1].toLowerCase();
        const idx = m[2] ? parseInt(m[2], 10) : 1;
        const children = current.children.filter(
            (c) => c.type === "element" && c.tag === tag
        );
        if (children.length < idx) return null;
        current = children[idx - 1];
    }
    return current;
}

function getNodeText(node: Node | null): string {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    const parts: string[] = [];
    for (const c of node.children) parts.push(getNodeText(c));
    return parts.join(" ").replace(/\s+/g, " ").trim();
}

function findByStrictPath(html: string): string | null {
    const doc = parseMinimalHTML(html);
    const target = selectByAbsolutePath(
        doc,
        "/html/body/main/div/div[2]/div[2]/h3[3]/span[1]"
    );
    if (!target) return null;
    return getNodeText(target) || null;
}

/**
 * 根据关键词从ygocdb.com搜索卡片ID（使用严格 XPath `/html/body/main/div/div[2]/div[2]/h3[3]/span[1]`）
 * @param keyword 搜索关键词
 * @returns 搜索到的卡片ID或null
 */
export async function searchCardByKeyword(
    keyword: string
): Promise<string | null> {
    try {
        const url = `https://ygocdb.com/?search=${encodeURIComponent(keyword)}`;
        const headers = {
            "user-agent": "nonebot-plugin-ygo",
            referer: "https://ygocdb.com/",
        };
        // 搜索开始（不输出详细调试信息）
        let response = await axios.get(url, { headers });
        let html = response.data as string;
        // 新逻辑：在 /html/body/main/div/div[IDX]/div[1]/a 中查找 href 包含 /card/<id>
        const delays = [0, 1000, 2000, 4000];
        for (let attempt = 0; attempt < delays.length; attempt++) {
            if (delays[attempt])
                await new Promise((r) => setTimeout(r, delays[attempt]));
            try {
                if (attempt > 0) {
                    response = await axios.get(url, { headers });
                    html = response.data as string;
                }
                const doc = parseMinimalHTML(html);
                for (let idx = 2; idx <= 8; idx++) {
                    const path = `/html/body/main/div/div[${idx}]/div[1]/a`;
                    const node = selectByAbsolutePath(doc, path);
                    if (!node || node.type !== "element") continue;
                    const href = node.attrs?.href || "";
                    const m = href.match(/\/card\/(\d+)/);
                    if (m) return m[1];
                }
            } catch (err) {
                // 忽略单次请求错误，继续重试
            }
        }
        return null;
    } catch (error) {
        console.error("searchCardByKeyword error:", error);
        return null;
    }
}

/**
 * 高级搜索：尝试多个绝对 XPath 变体来收集页面上所有匹配的卡片ID
 * 采用路径模板：/html/body/main/div/div[IDX]/div[2]/h3[3]/span[1]，IDX 从 2 到 maxIndex
 * 返回找到的 id 列表（去重，按出现顺序）
 */
export async function searchAllByKeyword(
    keyword: string,
    maxIndex = 8
): Promise<string[]> {
    const url = `https://ygocdb.com/?search=${encodeURIComponent(keyword)}`;
    const headers = {
        "user-agent": "nonebot-plugin-ygo",
        referer: "https://ygocdb.com/",
    };

    const delays = [0, 1000, 2000, 4000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt])
            await new Promise((r) => setTimeout(r, delays[attempt]));
        try {
            const response = await axios.get(url, { headers });
            const html = response.data as string;
            // 在整个 HTML 中查找所有 /card/<id> 链接，按出现顺序去重
            const found: string[] = [];
            const seen = new Set<string>();
            const regex = /\/card\/(\d+)/g;
            let m: RegExpExecArray | null;
            while ((m = regex.exec(html)) !== null) {
                const id = m[1];
                if (!seen.has(id)) {
                    seen.add(id);
                    found.push(id);
                }
            }
            if (found.length > 0) return found;
        } catch (err) {
            // 忽略本次错误，继续重试
        }
    }
    return [];
}
