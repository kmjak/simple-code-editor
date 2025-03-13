"use client";

import { useState, useCallback, ReactNode } from "react";
import { FolderIcon, FileIcon, SaveIcon } from "lucide-react";
import FileEntry from "@/types/FileEntry";
import FileTree from "./components/TreeFile";

export default function FileEditor():ReactNode {
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<FileSystemFileHandle | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenDirectory = useCallback(async ():Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!('showDirectoryPicker' in window)) {
        throw new Error("このブラウザは File System Access API をサポートしていません。");
      }

      const dirHandle:FileSystemDirectoryHandle = await window.showDirectoryPicker();
      const tree:FileEntry[] = await getAllFiles(dirHandle);
      setFileTree(tree);
    } catch (error) {
      if(error instanceof Error) {
        if(error.name !== 'AbortError'){
          console.error("ディレクトリの読み込みエラー:", error);
          setError(error.message || "ディレクトリの読み込み中にエラーが発生しました。");
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAllFiles = async (dirHandle: FileSystemDirectoryHandle): Promise<FileEntry[]> => {
    const entries: FileEntry[] = [];

    try {
      for await (const [name, entry] of dirHandle.entries()) {
        if (entry.kind === "file") {
          entries.push({ name, handle: entry as FileSystemFileHandle, isDirectory: false });
        } else if (entry.kind === "directory") {
          const children = await getAllFiles(entry as FileSystemDirectoryHandle);
          entries.push({ name, handle: entry as FileSystemDirectoryHandle, isDirectory: true, children });
        }
      }

      return entries.sort((a, b):number => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      if(error instanceof Error){
        console.error("エントリーの読み込みエラー:", error);
        throw new Error("ディレクトリの読み込み中にエラーが発生しました。");
      }else{
        console.error("不明なエラーが発生しました:", error);
        throw new Error("ディレクトリの読み込み中に不明なエラーが発生しました。");
      }
    }
  };

  const handleOpenFile = useCallback(async (fileHandle: FileSystemFileHandle):Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (currentFile && fileContent !== editedContent) {
        const confirmSave:boolean = confirm("変更を保存しますか？");
        if (confirmSave) {
          await handleSaveFile();
        }
      }

      const file:File = await fileHandle.getFile();
      const text:string = await file.text();
      setCurrentFile(fileHandle);
      setFileContent(text);
      setEditedContent(text);
    } catch (error) {
      if (error instanceof Error) {
        console.error("ファイルの読み込みエラー:", error.message);
        setError(error.message || "ファイルの読み込み中にエラーが発生しました。");
      } else {
        console.error("不明なエラーが発生しました:", error);
        setError("ファイルの読み込み中に不明なエラーが発生しました。");
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, fileContent, editedContent]);

  const handleSaveFile = useCallback(async () => {
    if (!currentFile) return;

    try {
      setIsLoading(true);
      setError(null);

      const writable:FileSystemWritableFileStream = await currentFile.createWritable();
      await writable.write(editedContent);
      await writable.close();

      setFileContent(editedContent);

      const toast:HTMLDivElement = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg';
      toast.textContent = 'ファイルが保存されました';
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    } catch (error) {
      if(error instanceof Error){
        console.error("保存エラー:", error);
        setError(error.message || "ファイルの保存中にエラーが発生しました。");
      }else{
        console.error("不明なエラーが発生しました:", error);
        setError("ファイルの保存中に不明なエラーが発生しました。");
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, editedContent]);

  const hasChanges = currentFile && fileContent !== editedContent;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-gray-800 text-white p-4 overflow-auto">
        <h1 className="text-xl font-bold mb-4">Editor</h1>

        <button
          onClick={handleOpenDirectory}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center mb-4"
          disabled={isLoading}
        >
          <FolderIcon className="mr-2" size={16} />
          {isLoading ? "読み込み中..." : "フォルダを開く"}
        </button>

        <div className="mt-2">
          {fileTree.length > 0 ? (
            <FileTree entries={fileTree} onFileClick={handleOpenFile} />
          ) : (
            <p className="text-gray-400 text-sm">
              フォルダを開いてファイルを表示
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {currentFile && (
          <div className="bg-gray-700 text-white px-4 py-2 flex justify-between items-center">
            <div className="flex items-center">
              <FileIcon size={16} className="mr-2" />
              <span>{currentFile.name}</span>
              {hasChanges && <span className="ml-2 text-xs">•</span>}
            </div>
            <button
              onClick={handleSaveFile}
              className={`px-3 py-1 rounded flex items-center ${hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600'}`}
              disabled={!hasChanges || isLoading}
            >
              <SaveIcon size={16} className="mr-1" />
              保存
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-2">
            <p>{error}</p>
          </div>
        )}

        {currentFile ? (
          <textarea
            className="flex-1 p-4 font-mono text-sm bg-white border-none resize-none focus:outline-none overflow-auto"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            disabled={isLoading}
            spellCheck={false}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-500">
            <p>ファイルを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

