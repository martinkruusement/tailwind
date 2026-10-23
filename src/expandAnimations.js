const { parseSingle, serialize } = require("@hookun/parse-animation-shorthand");

/**
 * @param {@} options
 * @returns {import('postcss').Plugin}
 */
module.exports = (options = { debug: false }) => {
  return {
    postcssPlugin: "postcss-nativescript-animations",
    Declaration(decl) {
      try {
        // replace animation: *
        // with    animation-*:
        if (decl.prop === "animation") {
          const parsed = parseSingle(decl.value);
          // parser stopped early, e.g. at a list comma: keep the shorthand
          if (
            parsed &&
            typeof parsed.end === "number" &&
            parsed.end < decl.value.trimEnd().length
          ) {
            return;
          }
          // parser 0.1.5+ wraps the result in { start, end, value }
          const styles =
            parsed &&
            typeof parsed === "object" &&
            parsed.value &&
            typeof parsed.value === "object"
              ? parsed.value
              : parsed;
          // parser returns milliseconds; core reads unit-less times as seconds
          for (const key of ["duration", "delay"]) {
            if (typeof styles[key] === "number") {
              styles[key] = `${styles[key]}ms`;
            }
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
};
module.exports.postcss = true;

function camelToKebab(input) {
  return input.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
