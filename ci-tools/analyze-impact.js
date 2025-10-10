// analyze-impact.js
import fs from "fs";
import { execSync } from "child_process";

try {
  // Step 1: Load dependency graph (generated via depcruise)
  const deps = JSON.parse(fs.readFileSync("./deps.json", "utf8"));

  // Step 2: Get changed files from PR base to head
  // In GitHub Actions PRs, use the base ref; locally use HEAD~1
  let baseSha = "HEAD~1";
  if (process.env.GITHUB_BASE_REF) {
    baseSha = `origin/${process.env.GITHUB_BASE_REF}`;
  } else if (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.GITHUB_BASE_REF) {
    // Fallback: use refs/remotes/origin/{base_ref}
    baseSha = `refs/remotes/origin/${process.env.GITHUB_BASE_REF}`;
  }
  
  const changedFiles = execSync(`git diff --name-only ${baseSha} HEAD`)
    .toString()
    .split("\n")
    .filter((f) => 
      (f.startsWith("blocks/") || 
       f.startsWith("scripts/") || 
       f.startsWith("tools/")) && 
      f.trim().length > 0 &&
      f.endsWith(".js")
    );

  if (changedFiles.length === 0) {
    console.log("No relevant source files changed in blocks/, scripts/, or tools/.");
    process.exit(0);
  }

  // Step 3: Build reverse dependency map
  const reverseMap = {};
  deps.modules.forEach((m) => {
    if (m.dependencies && Array.isArray(m.dependencies)) {
      m.dependencies.forEach((d) => {
        if (!reverseMap[d.resolved]) reverseMap[d.resolved] = [];
        reverseMap[d.resolved].push(m.source);
      });
    }
  });

  // Step 4: Identify impacted files (excluding test files for now)
  const impactedSource = new Set();
  const impactedTests = new Set();
  
  changedFiles.forEach((file) => {
    if (reverseMap[file]) {
      reverseMap[file].forEach((dependent) => {
        if (dependent.includes("/test/") || dependent.endsWith(".test.js") || dependent.endsWith(".spec.js")) {
          impactedTests.add(dependent);
        } else {
          impactedSource.add(dependent);
        }
      });
    }
  });

  // Helper function to get meaningful context for a file
  function getFileContext(filePath) {
    // Check for form components
    const componentMatch = filePath.match(/blocks\/form\/components\/([^\/]+)\//);
    if (componentMatch) {
      return `**${componentMatch[1]}** component`;
    }
    
    // Check for form rules
    if (filePath.includes("blocks/form/rules/")) {
      return "**rules engine**";
    }
    
    // Check for form integrations
    if (filePath.includes("blocks/form/integrations/")) {
      return "**form integrations**";
    }
    
    // Check for form utilities
    if (filePath.match(/blocks\/form\/(util|functions|constant|mappings|submit|transform)\.js$/)) {
      const filename = filePath.match(/([^\/]+)\.js$/)[1];
      return `**form ${filename}**`;
    }
    
    // Check for main form block
    if (filePath === "blocks/form/form.js") {
      return "**form block (main)**";
    }
    
    // Check for scripts
    if (filePath.startsWith("scripts/")) {
      const filename = filePath.match(/scripts\/([^\/]+)\.js$/)?.[1];
      return filename ? `**shared script** (${filename})` : "**shared scripts**";
    }
    
    // Check for tools
    if (filePath.startsWith("tools/")) {
      return "**build tools**";
    }
    
    // Check for other blocks
    const blockMatch = filePath.match(/blocks\/([^\/]+)\//);
    if (blockMatch) {
      return `**${blockMatch[1]}** block`;
    }
    
    return "";
  }

  // Map files to business features - keep it concise
  function getBusinessFeatures(files) {
    const featureMap = [
      { pattern: /blocks\/form\/util\.js$/, features: ["Field Rendering", "Validation", "Accessibility"] },
      { pattern: /blocks\/form\/form\.js$/, features: ["Form Rendering", "Prefill"] },
      { pattern: /blocks\/form\/submit\.js$/, features: ["Form Submission", "File Uploads"] },
      { pattern: /blocks\/form\/transform\.js$/, features: ["Document-based Forms"] },
      { pattern: /blocks\/form\/rules\//, features: ["Conditional Logic", "Business Rules", "Calculated Fields"] },
      { pattern: /blocks\/form\/components\/wizard\//, features: ["Multi-step Forms"] },
      { pattern: /blocks\/form\/components\/repeat\//, features: ["Repeatable Sections"] },
      { pattern: /blocks\/form\/components\/modal\//, features: ["Modal Dialogs"] },
      { pattern: /blocks\/form\/components\/file\//, features: ["File Attachments"] },
      { pattern: /blocks\/form\/components\/password\//, features: ["Password Fields"] },
      { pattern: /blocks\/form\/components\/rating\//, features: ["Rating Component"] },
      { pattern: /blocks\/form\/components\/accordion\//, features: ["Accordion"] },
      { pattern: /blocks\/form\/components\/tnc\//, features: ["Terms & Conditions"] },
      { pattern: /blocks\/form\/integrations\/recaptcha\.js/, features: ["reCAPTCHA"] },
      { pattern: /blocks\/form\/mappings\.js$/, features: ["Component Registration"] },
      { pattern: /blocks\/form\/constant\.js$/, features: ["Configuration"] },
      { pattern: /blocks\/embed-adaptive-form\//, features: ["Embedded Forms"] },
      { pattern: /scripts\/form-editor-support\.js/, features: ["Form Authoring"] },
      { pattern: /scripts\/aem\.js/, features: ["AEM Integration"] },
    ];

    const features = new Set();
    files.forEach(file => {
      featureMap.forEach(({ pattern, features: featureList }) => {
        if (pattern.test(file)) {
          featureList.forEach(f => features.add(f));
        }
      });
    });
    return [...features].sort();
  }

  // TODO: Future enhancement - read JSDoc @feature tags from files instead of hardcoded mapping
  // This would allow developers to document features directly in code
  //
  // Example: In blocks/form/util.js:
  // /**
  //  * @feature Form Validation
  //  * @feature Field Rendering
  //  * @feature Accessibility (ARIA, labels)
  //  */

  // Step 5: Human-readable summary with context
  console.log("##  Direct Changes\n");
  changedFiles.forEach((f) => {
    const context = getFileContext(f);
    const contextStr = context ? ` → ${context}` : "";
    console.log(`- \`${f}\`${contextStr}`);
  });

  // Show affected business features
  const allAffectedFiles = [...changedFiles, ...impactedSource];
  const businessFeatures = getBusinessFeatures(allAffectedFiles);
  
  if (businessFeatures.length > 0) {
    console.log("\n## Business Features Potentially Affected\n");
    businessFeatures.forEach(feature => console.log(`- ${feature}`));
  }

  if (impactedSource.size === 0 && impactedTests.size === 0) {
    console.log("\nNo dependent modules appear to be impacted by these changes.");
  } else {
    if (impactedSource.size > 0) {
      console.log("\n##  Potentially Impacted Modules\n");
      [...impactedSource].forEach((f) => {
        const context = getFileContext(f);
        const contextStr = context ? ` → ${context}` : "";
        console.log(`- \`${f}\`${contextStr}`);
      });
    }

    if (impactedTests.size > 0) {
      console.log("\n##  Tests to Review\n");
      [...impactedTests].forEach((f) => console.log(`- \`${f}\``));
    }

    if (businessFeatures.length > 0) {
      const topFeatures = businessFeatures.slice(0, 2).join(", ");
      const suffix = businessFeatures.length > 2 ? ` + ${businessFeatures.length - 2} more` : "";
      console.log(`\n **Focus testing on:** ${topFeatures}${suffix}`);
    } else {
      console.log("\n Review impacted modules and run tests before merging");
    }
  }
} catch (err) {
  console.error("Error running dependency impact analysis:", err.message);
  process.exit(1);
}
