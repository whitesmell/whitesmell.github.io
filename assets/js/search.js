const input = document.querySelector("#q"),
  status = document.querySelector("#status"),
  results = document.querySelector("#results");
let articles = [];
let unavailable = false;
fetch("/search.json")
  .then((r) => {
    if (!r.ok) throw Error();
    return r.json();
  })
  .then((data) => {
    articles = data;
    render();
  })
  .catch(() => {
    unavailable = true;
    status.textContent = "搜索暂时不可用，请使用文章归档。";
  });
function render() {
  if (unavailable) {
    status.textContent = "搜索暂时不可用，请使用文章归档。";
    return;
  }
  const q = input.value.trim().toLocaleLowerCase();
  results.replaceChildren();
  if (!q) {
    status.textContent = "输入关键词开始搜索。";
    return;
  }
  const hits = articles.filter((a) =>
    `${a.title} ${a.description} ${a.tags.join(" ")}`
      .toLocaleLowerCase()
      .includes(q),
  );
  status.textContent = `找到 ${hits.length} 篇文章`;
  for (const a of hits) {
    const li = document.createElement("li"),
      link = document.createElement("a"),
      p = document.createElement("p");
    link.href = a.url;
    link.textContent = a.title;
    p.textContent = a.description;
    li.append(link, p);
    results.append(li);
  }
}
input.addEventListener("input", render);
