import FileEntry from "@/types/FileEntry";
import { FolderIcon, FileIcon } from "lucide-react";
import { ReactNode } from "react";

export default function FileTree({ entries, onFileClick }: {
  entries: FileEntry[];
  onFileClick: (file: FileSystemFileHandle) => void
}):ReactNode{
  return (
    <ul className="space-y-1">
      {entries.map((entry, index) => (
        <li key={index}>
          {entry.isDirectory ? (
            <details className="cursor-pointer">
              <summary className="flex items-center py-1 hover:bg-gray-700 rounded px-2">
                <FolderIcon size={16} className="mr-2 text-yellow-400" />
                <span>{entry.name}</span>
              </summary>
              <div className="pl-4 border-l border-gray-700 ml-2 mt-1">
                {entry.children && <FileTree entries={entry.children} onFileClick={onFileClick} />}
              </div>
            </details>
          ) : (
            <button
              onClick={() => onFileClick(entry.handle as FileSystemFileHandle)}
              className="flex items-center w-full text-left py-1 hover:bg-gray-700 rounded px-2"
            >
              <FileIcon size={16} className="mr-2 text-blue-400" />
              <span>{entry.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};