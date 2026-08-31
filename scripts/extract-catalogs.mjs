const fs = require("fs");
const src = fs.readFileSync(
  "C:/Users/JFCaesar/Documents/Claude/Projects/CP Phantom APP/index.html",
  "utf8",
);

// Extract `const NAME = <literal>;` by matching balanced brackets from the `=`.
function extract(name) {
  const re = new RegExp(`const ${name}\\s*=\\s*`);
  const m = re.exec(src);
  if (!m) throw new Error("not found: " + name);
  let i = m.index + m[0].length;
  const open = src[i];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = null;
  let start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    // line comments
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }
  throw new Error("unbalanced: " + name);
}

const catalogs = [
  "ATTACHMENT_CATALOG",
  "MELEE_MOD_CATALOG",
  "TALENT_CATALOG",
  "TECHNIQUE_CATALOG",
  "HACK_CATALOG",
  "CONSUMABLE_CATALOG",
  "CYBERWARE_IMPACT",
  "CYBERWARE_CATALOG",
];

let out = `/* eslint-disable */
/**
 * CP Phantom rules catalogs — copied VERBATIM from index.html's object literals
 * (2026-08-31). Pure data, no code. These change rarely; if CP Phantom's
 * catalogs are updated, re-run scripts/extract_catalogs to resync.
 * Source of truth for talent/technique/hack/cyberware/attachment/consumable
 * mechanics — SOLO_MODE_BUILD_PLAN.md §3.1 / §8.1.
 */

`;
for (const name of catalogs) {
  out += `export const ${name} = ${extract(name)} as const;\n\n`;
}

fs.writeFileSync(
  "C:/Users/JFCaesar/Documents/Claude/Projects/cp-phantom-game/src/lib/rules/catalogs.ts",
  out,
);
console.log("wrote catalogs.ts", out.length, "chars");
for (const name of catalogs) {
  const body = extract(name);
  console.log(name, body.length, "chars", (body.match(/\n/g) || []).length, "lines");
}
