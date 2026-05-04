import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/client/*.ts"],
  bundle: true,
  outdir: "public/js",
  sourcemap: true,
  target: ["es2020"],
  format: "esm",
});

if (watch) {
  await ctx.watch();
  console.log("esbuild watching for changes...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}