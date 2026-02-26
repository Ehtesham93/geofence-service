import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { 
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: "module"
    },
    rules: {
      // Warning for declared but unused variables
      "no-unused-vars": ["warn", {
        "vars": "all",
        "args": "after-used",
        "ignoreRestSiblings": false
      }],
      
      // Error for used but undeclared variables
      "no-undef": "error",
      
      // Additional helpful rules
      "no-unreachable": "error",
      "no-constant-condition": "error"
    }
  },
]);