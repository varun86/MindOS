/**
 * Explicit Space scaffold templates.
 *
 * Ordinary folder/file creation must not create these files implicitly.
 * Use createSpaceFilesystem() or convertToSpace() when the user explicitly
 * asks to make a directory a Mind Space.
 */

export const INSTRUCTION_TEMPLATE = (dirName: string) =>
  `# ${dirName} Instruction Set

## Goal

- Define local execution rules for this directory.

## Local Rules

- Read root \`INSTRUCTION.md\` first.
- Then read this directory \`README.md\` for navigation.
- Keep edits minimal, structured, and traceable.

## Execution Order

1. Root \`INSTRUCTION.md\`
2. This directory \`INSTRUCTION.md\`
3. This directory \`README.md\` and target files

## Boundary

- Root rules win on conflict.
`;

export const README_TEMPLATE = (dirName: string) =>
  `# ${dirName}

## 📁 Structure

\`\`\`bash
${dirName}/
├── INSTRUCTION.md
├── README.md
└── (your files here)
\`\`\`

## 💡 Usage

(Describe the purpose and usage of this space.)
`;

/**
 * Strip leading emoji and whitespace from a directory name.
 * e.g. "📖 Learning" → "Learning", "🔄 Workflows" → "Workflows"
 */
export function cleanDirName(dirName: string): string {
  // Match leading emoji (Unicode emoji properties) + whitespace
  const cleaned = dirName.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '');
  return cleaned || dirName; // fallback to original if everything was stripped
}
