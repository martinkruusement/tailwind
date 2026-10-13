const { parseSingle, serialize } = require("@hookun/parse-animation-shorthand");

// var(--name) or var(--name, fallback), with no nested parentheses in the fallback.
const VAR_RE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*?))?\s*\)/g;

/**
 * @param {@} options
 * @returns {import('postcss').Plugin}
 */
module.exports = (options = { debug: false }) => {
  return {
    postcssPlugin: "postcss-nativescript-animations",
    prepare() {
      // Custom properties declared anywhere in the stylesheet. Tailwind v4
      // writes `.animate-spin { animation: var(--animate-spin) }` and puts the
      // value in a theme variable, which the shorthand parser can't read.
      const variables = new Map();

      return {
        Once(root) {
          root.walkDecls(/^--/, (decl) => {
            variables.set(decl.prop, decl.value);
          });
        },
        Declaration(decl) {
          try {
            // replace animation: *
            // with    animation-*:
            if (decl.prop === "animation") {
              const styles = parseSingle(resolveVariables(decl.value, variables));
              if (styles.duration && Number.isInteger(styles.duration)) {
                styles.duration = `${styles.duration / 1000}s`;
              }
              Object.entries(styles)
                .filter(([, value]) => typeof value === "object")
                .map(([key, value]) => [
                  key,
                  serialize({ [key]: value }).split(" ")[0],
                ])
                .map(([key, value]) => (styles[key] = value));

              Object.entries(styles)
                .filter(([, value]) => value !== "unset")
                .map(([key, value]) =>
                  decl.parent.insertAfter(
                    decl,
                    decl.clone({
                      prop: `animation-${camelToKebab(key)}`,
                      value: `${value}`,
                    })
                  )
                );

              decl.remove();
            }
          } catch (err) {
            // ignore errors, and just keep the animation as-is
          }
        },
      };
    },
  };
};
module.exports.postcss = true;

/**
 * Substitutes `var()`s with the stylesheet's values (or their fallbacks),
 * following variables that refer to other variables. Unknown ones are left in
 * place.
 */
function resolveVariables(value, variables, depth = 0) {
  if (depth > 10 || !value.includes("var(")) {
    return value;
  }
  const resolved = value.replace(VAR_RE, (match, name, fallback) => {
    const replacement = variables.has(name) ? variables.get(name) : fallback;
    return replacement === undefined ? match : replacement;
  });
  return resolved === value ? value : resolveVariables(resolved, variables, depth + 1);
}

function camelToKebab(input) {
  return input.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
