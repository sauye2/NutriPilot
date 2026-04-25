import { register } from "node:module";

register(new URL("./ts-esm-loader.mjs", import.meta.url));
