import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {
    files: ["**/*.ts"], languageOptions: { sourceType: "commonjs" },
  },
  {
    languageOptions: { globals: { ...globals.node, ...globals.mocha, ...globals.commonjs, supertest: false } }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];