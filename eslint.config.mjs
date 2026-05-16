// eslint.config.mjs

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { defineConfig } from "eslint/config";

import eslintConfigPrettier from "eslint-config-prettier";

// See: https://typescript-eslint.io/users/configs/#stylistic
const weAreHighlyProficientInTypeScript = true; // Feel free to set this flag to false depending on your team’s TypeScript proficiency

// See: https://typescript-eslint.io/users/configs/#strict
const weLikeCodeStylingConsistencyEvenIfSomeRulesAreOpiniated = true;

// See: https://typescript-eslint.io/getting-started/typed-linting
const weDontMindSlowerRulesAsTheyAreUsuallyTheBestBecauseTheyUseTypeInformation = true; // Set to false if you want to disable (slower) type-checked rules

export default defineConfig(
  // Ignore some directories
  {
    ignores: ["node_modules", "dist", "build", "coverage"],
  },
  // Some additional eslint configuration options
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          // allows configuration files (such as this file) to be linted even if it's not listed in the tsconfig.json
          allowDefaultProject: ["*.mjs", "*.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Use recommended rules
  eslint.configs.recommended,

  // Use TypeScript rules based on proficiency
  ...(weAreHighlyProficientInTypeScript
    ? [
        // Strict lint rules, hooray!
        weDontMindSlowerRulesAsTheyAreUsuallyTheBestBecauseTheyUseTypeInformation
          ? tseslint.configs.strictTypeChecked.map((config) => ({
              ...config,
              files: ["**/*.ts"],
            }))
          : tseslint.configs.strict,
      ]
    : [
        // Recommended lint rules only, good enough!
        weDontMindSlowerRulesAsTheyAreUsuallyTheBestBecauseTheyUseTypeInformation
          ? tseslint.configs.recommendedTypeChecked.map((config) => ({
              ...config,
              files: ["**/*.ts"],
            }))
          : tseslint.configs.recommended,
      ]),

  // Optionally add rules that enforce code styling consistency
  ...(weLikeCodeStylingConsistencyEvenIfSomeRulesAreOpiniated
    ? [tseslint.configs.stylistic]
    : []),

  // Any overrides here (but ideally you just stick with the standards)
  // During migrations you might have some exceptions defined here though
  {
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-dynamic-delete": "off",
    },
  },

  // Disable rules that would conflict with prettier
  eslintConfigPrettier,
);
