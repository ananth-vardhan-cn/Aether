import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { File } from '../types';
import { extractDependencies } from './extractDependencies';

/**
 * Exports the current project as a complete Vite + React + TypeScript project
 * Similar to Google Gemini Studio's export functionality
 */
export async function exportProjectAsZip(
    projectName: string,
    files: File[]
): Promise<void> {
    const zip = new JSZip();

    // Clean project name for folder
    const folderName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    // Extract dependencies from generated code
    const dependencies = extractDependencies(files);

    // ========== package.json ==========
    const packageJson = {
        name: folderName,
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview"
        },
        dependencies: {
            react: "^19.2.0",
            "react-dom": "^19.2.0",
            ...dependencies
        },
        devDependencies: {
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "@vitejs/plugin-react": "^5.0.0",
            typescript: "~5.8.2",
            vite: "^6.2.0"
        }
    };

    zip.file('package.json', JSON.stringify(packageJson, null, 2));

    // ========== tsconfig.json ==========
    const tsConfig = {
        compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: "force",
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedSideEffectImports: true
        },
        include: ["src"]
    };

    zip.file('tsconfig.json', JSON.stringify(tsConfig, null, 2));

    // ========== vite.config.ts ==========
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})
`;

    zip.file('vite.config.ts', viteConfig);

    // ========== index.html ==========
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`;

    zip.file('index.html', indexHtml);

    // ========== src/index.tsx (entry point) ==========
    const indexTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;

    zip.file('src/index.tsx', indexTsx);

    // ========== Add all generated files to src/ ==========
    for (const file of files) {
        let filePath = file.name;

        // Normalize path
        if (filePath.startsWith('/')) {
            filePath = filePath.slice(1);
        }

        // Ensure files are in src/ directory
        if (!filePath.startsWith('src/')) {
            filePath = `src/${filePath}`;
        }

        zip.file(filePath, file.content);
    }

    // ========== .gitignore ==========
    const gitignore = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`;

    zip.file('.gitignore', gitignore);

    // ========== README.md ==========
    const readme = `# ${projectName}

Built with Aether AI App Builder

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start development server:
\`\`\`bash
npm run dev
\`\`\`

3. Build for production:
\`\`\`bash
npm run build
\`\`\`

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS${Object.keys(dependencies).length > 5 ? '\n- And more (see package.json)' : ''}
`;

    zip.file('README.md', readme);

    // ========== Generate and Download ==========
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${folderName}.zip`);
}
