import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "zifeiai-render-"));
await fs.mkdir(path.join(tmp, "_posts"));
await fs.writeFile(
  path.join(tmp, "_config.yml"),
  "title: REPLACED\ntimezone: Asia/Shanghai\n",
);
await fs.writeFile(
  path.join(tmp, "_posts/2024-01-01-check.html"),
  "---\nrender_with_liquid: false\npermalink: /check/\n---\n<p>{{ site.title }} {% include nonexistent.html %}</p>",
);
try {
  execFileSync(
    "bundle",
    [
      "exec",
      "jekyll",
      "build",
      "--source",
      tmp,
      "--destination",
      path.join(tmp, "output"),
    ],
    { stdio: "pipe" },
  );
  const result = await fs.readFile(
    path.join(tmp, "output/check/index.html"),
    "utf8",
  );
  if (!result.includes("{{ site.title }} {% include nonexistent.html %}"))
    throw Error("Source Liquid executed");
  console.log("Jekyll source-content isolation passed");
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
