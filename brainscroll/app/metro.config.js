// Metro config: Expo's defaults, plus one rule that keeps the answer key out
// of any build that talks to Supabase.
//
// app/src/content/built/levels holds full lessons (with each question's
// correct option), which only the development harness needs: it grades
// on-device when no Supabase project is configured. Every other build,
// including every release build, resolves that import to
// built/learner-levels instead: the same lessons with the answers removed,
// as the server's learner_bundle() does. Grading then always happens on the
// server. See scripts/build-content.ts.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const usesServer = !!process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_RELEASE === '1';
const fullLessons = path.join(__dirname, 'src', 'content', 'built', 'levels');
const learnerLessons = path.join(__dirname, 'src', 'content', 'built', 'learner-levels', 'index.ts');

if (usesServer) {
  const resolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === './built/levels' && path.resolve(path.dirname(context.originModulePath), moduleName) === fullLessons) {
      return { type: 'sourceFile', filePath: learnerLessons };
    }
    return (resolve ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
