import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { type TreeItem } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a record of files to a tree structure.
 * @param files - Record of file paths to content
 * @returns Tree structure for TreeView component
 *
 * @example
 * Input: { "src/Button.tsx": "...", "README.md": "..." }
 * Output: [["src", "Button.tsx"], "README.md"]
 */
export function convertFilesToTreeItems(
  files: Record<string, string>
): TreeItem[] {
  // Define proper type for tree structure
  interface TreeNode {
    [key: string]: TreeNode | null;
  }

  // Build a tree structure first
  const tree: TreeNode = {};

  // Filtrar los campos especiales relacionados con el video
  const filteredPaths = Object.keys(files).filter(path => {
    // Excluir campos que comienzan con __
    if (path.startsWith('__')) return false;
    
    // Excluir campos específicos relacionados con el video (con o sin prefijo)
    const excludedFields = [
      'video_data', 'videodata', 'videoData',
      'video_mime_type', 'videomimetype', 'videoMimeType',
      'video_mime', 'videomime', 'videoMime'
    ];
    
    return !excludedFields.some(field => 
      path.toLowerCase() === field.toLowerCase() || 
      path.toLowerCase().includes(field.toLowerCase())
    );
  });
  
  // Sort files to ensure consistent ordering
  const sortedPaths = filteredPaths.sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/");
    let current = tree;

    // Navigate/create the tree structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    // Add the file (leaf node)
    const fileName = parts[parts.length - 1];
    current[fileName] = null; // null indicates it's a file
  }

  // Convert tree structure to TreeItem format
  function convertNode(node: TreeNode, name?: string): TreeItem[] | TreeItem {
    const entries = Object.entries(node);

    if (entries.length === 0) {
      return name || "";
    }

    const children: TreeItem[] = [];

    for (const [key, value] of entries) {
      if (value === null) {
        // It's a file
        children.push(key);
      } else {
        // It's a folder
        const subTree = convertNode(value, key);
        if (Array.isArray(subTree)) {
          children.push([key, ...subTree]);
        } else {
          children.push([key, subTree]);
        }
      }
    }

    return children;
  }

  const result = convertNode(tree);
  return Array.isArray(result) ? result : [result];
}
    
