// Execute current public-design regression unchanged, redirecting its artifacts
// so that earlier delivery screenshots/results are not overwritten.
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');
const source=path.resolve(__dirname,'../../public-redesign/verification/browser.cjs');
const code=fs.readFileSync(source,'utf8').replaceAll('docs/public-redesign/screenshots/','docs/branding-seo/verification/public-templates/').replaceAll('docs/public-redesign/verification/browser.json','docs/branding-seo/verification/public-regression.json');
const runner=new Module(source,module);runner.filename=source;runner.paths=Module._nodeModulePaths(path.dirname(source));runner._compile(code,source);
