// Metro config: Expo's defaults, plus one rule that keeps lessons (and with
// them the answer key) out of any build that talks to Supabase.
//
// app/src/content/built/levels holds full lessons (with each question's
// correct option), which only the development harness needs: it grades
// on-device when no Supabase project is configured. Every other build,
// including every release build, resolves that import to
// src/content/noLessons.ts instead: no lessons at all. Those builds get each
// level, and any evidence card, from the server (start_level and
// get_level_bundles, answers removed by learner_bundle()), and grading
// always happens there. See scripts/build-content.ts.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The monorepo's own packages, found by folder as well as through
// node_modules. On Windows, npm links workspaces with junctions holding an
// absolute path; if the repo was installed from a differently capitalised
// path (C:\dev vs C:\Dev), Metro sees the link pointing outside the project
// and reports "Unable to resolve @brainscroll/core". This fallback is only
// used when normal resolution fails.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@brainscroll/core': path.resolve(__dirname, '..', 'packages', 'core'),
};
config.watchFolders = [...new Set([...(config.watchFolders ?? []), path.resolve(__dirname, '..', 'packages', 'core')])];

const usesServer = !!process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_RELEASE === '1';
const fullLessons = path.join(__dirname, 'src', 'content', 'built', 'levels');
const noLessons = path.join(__dirname, 'src', 'content', 'noLessons.ts');

if (usesServer) {
  const resolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === './built/levels' && path.resolve(path.dirname(context.originModulePath), moduleName) === fullLessons) {
      return { type: 'sourceFile', filePath: noLessons };
    }
    return (resolve ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
