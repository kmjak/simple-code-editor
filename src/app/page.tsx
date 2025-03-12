"use client";

import { useState, useCallback } from "react";
import { FolderIcon, FileIcon, SaveIcon } from "lucide-react";

type FileEntry = {
  name: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  isDirectory: boolean;
  children?: FileEntry[];
};


export default function FileEditor() {
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<FileSystemFileHandle | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 📂 ディレクトリを開いて、全ファイル・フォルダを取得
  const handleOpenDirectory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // File System Access API が利用可能か確認
      if (!('showDirectoryPicker' in window)) {
        throw new Error("このブラウザは File System Access API をサポートしていません。");
      }

      const dirHandle = await window.showDirectoryPicker(); // ユーザーにディレクトリを選ばせる
      const tree = await getAllFiles(dirHandle);
      setFileTree(tree);
    } catch (error) {
      // ユーザーがキャンセルした場合は無視
      if(error instanceof DOMException) {
        if(error.name !== 'AbortError'){
          console.error("ディレクトリの読み込みエラー:", error);
          setError(error.message || "ディレクトリの読み込み中にエラーが発生しました。");
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

// 📁 ディレクトリのすべてのファイルを取得（再帰処理）
const getAllFiles = async (dirHandle: FileSystemDirectoryHandle): Promise<FileEntry[]> => {
  const entries: FileEntry[] = [];

  try {
    for await (const [name, entry] of dirHandle.entries() as AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>) { 
      if (entry.kind === "file") {
        entries.push({ name, handle: entry as FileSystemFileHandle, isDirectory: false });
      } else if (entry.kind === "directory") {
        const children = await getAllFiles(entry as FileSystemDirectoryHandle); // 🔹 再帰的に取得
        entries.push({ name, handle: entry as FileSystemDirectoryHandle, isDirectory: true, children });
      }
    }

    // 📌 ファイル名でソート（フォルダが先）
    return entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

  } catch (error) {
    console.error("ファイル一覧の取得エラー:", error);
    throw error;
  }
};  // 📄 ファイルを開いて編集
  const handleOpenFile = useCallback(async (fileHandle: FileSystemFileHandle) => {
    try {
      setIsLoading(true);
      setError(null);

      // 既に編集中のファイルがある場合、変更があれば保存確認
      if (currentFile && fileContent !== editedContent) {
        const confirmSave = window.confirm("変更を保存しますか？");
        if (confirmSave) {
          await handleSaveFile();
        }
      }

      const file = await fileHandle.getFile();
      const text = await file.text();
      setCurrentFile(fileHandle);
      setFileContent(text);
      setEditedContent(text);
    } catch (error: unknown) {
      if (error instanceof Error) {
        // Error 型であれば message を安全にアクセス
        console.error("ファイルの読み込みエラー:", error.message);
        setError(error.message || "ファイルの読み込み中にエラーが発生しました。");
      } else {
        // Error 型でない場合は別の処理
        console.error("不明なエラーが発生しました:", error);
        setError("ファイルの読み込み中に不明なエラーが発生しました。");
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, fileContent, editedContent]);

  // 💾 編集内容を保存
  const handleSaveFile = useCallback(async () => {
    if (!currentFile) return;

    try {
      setIsLoading(true);
      setError(null);

      const writable = await currentFile.createWritable();
      await writable.write(editedContent);
      await writable.close();

      // 現在のコンテンツを更新（変更なしの状態に）
      setFileContent(editedContent);

      // 代わりにトースト通知を使用
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg';
      toast.textContent = 'ファイルが保存されました 🎉';
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

  // 変更があるかどうかを確認
  const hasChanges = currentFile && fileContent !== editedContent;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <div className="w-64 bg-gray-800 text-white p-4 overflow-auto">
        <h1 className="text-xl font-bold mb-4">VS Code 風エディタ</h1>

        <button
          onClick={handleOpenDirectory}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center mb-4"
          disabled={isLoading}
        >
          <FolderIcon className="mr-2" size={16} />
          {isLoading ? "読み込み中..." : "フォルダを開く"}
        </button>

        {/* ファイルツリー */}
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

      {/* メインエディタ領域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* エディタヘッダー */}
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

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-2">
            <p>{error}</p>
          </div>
        )}

        {/* エディタ本体 */}
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

// 📂 ファイルツリーコンポーネント
const FileTree = ({ entries, onFileClick }: {
  entries: FileEntry[];
  onFileClick: (file: FileSystemFileHandle) => void
}) => {
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