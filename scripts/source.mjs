import { createHash } from "node:crypto";
export function flag(value) {
  if ([false, 0, "0"].includes(value)) return "free";
  if ([true, 1, "1"].includes(value)) return "paid";
  return "unknown";
}
export function classifyPayment(row, page = "unknown") {
  const backend = Object.hasOwn(row, "is_pay_subscribe")
    ? flag(row.is_pay_subscribe)
    : "unknown";
  return backend === page ? backend : "unknown";
}
export function identity(row) {
  const u = new URL(row.link);
  if (u.hostname !== "mp.weixin.qq.com") throw Error("Unexpected source host");
  if (row.appmsgid && row.itemidx)
    return createHash("sha256")
      .update(`zifeiai:${row.appmsgid}:${row.itemidx}`)
      .digest("hex")
      .slice(0, 16);
  const biz = u.searchParams.get("__biz"),
    mid = u.searchParams.get("mid"),
    idx = u.searchParams.get("idx");
  if (!biz || !mid || !idx) throw Error("Source identity missing");
  return createHash("sha256")
    .update(`${biz}:${mid}:${idx}`)
    .digest("hex")
    .slice(0, 16);
}
export function flatten(items) {
  return items.flatMap((item) => {
    const info =
      typeof item.publish_info === "string"
        ? JSON.parse(item.publish_info)
        : item.publish_info;
    return (
      info?.appmsgex?.length ? info.appmsgex : info?.appmsg_info || []
    ).map((a) => ({
      ...a,
      link: a.link || a.url,
      publish_timestamp: info.sent_info?.time || a.update_time || a.create_time,
      publish_type: item.publish_type,
    }));
  });
}
export function reconcile(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = identity(row);
    if (
      map.has(id) &&
      JSON.stringify(map.get(id).is_pay_subscribe) !==
        JSON.stringify(row.is_pay_subscribe)
    )
      throw Error(`Conflicting duplicate ${id}`);
    map.set(id, row);
  }
  return [...map.values()];
}

export function sourceAvailability(text, hasArticle) {
  if (hasArticle) return "available";
  return /该内容已被发布者删除|此内容因违规无法查看|此内容已被删除|此内容发送失败无法查看/.test(
    text,
  )
    ? "removed"
    : "unknown";
}
