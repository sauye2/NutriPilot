import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import ts from "typescript";

const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_MODULE_NOT_FOUND" &&
      isRelativeSpecifier(specifier) &&
      !hasKnownExtension(specifier)
    ) {
      return defaultResolve(`${specifier}.ts`, context, defaultResolve);
    }

    throw error;
  }
}

export async function load(url, context, defaultLoad) {
  if (TS_EXTENSIONS.has(extname(new URL(url).pathname))) {
    const source = await readFile(new URL(url), "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        allowImportingTsExtensions: true,
      },
      fileName: new URL(url).pathname,
    });

    return {
      format: "module",
      source: transpiled.outputText,
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function hasKnownExtension(specifier) {
  const extension = extname(specifier);
  return extension.length > 0;
}
