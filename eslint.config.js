import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["lib/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["lib/**/*.js"],
    rules: {
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: ":function ImportExpression",
          message: "Import at the top of the module.",
        },
        {
          selector: ":function CallExpression[callee.name='require']",
          message: "Require at the top of the module.",
        },
        {
          selector: ":function :matches(ClassDeclaration, ClassExpression)",
          message: "Define classes at the top level of the module.",
        },
      ],
    },
  },
];
